import json

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
    resume_skills = extract_skills(resume_text, skills_dict)
    job_skills = extract_skills(job_text, skills_dict)

    matched = {}
    missing = {}

    for category, job_skills_list in job_skills.items():
        resume_set = set(resume_skills.get(category, []))
        job_set = set(job_skills_list)

        matched[category] = list(resume_set & job_set)
        missing[category] = list(job_set - resume_set)

    # Calculate overall match score
    match_score = calculate_match_score(matched, job_skills)

    return {
        "resume_skills": resume_skills,
        "job_skills": job_skills,
        "matched": matched,
        "missing": missing,
        "match_score": match_score
    }

def calculate_match_score(matched, job_skills):
    """
    Calculate overall match score as a percentage
    based on number of matched skills vs total required skills
    """
    total_required = 0
    total_matched = 0

    for category in job_skills:
        job_count = len(job_skills[category])
        matched_count = len(matched.get(category, []))

        total_required += job_count
        total_matched += matched_count

    # Avoid division by zero
    if total_required == 0:
        return 0

    score = int((total_matched / total_required) * 100)
    return score

if __name__ == "__main__":
    resume_text = "I have worked with Python, Django, React, AWS and Docker."
    job_text = "Looking for a developer skilled in Python, Django, React, PostgreSQL, AWS, Docker and Kubernetes."

    skills_dict = load_skills()
    result = compare_resume_job(resume_text, job_text, skills_dict)

    print(result)
