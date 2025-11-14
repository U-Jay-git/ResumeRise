# main.py
from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
from hf_model import HFResumeMatcher
from matcher import load_skills, extract_skills

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load HF model once at startup
hf_matcher = HFResumeMatcher()

def flatten_skill_dict(skill_dict):
    flat = []
    for v in skill_dict.values():
        if isinstance(v, (list, tuple, set)):
            flat.extend(v)
        elif isinstance(v, str):
            flat.append(v)
    return [s.strip() for s in flat if isinstance(s, str) and s.strip()]

@app.post("/upload-resume")
async def upload_resume(resume_file: UploadFile, job_text: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        return {"error": "Only PDF files allowed"}

    # Extract text from PDF
    content = await resume_file.read()
    resume_text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            resume_text += page.extract_text() or ""

    # Rule-based skill extraction
    skills_dict = load_skills()
    resume_skills_dict = extract_skills(resume_text, skills_dict)
    job_skills_dict = extract_skills(job_text, skills_dict)

    resume_skills_flat = set(s.lower() for s in flatten_skill_dict(resume_skills_dict))
    job_skills_flat = set(s.lower() for s in flatten_skill_dict(job_skills_dict))

    matched = sorted(list(resume_skills_flat & job_skills_flat))
    missing = sorted(list(job_skills_flat - resume_skills_flat))

    overlap_score = round((len(matched) / len(job_skills_flat) * 100), 2) if job_skills_flat else 0.0

    # Hugging Face model prediction
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

    # Return unified response
    return {
        "hf_score": hf_score,
        "matching_analysis": matching_analysis,
        "recommendation": recommendation,
        "rule_overlap_score": overlap_score,
        "matched_skills": matched,
        "missing_skills": missing,
        "resume_skills_by_category": resume_skills_dict,
        "job_skills_by_category": job_skills_dict
    }
