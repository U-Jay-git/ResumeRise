# main.py
from fastapi import FastAPI, UploadFile, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pdfplumber
import io
import traceback
import os
import pickle
import json

# Original Resume Matcher import
from hf_model import HFResumeMatcher  # keep your HF model
from matcher import load_skills, extract_skills  # keep original rule-based functions

# LLM client
from openai import OpenAI

# ----------------------------
# Helper Functions
# ----------------------------
def flatten_skill_dict(skill_dict: Dict[str, Any]) -> List[str]:
    flat = []
    for v in skill_dict.values():
        if isinstance(v, (list, tuple, set)):
            flat.extend(v)
        elif isinstance(v, str):
            flat.append(v)
    return [s.strip() for s in flat if isinstance(s, str) and s.strip()]

async def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            resume_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        if not resume_text.strip():
            raise ValueError("No text extracted from PDF.")
        return resume_text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF parsing error: {e}")

# ----------------------------
# Pydantic Models
# ----------------------------
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
    emotion: str
    feedback: str

class InterviewResponsePayload(BaseModel):
    question: str
    transcription: str
    emotion: str
    feedback: str

class FinalFeedbackRequest(BaseModel):
    responses: List[InterviewResponsePayload]
    config: Dict[str, Any]

class FinalFeedbackResponse(BaseModel):
    overall_score: str
    strengths: str
    improvement_areas: str

# ----------------------------
# FastAPI App
# ----------------------------
app = FastAPI(title="Resume & Interview AI Suite")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------
# Load Resume Matcher Model
# ----------------------------
hf_matcher = HFResumeMatcher()  # original Hugging Face model
SKILLS_DICT = load_skills()

# ----------------------------
# LLM Client
# ----------------------------
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "phi3")
try:
    OLLAMA_CLIENT = OpenAI(
        base_url=f"{OLLAMA_BASE_URL}/v1",
        api_key="ollama"
    )
except Exception as e:
    print("Failed to initialize Ollama:", e)
    OLLAMA_CLIENT = None


# ----------------------------
# Resume Upload & Matching
# ----------------------------
@app.post("/upload-resume", response_model=MatchResult)
async def upload_resume(resume_file: UploadFile, job_text: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await resume_file.read()
    resume_text = await extract_text_from_pdf(content)

    # Rule-based skill extraction
    resume_skills_dict = extract_skills(resume_text, SKILLS_DICT)
    job_skills_dict = extract_skills(job_text, SKILLS_DICT)

    resume_skills_flat = set(s.lower() for s in flatten_skill_dict(resume_skills_dict))
    job_skills_flat = set(s.lower() for s in flatten_skill_dict(job_skills_dict))

    matched = sorted(list(resume_skills_flat & job_skills_flat))
    missing = sorted(list(job_skills_flat - resume_skills_flat))
    overlap_score = round((len(matched) / len(job_skills_flat) * 100), 2) if job_skills_flat else 0.0

    # HF model scoring
    try:
        hf_result = hf_matcher.predict(resume_text, job_text)
        hf_score = hf_result.get("score", 0.0)
        matching_analysis = hf_result.get("matching_analysis", "")
        recommendation = hf_result.get("recommendation", "")
    except Exception as e:
        print(f"HF model prediction failed: {e}")
        hf_score = 0.0
        matching_analysis = ""
        recommendation = ""

    return MatchResult(
        hf_score=hf_score,
        matching_analysis=matching_analysis,
        recommendation=recommendation,
        rule_overlap_score=overlap_score,
        matched_skills=matched,
        missing_skills=missing,
        resume_skills_by_category=resume_skills_dict,
        job_skills_by_category=job_skills_dict
    )

# ----------------------------
# Start Interview
# ----------------------------
@app.post("/start-interview", response_model=InterviewQuestions)
async def start_interview(resume_file: UploadFile = Form(...), job_text: str = Form(...), interview_type: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    if OLLAMA_CLIENT is None:
        raise HTTPException(status_code=503, detail="Ollama client not initialized")
    content = await resume_file.read()
    resume_text = await extract_text_from_pdf(content)

    system_prompt = f"""
    You are an expert interviewer. Create 5-7 questions based on the candidate's resume and job description.
    Include generic questions like 'Tell me about yourself'. Respond as a single JSON: {{ "questions": [ ... ] }}.
    """
    user_prompt = f"Resume:\n{resume_text}\nJob Description:\n{job_text}\nInterview type: {interview_type}"

    response = OLLAMA_CLIENT.chat.completions.create(
        model=OLLAMA_MODEL_NAME,
        messages=[{"role": "system","content": system_prompt},{"role": "user","content": user_prompt}],
        response_format={"type":"json_object"},
        temperature=0.7
    )

    llm_response_text = response.choices[0].message.content
    cleaned_text = llm_response_text.strip()
    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text[7:].strip()
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3].strip()
    questions_data = json.loads(cleaned_text)
    return InterviewQuestions(questions=questions_data.get("questions", []))

# ----------------------------
# Submit Response Analysis
# ----------------------------
@app.post("/submit-response", response_model=InterviewResponseAnalysis)
async def submit_response(question_text: str = Form(...), interview_type: str = Form(...), response_text: str = Form(...)):
    if OLLAMA_CLIENT is None:
        raise HTTPException(status_code=503, detail="Ollama client not initialized")
    system_prompt = f"""
    Analyze candidate response. Respond as JSON: {{ "transcription": "...", "emotion": "...", "feedback": "..." }}
    """
    user_prompt = f"Question: {question_text}\nResponse: {response_text}\nInterview type: {interview_type}"

    response = OLLAMA_CLIENT.chat.completions.create(
        model=OLLAMA_MODEL_NAME,
        messages=[{"role": "system","content": system_prompt},{"role": "user","content": user_prompt}],
        response_format={"type":"json_object"},
        temperature=0.8
    )

    analysis_data = json.loads(response.choices[0].message.content)
    return InterviewResponseAnalysis(**analysis_data)

# ----------------------------
# Generate Final Feedback
# ----------------------------
@app.post("/generate-final-feedback", response_model=FinalFeedbackResponse)
async def generate_final_feedback(request_data: FinalFeedbackRequest):
    if OLLAMA_CLIENT is None:
        raise HTTPException(status_code=503, detail="Ollama client not initialized")

    formatted_responses = ""
    for i, res in enumerate(request_data.responses):
        formatted_responses += f"--- Question {i+1} ---\nQuestion: {res.question}\nResponse: {res.transcription}\nFeedback: {res.feedback}\n"

    system_prompt = f"""
    Analyze all interview responses and generate final JSON feedback:
    {{ "overall_score": "...", "strengths": "...", "improvement_areas": "..." }}
    """
    user_prompt = f"Config: {json.dumps(request_data.config)}\nAll responses:\n{formatted_responses}"

    response = OLLAMA_CLIENT.chat.completions.create(
        model=OLLAMA_MODEL_NAME,
        messages=[{"role": "system","content": system_prompt},{"role": "user","content": user_prompt}],
        response_format={"type":"json_object"},
        temperature=0.4
    )

    final_feedback_data = json.loads(response.choices[0].message.content)
    return FinalFeedbackResponse(**final_feedback_data)
