from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
import pickle
import os

from matcher import load_skills, extract_skills  # extract_skills returns dict category->[skills]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Try to load ML model (pipeline). If missing, model_pred will be skipped.
MODEL_PATH = "resume_matcher_model.pkl"
model = None
if os.path.exists(MODEL_PATH):
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)


def flatten_skill_dict(skill_dict):
    """Convert {category: [skills]} -> flat list of skills (strings)"""
    flat = []
    for v in skill_dict.values():
        if isinstance(v, (list, tuple, set)):
            flat.extend(v)
        elif isinstance(v, str):
            flat.append(v)
    # Normalize: strip and filter empties
    flat = [s.strip() for s in flat if isinstance(s, str) and s.strip()]
    return flat


@app.post("/upload-resume")
async def upload_resume(resume_file: UploadFile, job_text: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        return {"error": "Only PDF files allowed"}

    # extract text
    content = await resume_file.read()
    resume_text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            resume_text += page.extract_text() or ""

    # 1) Rule-based skill extraction (from skills.json)
    skills_dict = load_skills()
    resume_skills_dict = extract_skills(resume_text, skills_dict)   # dict: category -> [skills]
    job_skills_dict = extract_skills(job_text, skills_dict)

    resume_skills_flat = set(s.lower() for s in flatten_skill_dict(resume_skills_dict))
    job_skills_flat = set(s.lower() for s in flatten_skill_dict(job_skills_dict))

    matched = sorted(list(resume_skills_flat & job_skills_flat))
    missing = sorted(list(job_skills_flat - resume_skills_flat))

    # rule-based overlap % (0-100)
    overlap_score = round((len(matched) / len(job_skills_flat) * 100), 2) if job_skills_flat else 0.0

    # 2) ML model prediction (if model available)
    model_score = None
    if model is not None:
        # prepare input exactly like during training; here we used resume + " [SEP] " + job_text
        model_input = resume_text + " [SEP] " + job_text
        try:
            raw_score = model.predict([model_input])[0]  # expected 0..1 overlap during training
            # ensure in [0,1]
            if isinstance(raw_score, float):
                raw_score = max(0.0, min(1.0, raw_score))
            model_score = round(raw_score * 100, 2)
        except Exception as e:
            # model failed, leave model_score None
            model_score = None

    # return both for transparency
    return {
        "match_score_model": model_score,         # None if model not available or failed
        "match_score_overlap": overlap_score,    # rule-based % (0-100)
        "matched_skills": matched,
        "missing_skills": missing,
        "resume_skills_by_category": resume_skills_dict,  # optional debug info
        "job_skills_by_category": job_skills_dict         # optional debug info
    }
