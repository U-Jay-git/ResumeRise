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
import groq
from dotenv import load_dotenv

load_dotenv()

groq_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="ResumeRise API")

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
# DYNAMIC RESUME MATCHER (100% Groq-powered)
# =============================

@app.post("/match-resume-ml")
async def match_resume_ml(
    resume: UploadFile = File(...),
    job_description: str = Form(...)
):
    """Dynamic resume matcher - extracts skills directly from job description using Groq"""
    
    try:
        import PyPDF2
        import io
        
        # Extract text from PDF
        pdf_bytes = await resume.read()
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        resume_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                resume_text += text
        
        if not resume_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # ============================================================
        # STEP 1: Extract skills from Job Description using Groq
        # ============================================================
        
        jd_skill_prompt = f"""Extract ALL technical skills, tools, frameworks, and competencies from this job description.

Job Description:
{job_description[:3000]}

Return ONLY a JSON array of unique skills.
Example: ["Python", "AWS", "React", "PostgreSQL", "Docker", "Kubernetes"]

Skills:"""

        jd_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=800,
            messages=[{"role": "user", "content": jd_skill_prompt}],
        )
        
        jd_content = jd_response.choices[0].message.content.strip()
        if '```json' in jd_content:
            jd_content = jd_content.split('```json')[1].split('```')[0]
        elif '```' in jd_content:
            jd_content = jd_content.split('```')[1].split('```')[0]
        
        try:
            job_skills = json.loads(jd_content)
        except:
            job_skills = []
        
        # ============================================================
        # STEP 2: Extract skills from Resume using Groq
        # ============================================================
        
        resume_skill_prompt = f"""Extract ALL technical skills, tools, frameworks, and technologies from this resume.

Resume:
{resume_text[:3000]}

Return ONLY a JSON array of unique skills.
Example: ["Python", "Django", "AWS", "Docker", "PostgreSQL", "REST APIs"]

Skills:"""

        resume_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            max_tokens=800,
            messages=[{"role": "user", "content": resume_skill_prompt}],
        )
        
        resume_content = resume_response.choices[0].message.content.strip()
        if '```json' in resume_content:
            resume_content = resume_content.split('```json')[1].split('```')[0]
        elif '```' in resume_content:
            resume_content = resume_content.split('```')[1].split('```')[0]
        
        try:
            resume_skills = json.loads(resume_content)
        except:
            resume_skills = []
        
        # ============================================================
        # STEP 3: Match skills
        # ============================================================
        
        resume_skills_lower = [s.lower().strip() for s in resume_skills]
        job_skills_lower = [s.lower().strip() for s in job_skills]
        
        matched_skills = []
        missing_skills = []
        
        for job_skill in job_skills_lower:
            if job_skill in resume_skills_lower:
                matched_skills.append(job_skill)
            else:
                # Check for partial match
                found = False
                for resume_skill in resume_skills_lower:
                    if job_skill in resume_skill or resume_skill in job_skill:
                        matched_skills.append(job_skill)
                        found = True
                        break
                if not found:
                    missing_skills.append(job_skill)
        
        matched_skills = list(set(matched_skills))
        missing_skills = list(set(missing_skills))
        
        # ============================================================
        # STEP 4: Calculate score
        # ============================================================
        
        if job_skills_lower:
            score = int((len(matched_skills) / len(job_skills_lower)) * 100)
            score = min(95, max(25, score))
        else:
            score = 50
        
        if score >= 75:
            match_level = "Excellent Match"
            recommendation = "Excellent match! Your skills align very well with the job requirements."
        elif score >= 55:
            match_level = "Good Match"
            recommendation = "Good match. Consider adding the missing skills highlighted below."
        elif score >= 35:
            match_level = "Moderate Match"
            recommendation = "Moderate match. Focus on adding key skills from the job description."
        else:
            match_level = "Low Match"
            recommendation = "Low match. Significant updates needed to align with this role."
        
        # ============================================================
        # STEP 5: Generate feedback using Groq
        # ============================================================
        
        feedback_prompt = f"""Based on the skill analysis, provide helpful feedback.

MATCH SCORE: {score}% ({match_level})
MATCHED SKILLS: {', '.join(matched_skills[:10]) if matched_skills else 'None'}
MISSING SKILLS: {', '.join(missing_skills[:10]) if missing_skills else 'None'}

Write a JSON response with:
1. overall: One sentence about overall fit
2. strengths: One sentence about what matches well
3. gaps: One sentence about missing skills
4. improvements: One sentence with actionable advice
5. ats_tips: One sentence ATS optimization tip

Return ONLY valid JSON."""

        feedback_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.5,
            max_tokens=400,
            messages=[{"role": "user", "content": feedback_prompt}],
        )
        
        feedback_content = feedback_response.choices[0].message.content.strip()
        if '```json' in feedback_content:
            feedback_content = feedback_content.split('```json')[1].split('```')[0]
        elif '```' in feedback_content:
            feedback_content = feedback_content.split('```')[1].split('```')[0]
        
        try:
            llm_feedback = json.loads(feedback_content)
        except:
            llm_feedback = {
                "overall": f"Your resume matches {score}% of the job requirements.",
                "strengths": f"You have {len(matched_skills)} relevant skills including {', '.join(matched_skills[:3]) if matched_skills else 'some basic skills'}.",
                "gaps": f"Consider adding: {', '.join(missing_skills[:5]) if missing_skills else 'None - great match!'}",
                "improvements": "Add more specific examples and metrics to your experience section.",
                "ats_tips": "Use standard section headings and include keywords from the job description."
            }
        
        return JSONResponse(content={
            "final_score": score,
            "match_level": match_level,
            "recommendation": recommendation,
            "matched_skills": matched_skills[:20],
            "missing_skills": missing_skills[:20],
            "resume_skills": resume_skills[:25],
            "job_skills": job_skills[:25],
            "analysis": f"Matched {len(matched_skills)} skills out of {len(job_skills_lower)}. Skills extracted dynamically from job description using Groq.",
            "method": "Dynamic JD Skill Extraction + Groq Analysis (No static skills)",
            "llm_feedback": llm_feedback
        })
        
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
        "service": "ResumeRise API",
        "features": ["Mock Interview", "Dynamic Resume Matcher", "Emotion Detection"],
        "timestamp": datetime.now().isoformat()
    })

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)