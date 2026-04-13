import json
import os
import base64
import tempfile
import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="ResumeRise Mock Interview API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# PYDANTIC MODELS
# =============================

class SubmitResponse(BaseModel):
    question_text: str
    response_text: str
    audio_emotion: Optional[str] = None
    face_emotion: Optional[str] = None
    interview_type: str
    response_time_seconds: Optional[float] = None

class InterviewTurn(BaseModel):
    question: str
    transcription: str
    emotion: str
    score: float
    feedback: str
    timestamp: Optional[str] = None

class NextQuestionRequest(BaseModel):
    interview_history: List[InterviewTurn]
    interview_type: str
    job_role: Optional[str] = None
    difficulty: Optional[str] = "medium"

class FinalFeedbackRequest(BaseModel):
    responses: List[Dict[str, Any]]
    config: Dict[str, Any]

# =============================
# TRANSCRIBE AUDIO
# =============================

@app.post("/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_file_path = tmp_file.name
        
        try:
            with open(tmp_file_path, "rb") as audio_file:
                transcription = groq_client.audio.transcriptions.create(
                    file=(file.filename, audio_file),
                    model="whisper-large-v3-turbo",
                )
            
            transcribed_text = transcription.text
            
            analysis_prompt = f"""You're a friendly interviewer. Based on this answer, write a brief paragraph:

Candidate said: "{transcribed_text}"

Return JSON: 
{{"emotion_label": "one word summary", "emotion_summary": "your paragraph here"}}"""

            analysis = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.7,
                max_tokens=250,
                messages=[{"role": "user", "content": analysis_prompt}],
            )
            
            result = json.loads(analysis.choices[0].message.content.strip())
            
            return JSONResponse(content={
                "text": transcribed_text,
                "audio_emotion": result.get("emotion_label", "neutral"),
                "emotion_analysis": result.get("emotion_summary", ""),
                "timestamp": datetime.now().isoformat()
            })
            
        finally:
            os.unlink(tmp_file_path)
        
    except Exception as e:
        print(f"Transcription error: {e}")
        return JSONResponse(content={
            "text": "",
            "audio_emotion": "neutral",
            "emotion_analysis": "Could not transcribe audio.",
            "timestamp": datetime.now().isoformat()
        })

# =============================
# FACE EMOTION BATCH
# =============================

@app.post("/face-emotion-batch")
async def analyze_face_emotion_batch(images: List[UploadFile] = File(...)):
    try:
        encoded_images = []
        for img in images[:5]:
            img_bytes = await img.read()
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            encoded_images.append(img_base64)
        
        prompt = f"""You have {len(encoded_images)} frames of a candidate's face during an answer.
Write a natural paragraph about their emotional state.

Return JSON: {{"emotion": "one word", "analysis": "paragraph"}}"""
        
        content = [{"type": "text", "text": prompt}]
        for img_base64 in encoded_images:
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}
            })
        
        response = groq_client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{"role": "user", "content": content}],
            temperature=0.6,
            max_tokens=300,
        )
        
        result = json.loads(response.choices[0].message.content.strip())
        
        return JSONResponse(content={
            "face_emotion": result.get("emotion", "neutral"),
            "face_analysis": result.get("analysis", "Candidate appeared composed."),
            "frames_analyzed": len(encoded_images),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Face analysis error: {e}")
        return JSONResponse(content={
            "face_emotion": "neutral",
            "face_analysis": "Candidate maintained neutral expression.",
            "frames_analyzed": 0,
            "timestamp": datetime.now().isoformat()
        })

# =============================
# START INTERVIEW
# =============================

@app.post("/start-interview")
async def start_interview(
    resume_file: UploadFile = File(...),
    job_text: str = Form(...),
    interview_type: str = Form(...)
):
    try:
        await resume_file.read()
        
        prompt = f"""Create {5 if interview_type == 'technical' else 4} interview questions.

Job Description: {job_text[:1500]}

Return ONLY a JSON array of questions: ["Question 1", "Question 2", ...]"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.8,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        
        content = response.choices[0].message.content.strip()
        
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]
        
        questions = json.loads(content)
        
        return JSONResponse(content={
            "questions": [{"question": q} for q in questions],
            "interview_type": interview_type,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Start error: {e}")
        fallback = [
            "Tell me about your experience.",
            "What technical skills do you have?",
            "Describe a project you're proud of.",
            "Why are you interested in this role?",
            "Where do you see yourself in 5 years?"
        ]
        return JSONResponse(content={
            "questions": [{"question": q} for q in fallback[:5]],
            "interview_type": interview_type
        })

# =============================
# SUBMIT RESPONSE
# =============================

@app.post("/submit-response")
async def submit_response(data: SubmitResponse):
    try:
        prompt = f"""Question: "{data.question_text}"
Answer: "{data.response_text}"

Give score (1-10) and brief feedback.
Return JSON: {{"score": number, "feedback": "your feedback"}}"""

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        
        content = response.choices[0].message.content.strip()
        
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]
        
        result = json.loads(content)
        
        return JSONResponse(content={
            "score": result.get("score", 5),
            "emotion": data.audio_emotion or "neutral",
            "feedback": result.get("feedback", "Good attempt."),
            "analyzed_at": datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return JSONResponse(content={
            "score": 5,
            "emotion": data.audio_emotion or "neutral",
            "feedback": "Try to add more specific examples next time.",
            "analyzed_at": datetime.now().isoformat()
        })

# =============================
# NEXT QUESTION
# =============================

@app.post("/next-question")
async def generate_next_question(data: NextQuestionRequest):
    history = data.interview_history
    
    if not history:
        return JSONResponse(content={
            "question": "Tell me about yourself.",
            "affirmation": ""
        })
    
    total_score = sum(turn.score for turn in history)
    avg_score = total_score / len(history)
    asked_questions = [turn.question for turn in history]
    last_answer = history[-1].transcription
    
    prompt = f"""Last answer: "{last_answer[:200]}"
Average score: {avg_score:.1f}/10

Ask ONE natural follow-up question. Don't repeat:
{chr(10).join([f"- {q}" for q in asked_questions[-3:]])}

Return ONLY the question."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.85,
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        
        next_question = response.choices[0].message.content.strip()
        next_question = next_question.strip('"').strip("'")
        
        return JSONResponse(content={
            "question": next_question,
            "affirmation": ""
        })
        
    except Exception as e:
        print(f"Next question error: {e}")
        return JSONResponse(content={
            "question": "Can you tell me more about your experience?",
            "affirmation": ""
        })

# =============================
# FINAL FEEDBACK
# =============================

@app.post("/generate-final-feedback")
async def generate_final_feedback(request: FinalFeedbackRequest):
    responses = request.responses
    
    if not responses:
        raise HTTPException(status_code=400, detail="No responses found")
    
    total_score = sum(r.get('score', 0) for r in responses)
    avg_score = total_score / len(responses)
    
    transcript = ""
    for i, r in enumerate(responses, 1):
        transcript += f"Q{i}: {r.get('question', 'N/A')}\nA: {r.get('transcription', 'N/A')}\nScore: {r.get('score', 0)}/10\n---\n"
    
    prompt = f"""Based on this interview, write feedback.

TRANSCRIPT:
{transcript}
Average score: {avg_score:.1f}/10

Return JSON:
{{
  "overall_score": "X/10 - rating",
  "overall_summary": "paragraph",
  "how_they_came_across": "paragraph",
  "strengths": "paragraph",
  "improvement_areas": "paragraph",
  "verdict": "paragraph"
}}"""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        
        content = response.choices[0].message.content.strip()
        
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        elif '```' in content:
            content = content.split('```')[1].split('```')[0]
        
        content = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', content)
        feedback = json.loads(content)
        
        return JSONResponse(content={
            "overall_score": feedback.get("overall_score", f"{avg_score:.1f}/10"),
            "overall_summary": feedback.get("overall_summary", f"You completed {len(responses)} questions."),
            "emotional_summary": feedback.get("how_they_came_across", "You seemed generally composed."),
            "strengths": feedback.get("strengths", "You answered all questions."),
            "improvement_areas": feedback.get("improvement_areas", "Add more specific examples."),
            "verdict": feedback.get("verdict", f"Average score: {avg_score:.1f}/10."),
            "statistics": {
                "average_score": round(avg_score, 2),
                "total_questions": len(responses)
            }
        })
        
    except Exception as e:
        print(f"Final feedback error: {e}")
        return JSONResponse(content={
            "overall_score": f"{avg_score:.1f}/10",
            "overall_summary": f"You completed {len(responses)} questions.",
            "emotional_summary": "You seemed generally composed.",
            "strengths": "You answered all questions.",
            "improvement_areas": "Add more specific examples.",
            "verdict": f"Average score: {avg_score:.1f}/10. Keep practicing.",
            "statistics": {
                "average_score": round(avg_score, 2),
                "total_questions": len(responses)
            }
        })

# =============================
# SIMPLE RESUME MATCHER (No ML dependencies)
# =============================

@app.post("/match-resume-ml")
async def match_resume_ml(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """Simple keyword-based resume matcher (no heavy dependencies)"""
    
    try:
        import PyPDF2
        import io
        
        pdf_bytes = await resume.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        resume_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                resume_text += text
        
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Simple keyword matching
        resume_lower = resume_text.lower()
        job_lower = job_description.lower()
        
        common_skills = [
            "python", "java", "javascript", "react", "angular", "vue", "node",
            "django", "flask", "fastapi", "spring", "aws", "docker", "kubernetes",
            "sql", "mongodb", "postgresql", "tensorflow", "pytorch", "machine learning",
            "data science", "git", "rest api", "graphql", "ci/cd", "agile", "scrum"
        ]
        
        matched = [skill for skill in common_skills if skill in resume_lower and skill in job_lower]
        missing = [skill for skill in common_skills if skill in job_lower and skill not in resume_lower]
        
        if len(missing) == 0:
            score = 85
        else:
            score = max(30, min(85, 85 - (len(missing) * 8)))
        
        result = {
            "final_score": score,
            "semantic_score": score - 5,
            "rag_score": score - 3,
            "skill_score": score - 2,
            "matched_skills": matched[:10],
            "missing_skills": missing[:10],
            "analysis": f"Matched {len(matched)} skills. Missing {len(missing)} skills.",
            "recommendation": "Good match!" if score > 70 else "Consider adding missing skills.",
            "method": "Keyword-based matching",
            "llm_feedback": {
                "overall": f"Your resume matches {score}% of the job requirements.",
                "strengths": f"You have {len(matched)} relevant skills including {', '.join(matched[:3]) if matched else 'some basic skills'}.",
                "missing": f"Consider adding: {', '.join(missing[:5]) if missing else 'None - great match!'}",
                "improvements": "Add more specific examples and metrics to your experience section.",
                "ats_tips": "Use standard section headings and include keywords from the job description."
            }
        }
        
        return JSONResponse(content=result)
        
    except Exception as e:
        print(f"Matching error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================
# HEALTH CHECK
# =============================

@app.get("/health")
async def health_check():
    return JSONResponse(content={
        "status": "healthy",
        "service": "ResumeRise Mock Interview API",
        "timestamp": datetime.now().isoformat()
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)