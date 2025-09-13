from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from matcher import load_skills, compare_resume_job

# Initialize FastAPI
app = FastAPI(title="ResumeRise - Skill Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins (for dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load skills once (not every request)
skills_dict = load_skills()

# Input schema
class InputData(BaseModel):
    resume_text: str
    job_text: str

@app.get("/")
def home():
    return {"message": "Welcome to ResumeRise Skill Matcher API 🚀"}

@app.post("/match-skills")
def match_skills(data: InputData):
    """
    Compare resume and job description, return matched and missing skills
    """
    result = compare_resume_job(data.resume_text, data.job_text, skills_dict)
    return result
