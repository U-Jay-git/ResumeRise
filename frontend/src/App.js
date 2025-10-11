import React, { useState } from "react";
import axios from "axios";

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobText, setJobText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const res = await axios.post("http://localhost:8000/upload-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (error) {
      console.error(error);
      alert("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100">
      <header className="bg-blue-700 text-white py-6 shadow-md">
        <h1 className="text-center text-4xl font-extrabold tracking-wide">
          🚀 ResumeRise Matcher
        </h1>
        <p className="text-center mt-2 text-lg text-blue-200">
          Match your resume against job descriptions instantly!
        </p>
      </header>

      <main className="container mx-auto px-6 py-10">
        {/* Upload + Job Description */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl shadow-lg mb-10"
        >
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">
            Upload Resume & Job Description
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Resume Upload */}
            <div>
              <label className="block font-medium mb-2 text-gray-600">
                Upload Resume (PDF):
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setResumeFile(e.target.files[0])}
                className="border-2 border-gray-300 p-3 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Job Description */}
            <div>
              <label className="block font-medium mb-2 text-gray-600">
                Job Description:
              </label>
              <textarea
                value={jobText}
                onChange={(e) => setJobText(e.target.value)}
                rows={6}
                className="border-2 border-gray-300 p-3 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste job description here..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition duration-200 w-full md:w-auto"
          >
            {loading ? "⏳ Analyzing..." : "⚡ Match Skills"}
          </button>
        </form>

        {/* Results Section */}
        {result && (
          <section className="bg-white p-8 rounded-2xl shadow-lg">
            <h2 className="text-3xl font-bold text-gray-700 mb-6">📊 Results</h2>

            {/* Match Score */}
            <div className="mb-8">
              <p className="text-lg font-semibold text-gray-600 mb-2">
                Match Score:
              </p>
              <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className={`h-8 text-white text-center font-bold flex items-center justify-center transition-all duration-500 ${
                    result.match_score >= 70
                      ? "bg-green-500"
                      : result.match_score >= 40
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${result.match_score}%` }}
                >
                  {result.match_score}%
                </div>
              </div>
            </div>

            {/* Skills Section */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Matched Skills */}
              <div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">
                  ✅ Matched Skills
                </h3>
                <ul className="list-disc ml-5 space-y-1">
                  {result.matched_skills.length > 0 ? (
                    result.matched_skills.map((skill) => (
                      <li key={skill} className="text-gray-700">
                        {skill}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400">None</li>
                  )}
                </ul>
              </div>

              {/* Missing Skills */}
              <div>
                <h3 className="text-xl font-semibold text-red-600 mb-2">
                  ❌ Missing Skills
                </h3>
                <ul className="list-disc ml-5 space-y-1">
                  {result.missing_skills.length > 0 ? (
                    result.missing_skills.map((skill) => (
                      <li key={skill} className="text-gray-700">
                        {skill}
                      </li>
                    ))
                  ) : (
                    <li className="text-gray-400">None</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-blue-700 text-white py-4 mt-10 text-center">
        <p className="text-sm">© 2025 ResumeRise. Built with ❤️ using React + FastAPI</p>
      </footer>
    </div>
  );
}

export default App;
