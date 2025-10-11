# hf_model.py
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline
import torch
import numpy as np

class HFResumeMatcher:
    def __init__(self, model_name="sentence-transformers/all-MiniLM-L6-v2"):
        """
        Use a Hugging Face model for resume-job description matching.
        Default: sentence-transformers/all-MiniLM-L6-v2 (fast + lightweight).
        """
        self.model_name = model_name
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        except Exception as e:
            raise RuntimeError(
                f"Cannot load Hugging Face model '{self.model_name}'. Check internet or cached model."
            ) from e

        # GPU if available
        if torch.cuda.is_available():
            self.model.to("cuda")

        # Pipeline for embeddings
        self.pipeline = pipeline(
            "feature-extraction",
            model=self.model,
            tokenizer=self.tokenizer,
            device=0 if torch.cuda.is_available() else -1
        )

    def predict(self, resume_text, job_description):
        """
        Compare resume with job description and return a similarity score (0–100).
        Also returns matching_analysis and recommendation.
        """
        # Get embeddings
        resume_vec = np.array(self.pipeline(resume_text)[0][0])
        jd_vec = np.array(self.pipeline(job_description)[0][0])

        # Cosine similarity
        similarity = np.dot(resume_vec, jd_vec) / (np.linalg.norm(resume_vec) * np.linalg.norm(jd_vec))
        score = round(float(similarity) * 100, 2)

        # Analysis & recommendation
        analysis = "High match" if score > 70 else "Moderate match" if score > 40 else "Low match"
        recommendation = (
            "Good match. No major skill gaps." if score > 70 else
            "Moderate match. Consider adding missing skills." if score > 40 else
            "Low match. Major skill gaps, improve skills listed in job description."
        )

        return {
            "resume": resume_text[:200] + "...",
            "job_description": job_description[:200] + "...",
            "score": score,
            "matching_analysis": analysis,
            "recommendation": recommendation
        }
