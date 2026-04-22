import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

// IMPORTANT: Set FastAPI backend URL - change to your Render URL
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
    const [resumeFile, setResumeFile] = useState(null);
    const [jobText, setJobText] = useState("");
    const [interviewType, setInterviewType] = useState("technical");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    // Config metadata to send while navigating
    const interviewConfig = {
        resumeFile: resumeFile ? resumeFile.name : "N/A",
        interviewType
    };

    // --- Auto-Navigate After Question Generation ---
    const handleStartInterview = async (e) => {
        e.preventDefault();

        if (!resumeFile || !jobText) {
            setError("Please upload a resume and provide a job description.");
            return;
        }

        setLoading(true);
        setError("");

        const formData = new FormData();
        formData.append("resume_file", resumeFile);
        formData.append("job_text", jobText);
        formData.append("interview_type", interviewType);

        try {
            const response = await axios.post(`${API_BASE_URL}/start-interview`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const questions = response.data.questions || [];

            if (questions.length === 0) {
                setError("No questions generated. Please check backend.");
                setLoading(false);
                return;
            }

            // Save to sessionStorage so refresh won't lose them
            sessionStorage.setItem(
                "interviewQuestions",
                JSON.stringify(questions)
            );
            sessionStorage.setItem(
                "interviewConfig",
                JSON.stringify(interviewConfig)
            );

            // Auto-navigate to mock interview page
            navigate("/mock-interview", {
                state: { questions, config: interviewConfig }
            });

        } catch (err) {
            console.error("API Error:", err);

            let errorMessage = "Unexpected error occurred.";

            if (err.response?.data?.detail) {
                errorMessage = err.response.data.detail;
            } else if (err.request) {
                errorMessage = "Cannot connect to backend. Please make sure the server is running.";
            } else {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (setter, value) => {
        setter(value);
        setError("");
    };

    const inputClasses =
        "w-full p-4 rounded-xl bg-[#1e293b] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#fcd34d]";
    const labelClasses =
        "block text-left text-lg font-semibold mb-2 text-[#22c55e]";

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white flex flex-col font-sans">
            <header className="fixed w-full z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md shadow-lg flex justify-between items-center">
                <Link
                    to="/"
                    className="text-xl text-[#fcd34d] hover:text-white transition"
                >
                    &larr; Home
                </Link>
                <h1 className="text-3xl font-extrabold text-[#22c55e] tracking-wide">
                    Setup Mock Interview
                </h1>
                <div className="w-10 h-10" />
            </header>

            <main className="container mx-auto px-4 py-24 flex-1 flex flex-col items-center justify-start sm:justify-center text-center">
                <div className="bg-[#0f172a] p-8 md:p-12 rounded-3xl shadow-2xl max-w-xl w-full border border-[#4c1d95]">
                    <h2 className="text-4xl font-bold mb-4 text-[#fcd34d]">
                        Interview Configuration
                    </h2>
                    <p className="text-lg text-gray-300 mb-8">
                        Provide the context for your personalized mock
                        interview.
                    </p>

                    <form onSubmit={handleStartInterview} className="space-y-6">
                        {/* Resume Upload */}
                        <div>
                            <label htmlFor="resume_file" className={labelClasses}>
                                Upload Resume (PDF only)
                            </label>
                            <input
                                type="file"
                                id="resume_file"
                                accept=".pdf"
                                onChange={(e) =>
                                    handleInputChange(
                                        setResumeFile,
                                        e.target.files[0]
                                    )
                                }
                                className="w-full text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-base file:font-semibold file:bg-[#2563eb] file:text-white hover:file:bg-[#fcd34d] hover:file:text-black file:transition-colors file:cursor-pointer"
                            />

                            {resumeFile && (
                                <p className="text-left text-sm text-gray-400 mt-2">
                                    File selected:{" "}
                                    <span className="font-medium truncate ml-1">
                                        {resumeFile.name}
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Job Description */}
                        <div>
                            <label htmlFor="job_text" className={labelClasses}>
                                Job Description
                            </label>
                            <textarea
                                id="job_text"
                                value={jobText}
                                onChange={(e) =>
                                    handleInputChange(
                                        setJobText,
                                        e.target.value
                                    )
                                }
                                rows="6"
                                className={`${inputClasses} resize-none`}
                                placeholder="Paste the job description here..."
                            />
                        </div>

                        {/* Interview Type */}
                        <div>
                            <label
                                htmlFor="interview_type"
                                className={labelClasses}
                            >
                                Interview Type
                            </label>
                            <select
                                id="interview_type"
                                value={interviewType}
                                onChange={(e) =>
                                    handleInputChange(
                                        setInterviewType,
                                        e.target.value
                                    )
                                }
                                className={inputClasses}
                            >
                                <option value="technical">Technical</option>
                                <option value="hr">HR / Behavioral</option>
                            </select>
                        </div>

                        {/* Generate Questions Button */}
                        <button
                            type="submit"
                            disabled={loading || !resumeFile || !jobText}
                            className={`w-full py-4 text-xl font-bold rounded-xl shadow-xl transition duration-300 transform ${
                                loading
                                    ? "bg-gray-500 cursor-not-allowed"
                                    : "bg-[#7c3aed] hover:bg-[#a78bfa] hover:text-white hover:scale-[1.02]"
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg
                                        className="animate-spin h-5 w-5 mr-3 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Generating Questions...
                                </span>
                            ) : (
                                "Generate Interview Questions"
                            )}
                        </button>

                        {/* Error */}
                        {error && (
                            <p className="text-red-400 mt-4 bg-red-900/50 p-4 rounded-xl border border-red-700 text-center">
                                {error}
                            </p>
                        )}
                    </form>
                </div>
            </main>

            <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700">
                © 2025 ResumeRise. All rights reserved.
            </footer>
        </div>
    );
}