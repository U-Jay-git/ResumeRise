import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
import pickle

# -----------------------------
# Load dataset
# -----------------------------
df = pd.read_csv("ml_dataset.csv")

# Combine resume and job text
df["input_text"] = df["resume_text"].fillna("") + " [SEP] " + df["job_text"].fillna("")
X = df["input_text"]
y = df["match_score"]

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# -----------------------------
# Pipeline: TF-IDF + Linear Regression
# -----------------------------
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1,2))),
    ("reg", LinearRegression())
])

pipeline.fit(X_train, y_train)

# Evaluate
train_score = pipeline.score(X_train, y_train)
test_score = pipeline.score(X_test, y_test)
print(f"Train R^2: {train_score:.2f}")
print(f"Test R^2: {test_score:.2f}")

# Save model
with open("resume_matcher_model.pkl", "wb") as f:
    pickle.dump(pipeline, f)

print("✅ Model saved as resume_matcher_model.pkl")
