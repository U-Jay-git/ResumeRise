import pandas as pd
import re

# -----------------------------
# Load CSVs
# -----------------------------
resumes = pd.read_csv("resumeskills.csv", engine="python")
jobs = pd.read_csv("JobProfileDataset.csv", engine="python")

# -----------------------------
# Extract skills
# -----------------------------
def extract_skills(text):
    if not isinstance(text, str):
        return []
    skills = re.split(r'[\*,;\-\n]', text)
    skills = [s.strip() for s in skills if len(s.strip()) > 1]
    return skills

resumes["ParsedSkills"] = resumes["Skills"].apply(extract_skills)
jobs["ParsedSkills"] = jobs["Job Description"].apply(extract_skills)

# -----------------------------
# Create dataset with continuous overlap score
# -----------------------------
training_data = []

for _, resume in resumes.iterrows():
    for _, job in jobs.iterrows():
        resume_skills = set([s.lower() for s in resume["ParsedSkills"]])
        job_skills = set([s.lower() for s in job["ParsedSkills"]])
        
        # Continuous match score
        overlap = len(resume_skills & job_skills) / max(len(job_skills), 1)
        
        training_data.append({
            "resume_text": " ".join(resume_skills),
            "job_text": " ".join(job_skills),
            "match_score": overlap  # float 0-1
        })

df_train = pd.DataFrame(training_data)
df_train.to_csv("ml_dataset.csv", index=False)
print("✅ Processed dataset saved as ml_dataset.csv with continuous match score")
