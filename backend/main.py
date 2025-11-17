import os
import io
import json
import re
import pdfplumber
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Resume logic imports
from hf_model import HFResumeMatcher
from matcher import load_skills, extract_skills

# GROQ Client
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
try:
    groq_client = Groq(api_key=GROQ_API_KEY)
    print("✅ Groq client initialized")
except Exception as e:
    print("❌ Groq initialization failed:", e)
    groq_client = None

GROQ_MODEL = "llama-3.1-8b-instant"

# -----------------------
# JSON Extractor
# -----------------------
def safe_json_extract(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("Empty LLM response")

    cleaned = text.strip().replace("```json", "").replace("```", "")
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", cleaned)

    # Try direct JSON
    try:
        return json.loads(cleaned)
    except:
        pass

    # Extract JSON block
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    # Replace quotes
    repaired = cleaned.replace("“", '"').replace("”", '"')
    repaired = re.sub(r"'([^']*)'", r'"\1"', repaired)

    try:
        return json.loads(repaired)
    except Exception as e:
        raise ValueError(f"Failed to parse JSON: {e}")

# -----------------------
# GROQ Chat Helper
# -----------------------
def groq_chat(system_msg: str, user_msg: str, temperature: float = 0.2):
    if groq_client is None:
        raise HTTPException(status_code=503, detail="Groq client not initialized")

    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            temperature=temperature,
        )
        return res.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq LLM Error: {e}")

# -----------------------
# PDF Text Extraction
# -----------------------
async def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join([p.extract_text() or "" for p in pdf.pages]).strip()
    except:
        raise HTTPException(status_code=400, detail="Invalid PDF format")

# -----------------------
# Pydantic Models
# -----------------------
class MatchResult(BaseModel):
    hf_score: float
    matching_analysis: str
    recommendation: str
    rule_overlap_score: float
    matched_skills: List[str]
    missing_skills: List[str]
    resume_skills_by_category: Dict[str, Any]
    job_skills_by_category: Dict[str, Any]

class InterviewQuestions(BaseModel):
    questions: List[str]

class InterviewResponseAnalysis(BaseModel):
    transcription: str
    emotion: str | None = None
    feedback: str | None = None

class InterviewResponsePayload(BaseModel):
    question: str
    transcription: str
    emotion: str | None = None
    feedback: str | None = None

class FinalFeedbackRequest(BaseModel):
    responses: List[InterviewResponsePayload]
    config: Dict[str, Any]

class FinalFeedbackResponse(BaseModel):
    overall_score: str
    strengths: str
    improvement_areas: str

# -----------------------
# FastAPI Init
# -----------------------
app = FastAPI(title="ResumeRise AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

hf_matcher = HFResumeMatcher()
SKILLS = load_skills()

# -----------------------
# Routes
# -----------------------
@app.post("/upload-resume", response_model=MatchResult)
async def upload_resume(resume_file: UploadFile, job_text: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Upload a PDF only")

    # --- Extract resume text ---
    pdf_bytes = await resume_file.read()
    resume_text = await extract_pdf_text(pdf_bytes)

    # --- Extract skills ---
    resume_skill_dict = extract_skills(resume_text, SKILLS)
    job_skill_dict = extract_skills(job_text, SKILLS)

    flat_resume = {s.lower() for v in resume_skill_dict.values() for s in v}
    flat_job = {s.lower() for v in job_skill_dict.values() for s in v}

    # --- Skill overlap ---
    matched = sorted(flat_resume & flat_job)
    missing = sorted(flat_job - flat_resume)
    skill_overlap_ratio = len(matched) / max(len(flat_job), 1)  # 0–1
    rule_overlap_score = round(skill_overlap_ratio * 100, 2)

    # --- AI model semantic score ---
    try:
        hf_result = hf_matcher.predict(resume_text, job_text)
        hf_semantic_score = hf_result.get("score", 0.0)  # 0–1
        hf_semantic_score = min(max(hf_semantic_score, 0.0), 1.0)
    except Exception as e:
        print("HF model error:", e)
        hf_result = {"matching_analysis": "", "recommendation": ""}
        hf_semantic_score = 0.0

    # --- Combine scores (weighted, 60% AI, 40% skill match) ---
    combined_score = 0.6 * hf_semantic_score + 0.4 * skill_overlap_ratio
    combined_score = min(max(combined_score, 0.0), 1.0)  # cap 0–1
    hf_score_percentage = round(combined_score * 100, 2)

    return MatchResult(
        hf_score=hf_score_percentage,
        matching_analysis=hf_result.get("matching_analysis", ""),
        recommendation=hf_result.get("recommendation", ""),
        rule_overlap_score=rule_overlap_score,
        matched_skills=matched,
        missing_skills=missing,
        resume_skills_by_category=resume_skill_dict,
        job_skills_by_category=job_skill_dict,
    )


@app.post("/start-interview", response_model=InterviewQuestions)
async def start_interview(resume_file: UploadFile = Form(...), job_text: str = Form(...), interview_type: str = Form(...)):
    pdf_bytes = await resume_file.read()
    resume_text = await extract_pdf_text(pdf_bytes)

    system_msg = 'Return ONLY valid JSON: { "questions": ["Q1", "Q2", ...] }'
    user_msg = f"Generate 5-7 interview questions.\nResume:\n{resume_text}\nJob Description:\n{job_text}\nType: {interview_type}"

    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)

    return InterviewQuestions(questions=data.get("questions", [])[:7])

@app.post("/submit-response", response_model=InterviewResponseAnalysis)
async def submit_response(question_text: str = Form(...), interview_type: str = Form(...), response_text: str = Form(...)):
    system_msg = 'Return ONLY JSON: { "transcription": "", "emotion": "", "feedback": "" }'
    user_msg = f"Question: {question_text}\nType: {interview_type}\nResponse: {response_text}"

    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)

    return InterviewResponseAnalysis(
        transcription=data.get("transcription", ""),
        emotion=data.get("emotion"),
        feedback=data.get("feedback")
    )

@app.post("/generate-final-feedback", response_model=FinalFeedbackResponse)
async def generate_final_feedback(req: FinalFeedbackRequest):
    combined = ""
    for i, r in enumerate(req.responses):
        combined += (
            f"\nQ{i+1}: {r.question}\n"
            f"Transcription: {r.transcription}\n"
            f"Feedback: {r.feedback}\n"
        )

    system_msg = (
        "Return ONLY JSON:\n"
        '{ "overall_score": "", "strengths": "", "improvement_areas": "" }'
    )

    user_msg = (
        f"Config: {json.dumps(req.config)}\n"
        f"Interview Data:\n{combined}"
    )

    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)

    # --- Handle strengths ---
    strengths = data.get("strengths", "")
    if isinstance(strengths, list):
        strengths = "\n".join(strengths)
    if not strengths.strip():
        strengths = "No specific strengths identified."

    # --- Handle improvement areas ---
    improvement_areas = data.get("improvement_areas", "")
    if isinstance(improvement_areas, list):
        improvement_areas = "\n".join(improvement_areas)
    if not improvement_areas.strip():
        improvement_areas = "No specific improvement areas identified."

    # --- Handle overall score as integer ---
    overall_score = data.get("overall_score", "")
    try:
        # Extract numeric value if possible
        if isinstance(overall_score, list):
            overall_score = overall_score[0] if overall_score else "0"
        overall_score = int(re.search(r"\d+", str(overall_score)).group())
    except:
        overall_score = 0

    return FinalFeedbackResponse(
        overall_score=str(overall_score),  # keep it string if frontend expects string
        strengths=strengths,
        improvement_areas=improvement_areas
    )
