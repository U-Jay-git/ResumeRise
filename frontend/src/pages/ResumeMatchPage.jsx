import React, { useState } from "react";
import axios from "axios";

function ResumeMatchPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile || !jobText) {
      alert("Please upload a resume and paste job description");
      return;
    }

    const formData = new FormData();
    formData.append("resume_file", resumeFile);
    formData.append("job_text", jobText);

    try {
      setLoading(true);
      setError("");
      const res = await axios.post("http://localhost:8000/upload-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze resume. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white flex flex-col">
      
      {/* Header */}
      <header className="bg-[#1e293b]/90 backdrop-blur-md shadow-lg py-6 px-8">
        <h1 className="text-4xl font-extrabold text-[#22c55e] text-center">
          Resume Matching
        </h1>
        <p className="text-center mt-2 text-gray-300 text-lg">
          Match your resume against job descriptions instantly!
        </p>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-10 flex-1">
        {/* Upload Form Card */}
        <div className="bg-[#0f172a] p-10 rounded-3xl shadow-2xl mb-10 max-w-5xl mx-auto hover:shadow-[#fcd34d]/40 transition transform hover:-translate-y-1">
          <h2 className="text-3xl font-bold mb-6 text-[#22c55e]">Upload Resume & Job Description</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-medium mb-2 text-gray-300">Upload Resume (PDF):</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setResumeFile(e.target.files[0])}
                  className="border-2 border-gray-700 p-4 w-full rounded-xl bg-[#1e293b] text-white focus:outline-none focus:ring-2 focus:ring-[#fcd34d]"
                />
              </div>
              <div>
                <label className="block font-medium mb-2 text-gray-300">Job Description:</label>
                <textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  rows={6}
                  className="border-2 border-gray-700 p-4 w-full rounded-xl bg-[#1e293b] text-white focus:outline-none focus:ring-2 focus:ring-[#fcd34d]"
                  placeholder="Paste job description here..."
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#2563eb] hover:bg-[#fcd34d] text-black font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-[#fcd34d]/50 transition duration-300 w-full md:w-auto"
            >
              {loading ? "⏳ Analyzing..." : "⚡ Match Skills"}
            </button>
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </form>
        </div>

        {/* Results Section Card */}
        {result && (
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Scores Card */}
            <div className="bg-[#0f172a] p-8 rounded-3xl shadow-2xl hover:shadow-[#2563eb]/40 transition transform hover:-translate-y-1">
              <h3 className="text-2xl font-bold mb-6 text-[#22c55e]">📊 Match Scores</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-gray-300 mb-2 font-semibold">Match Score (Overlap):</p>
                  <div className="w-full bg-gray-700 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-[#2563eb] h-8 text-black text-center font-bold transition-all duration-500"
                      style={{ width: `${result.match_score_overlap}%` }}
                    >
                      {result.match_score_overlap}%
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-gray-300 mb-2 font-semibold">AI Model Score:</p>
                  <div className="w-full bg-gray-700 rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-[#7c3aed] h-8 text-black text-center font-bold transition-all duration-500"
                      style={{ width: `${result.match_score_model}%` }}
                    >
                      {result.match_score_model.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Missing Skills Card */}
            <div className="bg-[#0f172a] p-8 rounded-3xl shadow-2xl hover:shadow-[#fcd34d]/40 transition transform hover:-translate-y-1">
              <h3 className="text-2xl font-bold mb-6 text-[#fcd34d]">❌ Missing Skills</h3>
              <ul className="list-disc ml-5 space-y-1 text-gray-300">
                {result.missing_skills && result.missing_skills.length > 0 ? (
                  result.missing_skills.map((skill) => <li key={skill}>{skill}</li>)
                ) : (
                  <li className="text-gray-500">None</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700">
        <p className="text-sm">© 2025 ResumeRise. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default ResumeMatchPage;
