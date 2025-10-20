from fastapi import FastAPI, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import pdfplumber
import io
from matcher import compare_resume_job, load_skills


app = FastAPI()
app = FastAPI()

# Allow frontend (React) to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    #allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-resume")
async def upload_resume(resume_file: UploadFile, job_text: str = Form(...)):
    if resume_file.content_type != "application/pdf":
        return {"error": "Only PDF files allowed"}

    content = await resume_file.read()
    text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text += page.extract_text() or ""

    # Load skills.json each time (or cache it globally)
    skills_dict = load_skills()
    result = compare_resume_job(text, job_text, skills_dict)
    return result
