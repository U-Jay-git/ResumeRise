import React, { useState } from "react";
import axios from "axios";

function App() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://127.0.0.1:8000/match-skills", {
        resume_text: resume,
        job_text: job,
      });
      setResult(response.data);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to connect to backend. Check if FastAPI is running.");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "Arial" }}>
      <h1>Resume Matcher</h1>
      <form onSubmit={handleSubmit}>
        <label>Resume Text:</label>
        <textarea
          rows="5"
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          style={{ width: "100%", marginBottom: "20px" }}
        />

        <label>Job Description:</label>
        <textarea
          rows="5"
          value={job}
          onChange={(e) => setJob(e.target.value)}
          style={{ width: "100%", marginBottom: "20px" }}
        />

        <button type="submit">Check Match</button>
      </form>

      {result && (
        <div style={{ marginTop: "30px" }}>
          <h2>Results:</h2>
          <p><b>Match Score:</b> {result.match_score}%</p>

          <h3>Matched Skills</h3>
          <pre>{JSON.stringify(result.matched, null, 2)}</pre>

          <h3>Missing Skills</h3>
          <pre>{JSON.stringify(result.missing, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
