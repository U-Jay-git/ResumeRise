import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

// IMPORTANT FIX: Explicitly set the base URL to your FastAPI server's address.
// This prevents the frontend dev server (e.g., localhost:3000) from intercepting the request
// and returns the 404 HTML body you were seeing.
axios.defaults.baseURL = "http://localhost:8000/"; 

// Main component
export default function App() {
    const [resumeFile, setResumeFile] = useState(null);
    const [jobText, setJobText] = useState("");
    const [interviewType, setInterviewType] = useState("technical");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [fetchedQuestions, setFetchedQuestions] = useState([]); 
    
    const navigate = useNavigate();

    // Configuration object to pass to the next page
    const interviewConfig = { 
        resumeFile: resumeFile ? resumeFile.name : 'N/A', 
        interviewType 
    };
    
    // --- API Call to Generate Questions ---
    const handleStartInterview = async (e) => {
        e.preventDefault();
        
        setFetchedQuestions([]);
        
        // 1. Validation check
        if (!resumeFile || !jobText) {
            setError("Please upload a resume and provide a job description.");
            return;
        }

        setLoading(true);
        setError("");
        
        // 2. Prepare FormData for the backend
        const formData = new FormData();
        // Keys MUST match the FastAPI function arguments!
        formData.append("resume_file", resumeFile); 
        formData.append("job_text", jobText);
        formData.append("interview_type", interviewType);

        try {
            // 3. Make the actual API call using axios
            // Now using the explicit base URL from axios.defaults.baseURL
            const response = await axios.post("start-interview", formData, {
                headers: {
                    // Set Content-Type to undefined to let the browser/axios 
                    // automatically set the boundary for multipart/form-data.
                    "Content-Type": undefined, 
                },
            });

            // 4. On success, store the questions in state
            const questions = response.data.questions || [];
            
            if (questions.length > 0) {
                setFetchedQuestions(questions);
            } else {
                console.warn("Backend response data:", response.data);
                setError("Backend returned an empty list of questions. Check your server's LLM generation and JSON structure.");
            }
            
        } catch(err) {
            console.error("API Error during interview setup:", err);
            
            let errorMessage = "An unexpected error occurred.";
            
            if (err.response) {
                if (err.response.data && err.response.data.detail) {
                    // Use the specific error message from the FastAPI backend
                    errorMessage = err.response.data.detail;
                } else {
                    // Generic HTTP error fallback
                    errorMessage = `Server Error: Status ${err.response.status}. Check backend logs.`;
                }
            } else if (err.request) {
                // Network error, likely server down or connection refused
                errorMessage = "Could not connect to the backend. Is the FastAPI server running and accessible on port 8000?";
            } else {
                // Request setup error
                errorMessage = `Request Error: ${err.message}`;
            }
            
            setError(errorMessage);
        } finally {
            // 5. Always stop loading regardless of success or failure
            setLoading(false);
        }
    };
    
    // --- Navigation to Mock Interview Page ---
    const handleProceedToInterview = () => {
        if (fetchedQuestions.length === 0) return;
        
        // Save questions and config to sessionStorage for resilience against page refresh
        sessionStorage.setItem('interviewQuestions', JSON.stringify(fetchedQuestions));
        sessionStorage.setItem('interviewConfig', JSON.stringify(interviewConfig));
        
        // Navigate
        navigate("/mock-interview", { 
            state: { 
                questions: fetchedQuestions, 
                config: interviewConfig 
            } 
        });
    };

    // Helper function to handle input changes and clear fetched questions
    const handleInputChange = (setter, value) => {
        setter(value);
        setFetchedQuestions([]); // Clear generated questions when input changes
        setError(""); // Clear error when user starts typing again
    };

    const inputClasses = "w-full p-4 rounded-xl bg-[#1e293b] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#fcd34d]";
    const labelClasses = "block text-left text-lg font-semibold mb-2 text-[#22c55e]";

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white flex flex-col font-sans">
            <header className="fixed w-full z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md shadow-lg flex justify-between items-center">
                <Link to="/" className="text-xl text-[#fcd34d] hover:text-white transition">
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
                        Provide the context for your personalized mock interview.
                    </p>
                    <form onSubmit={handleStartInterview} className="space-y-6">
                        
                        {/* Resume File Input */}
                        <div>
                            <label htmlFor="resume_file" className={labelClasses}>
                                Upload Resume (PDF only)
                            </label>
                            <input
                                type="file"
                                id="resume_file"
                                accept=".pdf"
                                onChange={(e) => handleInputChange(setResumeFile, e.target.files[0])}
                                className="w-full text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-base file:font-semibold file:bg-[#2563eb] file:text-white hover:file:bg-[#fcd34d] hover:file:text-black file:transition-colors file:cursor-pointer"
                                disabled={fetchedQuestions.length > 0}
                            />
                            {resumeFile && (
                                <p className="text-left text-sm text-gray-400 mt-2">
                                    File selected: <span className="font-medium truncate ml-1">{resumeFile.name}</span>
                                </p>
                            )}
                        </div>
                        
                        {/* Job Description Textarea */}
                        <div>
                            <label htmlFor="job_text" className={labelClasses}>
                                Job Description
                            </label>
                            <textarea
                                id="job_text"
                                value={jobText}
                                onChange={(e) => handleInputChange(setJobText, e.target.value)}
                                rows="6"
                                className={`${inputClasses} resize-none`}
                                placeholder="Paste the job description here..."
                                disabled={fetchedQuestions.length > 0}
                            />
                        </div>
                        
                        {/* Interview Type Select */}
                        <div>
                            <label htmlFor="interview_type" className={labelClasses}>
                                Interview Type
                            </label>
                            <div className="relative">
                                <select
                                    id="interview_type"
                                    value={interviewType}
                                    onChange={(e) => handleInputChange(setInterviewType, e.target.value)}
                                    className={inputClasses}
                                    disabled={fetchedQuestions.length > 0}
                                >
                                    <option value="technical">Technical</option>
                                    <option value="hr">HR / Behavioral</option>
                                </select>
                            </div>
                        </div>
                        
                        {/* Generate Questions Button (Submit) */}
                        <button
                            type="submit"
                            disabled={loading || fetchedQuestions.length > 0 || !resumeFile || !jobText}
                            className={`w-full py-4 text-xl font-bold rounded-xl shadow-xl transition duration-300 transform ${
                                loading
                                    ? "bg-gray-500 cursor-not-allowed"
                                    : "bg-[#7c3aed] hover:bg-[#a78bfa] hover:text-white hover:scale-[1.02]"
                            } disabled:opacity-50 flex items-center justify-center space-x-3`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Generating Questions...
                                </span>
                            ) : (
                                <span>Generate Interview Questions</span>
                            )}
                        </button>
                        
                        {error && (
                            <p className="text-red-400 mt-4 bg-red-900/50 p-4 rounded-xl border border-red-700 text-center">
                                {error}
                            </p>
                        )}
                    </form>

                    {/* Questions Generated and Proceed Button */}
                    {fetchedQuestions.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-700 text-left">
                            <h3 className="text-2xl font-bold text-[#fcd34d] mb-4">
                                Questions Generated ({fetchedQuestions.length})
                            </h3>
                            <div className="space-y-3 p-4 bg-[#1e293b] rounded-xl max-h-60 overflow-y-auto border border-gray-600 shadow-inner">
                                {fetchedQuestions.map((q, index) => (
                                    <p key={index} className="text-gray-300 text-base leading-snug">
                                        <span className="font-extrabold text-[#22c55e] mr-2">{index + 1}.</span> {q}
                                    </p>
                                ))}
                            </div>
                            
                            {/* Proceed Button */}
                            <button
                                onClick={handleProceedToInterview}
                                className="w-full mt-6 py-4 text-xl font-bold rounded-xl shadow-xl transition duration-300 bg-[#22c55e] hover:bg-[#15803d] transform hover:scale-[1.02]"
                            >
                                Proceed to Live Interview &rarr;
                            </button>
                        </div>
                    )}
                </div>
            </main>
            <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700">
                © 2025 ResumeRise. All rights reserved.
            </footer>
        </div>
    );
}
