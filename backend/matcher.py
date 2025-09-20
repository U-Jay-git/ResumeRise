import json
import pandas as pd


# ==========================
# JSON-BASED SKILL MATCHING
# ==========================

def load_skills(file_path="skills.json"):
    """Load skills from JSON file"""
    with open(file_path, "r") as f:
        return json.load(f)


def extract_skills(text, skills_dict):
    """Extract skills present in given text"""
    found_skills = {}
    text_lower = text.lower()

    for category, skills in skills_dict.items():
        matches = [skill for skill in skills if skill.lower() in text_lower]
        if matches:
            found_skills[category] = matches

    return found_skills


def compare_resume_job(resume_text, job_text, skills_dict):
    """Compare resume text and job description text"""
    resume_skills = extract_skills(resume_text, skills_dict)
    job_skills = extract_skills(job_text, skills_dict)

    matched = {}
    missing = {}

    for category, job_skills_list in job_skills.items():
        resume_set = set(resume_skills.get(category, []))
        job_set = set(job_skills_list)

        matched[category] = list(resume_set & job_set)
        missing[category] = list(job_set - resume_set)

    match_score = calculate_match_score(matched, job_skills)

    return {
        "resume_skills": resume_skills,
        "job_skills": job_skills,
        "matched": matched,
        "missing": missing,
        "match_score": match_score
    }


def calculate_match_score(matched, job_skills):
    """Calculate percentage match score"""
    total_required = sum(len(v) for v in job_skills.values())
    total_matched = sum(len(v) for v in matched.values())

    if total_required == 0:
        return 0

    return int((total_matched / total_required) * 100)


# ==========================
# DATASET-BASED MATCHING
# ==========================

def load_datasets(job_file="JobProfileDataset.csv", resume_file="resumeskills.csv"):
    """Load job profiles and resumes from dataset CSVs"""
    job_profiles = pd.read_csv(job_file)
    resumes = pd.read_csv(resume_file)

    def preprocess_skills(text):
        if isinstance(text, str):
            return [skill.strip().lower() for skill in text.split(",")]
        return []

    job_profiles["skills"] = job_profiles["RequiredSkills"].apply(preprocess_skills)
    resumes["skills"] = resumes["CandidateSkills"].apply(preprocess_skills)

    return job_profiles, resumes


def match_score(resume_skills, job_skills):
    """Simple overlap-based score between two skill lists"""
    resume_set = set(resume_skills)
    job_set = set(job_skills)

    matched = resume_set & job_set
    if len(job_set) == 0:
        return 0

    return int((len(matched) / len(job_set)) * 100)


def compare_dataset_sample():
    """Example: Compare first resume with first job profile"""
    job_profiles, resumes = load_datasets()
    job = job_profiles.iloc[0]
    resume = resumes.iloc[0]

    score = match_score(resume["skills"], job["skills"])
    return {
        "job_role": job["JobRole"],
        "resume_id": resume["ResumeID"],
        "resume_skills": resume["skills"],
        "job_skills": job["skills"],
        "match_score": score,
    }


# ==========================
# MAIN TEST (run directly)
# ==========================
if __name__ == "__main__":
    # JSON-based test
    skills_dict = load_skills()
    resume_text = "I have worked with Python, Django, React, AWS and Docker."
    job_text = "Looking for a developer skilled in Python, Django, React, PostgreSQL, AWS, Docker and Kubernetes."
    print("\n=== JSON-BASED TEST ===")
    print(compare_resume_job(resume_text, job_text, skills_dict))

    # Dataset-based test
    print("\n=== DATASET TEST ===")
    print(compare_dataset_sample())
