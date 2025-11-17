import os
import io
import json
import re
import pdfplumber
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from hf_model import HFResumeMatcher
from matcher import load_skills, extract_skills
from sentence_transformers import SentenceTransformer, util
from groq import Groq

# -----------------------
# Global models
# -----------------------
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
try:
    groq_client = Groq(api_key=GROQ_API_KEY)
except Exception as e:
    print("❌ Groq initialization failed:", e)
    groq_client = None

GROQ_MODEL = "llama-3.1-8b-instant"

# -----------------------
# Helpers
# -----------------------
def safe_json_extract(text: str) -> dict:
    if not text or not text.strip():
        raise ValueError("Empty LLM response")
    cleaned = text.strip().replace("```json", "").replace("```", "")
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", cleaned)
    try:
        return json.loads(cleaned)
    except:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                return json.loads(match.group())
            except:
                pass
        repaired = cleaned.replace("“", '"').replace("”", '"')
        repaired = re.sub(r"'([^']*)'", r'"\1"', repaired)
        return json.loads(repaired)

def groq_chat(system_msg: str, user_msg: str, temperature: float = 0.2):
    if groq_client is None:
        raise HTTPException(status_code=503, detail="Groq client not initialized")
    try:
        res = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": system_msg},
                      {"role": "user", "content": user_msg}],
            temperature=temperature,
        )
        return res.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq LLM Error: {e}")

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
    feedback: str | None = None

class InterviewResponsePayload(BaseModel):
    question: str
    transcription: str
    feedback: str | None = None

class FinalFeedbackRequest(BaseModel):
    responses: List[InterviewResponsePayload]
    config: Dict[str, Any]

class FinalFeedbackResponse(BaseModel):
    overall_score: str
    strengths: str
    improvement_areas: str

# -----------------------
# FastAPI init
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

    pdf_bytes = await resume_file.read()
    resume_text = await extract_pdf_text(pdf_bytes)

    resume_skill_dict = extract_skills(resume_text, SKILLS)
    job_skill_dict = extract_skills(job_text, SKILLS)

    flat_resume = {s.lower() for v in resume_skill_dict.values() for s in v}
    flat_job = {s.lower() for v in job_skill_dict.values() for s in v}

    matched = sorted(flat_resume & flat_job)
    missing = sorted(flat_job - flat_resume)
    skill_overlap_ratio = len(matched) / max(len(flat_job), 1)
    rule_overlap_score = round(skill_overlap_ratio * 100, 2)

    try:
        resume_emb = embedding_model.encode(resume_text, convert_to_tensor=True)
        job_emb = embedding_model.encode(job_text, convert_to_tensor=True)
        hf_semantic_score = util.pytorch_cos_sim(resume_emb, job_emb).item()
    except:
        hf_semantic_score = 0.0

    combined_score = round(min(max(0.0, 0.6 * hf_semantic_score + 0.4 * skill_overlap_ratio), 1.0) * 100, 2)
    matching_analysis = f"Matched {len(matched)} skills out of {len(flat_job)} required skills."
    recommendation = f"Improve skills: {', '.join(missing)}" if missing else "Resume is strong."

    return MatchResult(
        hf_score=combined_score,
        matching_analysis=matching_analysis,
        recommendation=recommendation,
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
    system_msg = 'Return ONLY JSON: { "questions": ["Q1", "Q2", ...] }'
    user_msg = f"Generate 5-7 interview questions.\nResume:\n{resume_text}\nJob Description:\n{job_text}\nType: {interview_type}"
    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)
    return InterviewQuestions(questions=data.get("questions", [])[:7])

@app.post("/submit-response", response_model=InterviewResponseAnalysis)
async def submit_response(question_text: str = Form(...), interview_type: str = Form(...), response_text: str = Form(...)):
    system_msg = (
        "You are an expert interviewer. "
        "Return ONLY JSON: { \"transcription\": \"<text>\", \"feedback\": \"<constructive_feedback>\" }. "
        "Always provide constructive feedback and a numeric score if relevant."
    )
    user_msg = f"Question: {question_text}\nType: {interview_type}\nCandidate Response: {response_text}"
    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)
    return InterviewResponseAnalysis(
        transcription=data.get("transcription", ""),
        feedback=data.get("feedback") or "Feedback not available."
    )

@app.post("/generate-final-feedback", response_model=FinalFeedbackResponse)
async def generate_final_feedback(req: FinalFeedbackRequest):
    combined = ""
    for i, r in enumerate(req.responses):
        combined += f"\nQ{i+1}: {r.question}\nTranscription: {r.transcription}\nFeedback: {r.feedback}\n"

    system_msg = (
        "You are an expert interviewer. "
        "Return ONLY JSON: "
        '{ "overall_score": <integer 0-100>, "strengths": "<text>", "improvement_areas": "<text>" }. '
        "Compute overall_score as a numeric average based on responses."
    )
    user_msg = f"Config: {json.dumps(req.config)}\nInterview Data:\n{combined}"

    raw = groq_chat(system_msg, user_msg)
    data = safe_json_extract(raw)

    # Process strengths & improvement areas
    strengths = "\n".join(data.get("strengths", [])) if isinstance(data.get("strengths"), list) else data.get("strengths", "No specific strengths.")
    improvement_areas = "\n".join(data.get("improvement_areas", [])) if isinstance(data.get("improvement_areas"), list) else data.get("improvement_areas", "No specific improvement areas.")

    # Process numeric overall score
    overall_score_raw = data.get("overall_score", 0)
    try:
        overall_score = int(re.search(r"\d+", str(overall_score_raw)).group())
    except:
        overall_score = 0
    overall_score = max(0, min(overall_score, 100))

    return FinalFeedbackResponse(
        overall_score=str(overall_score),
        strengths=strengths,
        improvement_areas=improvement_areas
    )
