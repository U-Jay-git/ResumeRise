from fastapi import FastAPI, UploadFile, Form, HTTPException, status, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdfplumber
import io
import pickle
import os
import json
import traceback
from typing import List, Dict, Any, Optional
from openai import OpenAI

# Placeholder for matcher functions if matcher.py is not provided for context
def load_skills():
    """Loads a mock skills dictionary for demonstration."""
    return {
        "languages": ["Python", "JavaScript", "TypeScript", "C++"],
        "frameworks": ["React", "FastAPI", "TensorFlow", "Pandas", "Django"],
        "databases": ["PostgreSQL", "MongoDB", "SQL"]
    }

def extract_skills(text: str, skills_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Mocks skill extraction based on simple keyword matching."""
    extracted = {k: [] for k in skills_dict.keys()}
    text_lower = text.lower()
    
    # Iterate over the provided skills_dict
    for category, skills_list in skills_dict.items():
        for skill in skills_list:
            if skill.lower() in text_lower:
                extracted[category].append(skill)
    return extracted

# --- Data Schemas (Pydantic) ---
class MatchResult(BaseModel):
    match_score_rule_based: float
    match_score_model: Optional[float]
    matched_skills: List[str]
    missing_skills: List[str]

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

# UPDATED: Changed keys to reflect the user's request for clear scoring, strengths, and improvement areas.
class FinalFeedbackResponse(BaseModel):
    overall_score: str
    strengths: str
    improvement_areas: str


# --- FastAPI App Initialization and Middleware ---
app = FastAPI(
    title="Resume & Interview AI Suite (Text-Based)",
    description="API for resume matching and LLM-powered mock interviews using text input."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration and Initialization ---

MODEL_PATH = "resume_matcher_model.pkl"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
OLLAMA_MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "phi3:3.8b-mini-4k-instruct-q4_0") 

# Load ML Model (Mocking if file doesn't exist)
try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            ML_MODEL = pickle.load(f)
            print("INFO: ML model loaded successfully.")
    else:
        ML_MODEL = None
        print(f"WARN: ML model not found at {MODEL_PATH}. Model scoring will be skipped.")
except Exception as e:
    ML_MODEL = None
    print(f"ERROR: Failed to load ML model: {e}")

# Load skills for the matcher
try:
    SKILLS_DICT = load_skills()
    print("INFO: Skills dictionary loaded.")
except Exception as e:
    SKILLS_DICT = {}
    print(f"ERROR: Failed to load skills dictionary: {e}")

# Initialize Ollama Client (for LLM analysis)
try:
    OLLAMA_CLIENT = OpenAI(
        base_url=OLLAMA_BASE_URL,
        api_key="ollama_key_unused"
    )
    print("INFO: Ollama client initialized.")
except Exception as e:
    OLLAMA_CLIENT = None
    print(f"ERROR: Failed to initialize Ollama client: {e}")


# --- Helper Functions ---

def flatten_skill_dict(skill_dict: Dict[str, Any]) -> List[str]:
    """Convert {category: [skills]} -> flat list of unique, cleaned skills (strings)"""
    flat = set()
    for v in skill_dict.values():
        if isinstance(v, (list, tuple, set)):
            for item in v:
                if isinstance(item, str) and item.strip():
                    flat.add(item.strip())
        elif isinstance(v, str) and v.strip():
            flat.add(v.strip())
    return list(flat)


def compare_resume_job_with_model(resume_text: str, job_text: str, skills_dict: Dict[str, Any], model: Any) -> MatchResult:
    """Helper function to compare resume and job text and return scores."""
    
    # 1. Extract Skills
    resume_skills_dict = extract_skills(resume_text, skills_dict)
    job_skills_dict = extract_skills(job_text, skills_dict)

    # 2. Flatten and Normalize Skills
    resume_skills_flat = set(s.lower() for s in flatten_skill_dict(resume_skills_dict))
    # FIX: Corrected typo from flatten_skills_dict to flatten_skill_dict
    job_skills_flat = set(s.lower() for s in flatten_skill_dict(job_skills_dict))
    
    # 3. Rule-Based Scoring
    matched = sorted(list(resume_skills_flat & job_skills_flat))
    missing = sorted(list(job_skills_flat - resume_skills_flat))

    # Calculate overlap score
    total_job_skills = len(job_skills_flat)
    overlap_score = round((len(matched) / total_job_skills * 100), 2) if total_job_skills > 0 else 0.0

    # 4. ML Model Scoring
    model_score = None
    if model is not None:
        try:
            model_input = resume_text + " [SEP] " + job_text
            # Model prediction (assuming it returns a probability)
            raw_score = model.predict([model_input])[0] 
            
            if isinstance(raw_score, float):
                raw_score = max(0.0, min(1.0, raw_score)) 
            model_score = round(raw_score * 100, 2)
        except Exception:
            print("ERROR: Failed during ML model prediction.")
            traceback.print_exc()

    return MatchResult(
        match_score_rule_based=overlap_score,
        match_score_model=model_score,
        matched_skills=matched,
        missing_skills=missing,
    )


async def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extracts all text from a PDF file's content.
    """
    try:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            resume_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        
        if not resume_text.strip():
            raise ValueError("Could not extract any meaningful text from the PDF.")
        
        return resume_text.strip()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"PDF parsing error: {e}"
        )


# --- API Endpoints ---

@app.post("/upload-resume", response_model=MatchResult)
async def upload_resume(resume_file: UploadFile, job_text: str = Form(..., description="The full job description text.")):
    """
    Handles resume upload, extracts text, and performs skill-based and ML-based 
    matching against a provided job description.
    """
    if resume_file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Only PDF files allowed for the resume."
        )

    try:
        content = await resume_file.read()
        resume_text = await extract_text_from_pdf(content)

        if not SKILLS_DICT:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Skill data is not loaded. Cannot perform matching."
            )

        result = compare_resume_job_with_model(resume_text, job_text, SKILLS_DICT, ML_MODEL)
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in /upload-resume: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An unexpected error occurred: {e}"
        )


@app.post("/start-interview", response_model=InterviewQuestions)
async def start_interview(
    resume_file: UploadFile = Form(..., description="The candidate's resume (PDF)."),
    job_text: str = Form(..., description="The job description text."),
    interview_type: str = Form(..., description="e.g., 'Behavioral', 'Technical', 'Screening'.")
):
    """
    Starts a new mock interview session, extracts text from the resume,
    and generates the first set of questions using the OLLAMA LLM.
    """
    print("--- API HIT: /start-interview endpoint called ---")
    
    if resume_file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Only PDF files allowed for the resume."
        )

    if OLLAMA_CLIENT is None:
          raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Ollama client is not initialized. Check server logs."
          )

    try:
        # 1. Read and Extract Text
        contents = await resume_file.read()
        resume_text = await extract_text_from_pdf(contents)
        
        # 2. Build LLM Prompts and Generate content
        system_prompt = f"""
        You are an expert interviewer. Your task is to create a list of interview questions based on the candidate's resume and the job description.
        
        The interview type is: {interview_type}.
        
        Generate a list of exactly 5-7 interview questions. In this also make sure u include generic interview questions like tell me about your self,y should we hire u etc. **Crucially, your entire response must be a single, valid JSON object containing one key, 'questions', which maps to a JSON array of strings.** DO NOT include any explanatory text, markdown fences (```json or ```), or non-JSON content outside the required JSON object.
        Example output format:
        {{"questions": ["Question 1...", "Question 2...", "Question 3..."]}}
        """
        
        user_prompt = f"""
        Candidate's Resume:
        ---
        {resume_text}
        ---
        Job Description:
        ---
        {job_text}
        ---
        """
        
        print(f"DEBUG: Starting LLM generation request for model '{OLLAMA_MODEL_NAME}'...")
        
        response = OLLAMA_CLIENT.chat.completions.create(
            model=OLLAMA_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}, 
            temperature=0.7 
        )
        
        llm_response_text = response.choices[0].message.content
        
        # 4. Clean and Parse JSON Response
        cleaned_text = llm_response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:].strip()
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3].strip()

        questions_data = json.loads(cleaned_text)
        
        questions = questions_data.get("questions")
        
        if not isinstance(questions, list) or len(questions) == 0:
            print("ERROR: LLM successfully parsed JSON but returned an empty or invalid 'questions' list.")
            raise ValueError(f"LLM successfully parsed JSON but returned an empty or invalid 'questions' list. Raw LLM content: {llm_response_text}")
        
        # 5. Return structured response
        return InterviewQuestions(questions=questions)

    except HTTPException:
        raise
    except Exception as e:
        print("ERROR in /start-interview:")
        traceback.print_exc()
        if "http://localhost:11434" in str(e) or "Connection" in str(e):
             raise HTTPException(
                 status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                 detail=f"Ollama Connection Error: Is Ollama running and the model '{OLLAMA_MODEL_NAME}' pulled? Details: {e}"
                )
        if "JSON" in str(e) or "invalid 'questions' list" in str(e) or "ValueError" in str(e):
             # Catch specific JSON parsing or empty list error and provide actionable feedback
             raise HTTPException(
                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                 detail=f"LLM JSON Parsing Error or Empty List returned. Check if the LLM ({OLLAMA_MODEL_NAME}) is running and providing valid JSON content. Details: {e}"
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Internal Server Error during interview generation: {e}"
        )


@app.post("/submit-response", response_model=InterviewResponseAnalysis)
async def submit_response(
    question_text: str = Form(..., description="The question the candidate just answered."),
    interview_type: str = Form(..., description="The type of interview (e.g., 'Technical')."),
    # Renamed the input parameter for clarity and simplicity
    response_text: str = Form(..., description="The candidate's actual written response.") 
):
    """
    Receives the candidate's written answer, mocks the emotion, and generates 
    per-question feedback using the OLLAMA LLM.
    
    NOTE: STT and video analysis are removed; response is direct text input.
    """
    print("--- API HIT: /submit-response endpoint called (Text-Based) ---")
    
    if OLLAMA_CLIENT is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Ollama client is not initialized. Cannot analyze response."
        )

    # 1. Use the direct text input as the transcription
    candidate_transcription = response_text
    print(f"DEBUG: Received text response: '{candidate_transcription[:80]}...'")
    
    # 2. Build LLM Prompts for Analysis
    system_prompt = f"""
    You are an AI-powered mock interview analyzer. Your task is to provide constructive and realistic feedback for a candidate's recorded answer.
    
    **Analyze the PROVIDED transcription** and the stated interview type to assess the quality of the answer, including clarity, depth, and relevance.
    
    **Structure your response as a single, valid JSON object with the following three keys:**
    1. 'transcription': The exact candidate response text provided to you (do not modify this).
    2. 'emotion': A single word or short phrase describing the candidate's likely emotional state **based on the answer's quality and structure** (e.g., 'Calm and confident' if the answer is clear, 'Hesitant' if the answer is vague).
    3. 'feedback': 3-4 constructive sentences focusing on technical depth, clarity, or structure based on the transcription content.
    
    Example output format:
    {{"transcription": "...", "emotion": "...", "feedback": "..."}}
    """
    
    user_prompt = f"""
    Interview Type: {interview_type}
    Question Asked: "{question_text}"
    
    **Candidate's Actual Response Text to Analyze:**
    "{candidate_transcription}"
    
    Generate the analysis and feedback.
    """
    
    try:
        print(f"DEBUG: Starting LLM analysis for question: '{question_text}'...")
        
        response = OLLAMA_CLIENT.chat.completions.create(
            model=OLLAMA_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}, 
            temperature=0.8
        )
        
        llm_response_text = response.choices[0].message.content
        
        # 4. Parse and Validate JSON Response
        analysis_data = json.loads(llm_response_text)
        
        if not all(key in analysis_data for key in ["transcription", "emotion", "feedback"]):
            raise ValueError("LLM returned an incomplete analysis JSON.")
        
        print("DEBUG: Analysis successful.")
        # 5. Return structured response
        return InterviewResponseAnalysis(**analysis_data)
    
    except Exception as e:
        print("ERROR in /submit-response:")
        traceback.print_exc()
        if "http://localhost:11434" in str(e) or "Connection" in str(e):
             raise HTTPException(
                 status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                 detail=f"Ollama Connection Error: Is Ollama running and the model '{OLLAMA_MODEL_NAME}' pulled? Details: {e}"
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error generating analysis feedback: {e}"
        )


@app.post("/generate-final-feedback", response_model=FinalFeedbackResponse)
async def generate_final_feedback(request_data: FinalFeedbackRequest):
    """
    Generates a final, comprehensive feedback report based on all interview responses
    using the Ollama LLM, focusing on score, skills, and areas for improvement.
    """
    if OLLAMA_CLIENT is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Ollama client is not initialized. Cannot generate final feedback."
        )

    try:
        # 1. Format the interview data for the LLM
        formatted_responses = ""
        for i, res in enumerate(request_data.responses):
            # Note: We include the 'emotion' and 'feedback' from the per-question analysis 
            # as part of the total data the LLM reviews for the final report.
            formatted_responses += f"""
--- Question {i+1} ---
Question: {res.question}
Candidate's Transcription: "{res.transcription}"
Per-Question Feedback: {res.feedback}
"""

        interview_config = json.dumps(request_data.config, indent=2)

        # 2. Build LLM Prompts
        system_prompt = f"""
        You are a highly analytical and experienced professional specializing in technical interviewing.
        Your task is to analyze the complete mock interview data provided below, including the configuration, questions, transcriptions, and per-question feedback.
        The analysis must be strictly based on the text provided.

        Generate a single, comprehensive final report. **Crucially, your entire response must be a single, valid JSON object** with the following three keys:
        1.  'overall_score': An assessment of the candidate's performance as a score against a top applicant (e.g., '8/10' or '85%').
        2.  'strengths': A paragraph summarizing the candidate's main strengths, focusing specifically on their demonstrated **skills and technical knowledge** shown in the responses.
        3.  'improvement_areas': A paragraph detailing the top 2-3 specific, actionable areas for improvement based on the text responses (e.g., clarity, technical depth, structure).
        
        Example output format:
        {{"overall_score": "75%", "strengths": "...", "improvement_areas": "..."}}
        """
        
        user_prompt = f"""
        Interview Configuration:
        ---
        {interview_config}
        ---
        
        All Question and Answer Data:
        ---
        {formatted_responses}
        ---
        
        Please generate the final comprehensive feedback report in the required JSON format.
        """
        
        # 3. Generate content with Ollama client
        response = OLLAMA_CLIENT.chat.completions.create(
            model=OLLAMA_MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}, 
            temperature=0.4 
        )
        
        llm_response_text = response.choices[0].message.content
        
        # 4. Clean and Parse JSON Response
        cleaned_text = llm_response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:].strip()
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3].strip()

        final_feedback_data = json.loads(cleaned_text)
        
        # Validation check updated for new keys
        if not all(key in final_feedback_data for key in ["overall_score", "strengths", "improvement_areas"]):
            raise ValueError("LLM returned an incomplete final feedback JSON with missing or incorrect keys.")

        # 5. Return structured response using the new Pydantic model
        return FinalFeedbackResponse(**final_feedback_data)
        
    except Exception as e:
        print("ERROR in /generate-final-feedback:")
        traceback.print_exc()
        if "http://localhost:11434" in str(e) or "Connection" in str(e):
             raise HTTPException(
                 status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
                 detail=f"Ollama Connection Error: Is Ollama running and the model '{OLLAMA_MODEL_NAME}' pulled? Details: {e}"
                )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Error generating final feedback: {e}"
        )
