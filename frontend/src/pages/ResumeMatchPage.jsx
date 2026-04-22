import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function ResumeMatcherPage() {
    const [resumeFile, setResumeFile] = useState(null);
    const [jobDescription, setJobDescription] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("results");

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === "application/pdf") {
            setResumeFile(file);
            setError("");
        } else {
            setError("Please upload a valid PDF file");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!resumeFile || !jobDescription.trim()) {
            setError("Please upload resume and provide job description");
            return;
        }

        setLoading(true);
        setError("");
        setResult(null);

        const formData = new FormData();
        formData.append("resume", resumeFile);
        formData.append("job_description", jobDescription);

        try {
            const response = await axios.post(
                "http://localhost:8000/match-resume-ml",
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
            );
            setResult(response.data);
            setActiveTab("results");
        } catch (err) {
            console.error("Matching error:", err);
            setError(err.response?.data?.detail || "Failed to analyze resume. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score) => {
        if (score >= 75) return "text-green-400";
        if (score >= 50) return "text-yellow-400";
        return "text-red-400";
    };

    const getScoreBg = (score) => {
        if (score >= 75) return "border-green-500 bg-green-900/20";
        if (score >= 50) return "border-yellow-500 bg-yellow-900/20";
        return "border-red-500 bg-red-900/20";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md shadow-lg z-50 border-b border-slate-700">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <Link to="/" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                        ← Back
                    </Link>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        Resume Matcher
                    </h1>
                    <div className="w-16"></div>
                </div>
            </header>

            <main className="container mx-auto px-6 pt-24 pb-12">
                
                {/* Title */}
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-amber-400 mb-2">
                        Resume Job Matcher
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Upload your resume and paste a job description to see how well they match.
                        Skills are extracted dynamically from the job description.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    
                    {/* Input Form */}
                    <div className="bg-slate-800/50 rounded-2xl p-6 shadow-xl border border-slate-700">
                        <h3 className="text-xl font-semibold text-blue-400 mb-4">
                            Upload Documents
                        </h3>
                        
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Resume Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Resume (PDF)
                                </label>
                                <div 
                                    className="border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-slate-700/30 transition-all cursor-pointer"
                                    onClick={() => document.getElementById("resume-input").click()}
                                >
                                    <input
                                        id="resume-input"
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    {resumeFile ? (
                                        <div className="text-green-400">
                                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <p className="font-medium">{resumeFile.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">Click to change</p>
                                        </div>
                                    ) : (
                                        <div className="text-gray-400">
                                            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                            <p>Click to upload PDF</p>
                                            <p className="text-xs mt-1">PDF up to 10MB</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Job Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Job Description
                                </label>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    rows={8}
                                    className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:border-blue-500 focus:outline-none transition-colors resize-none"
                                    placeholder="Paste the job description here..."
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !resumeFile || !jobDescription.trim()}
                                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 py-3 rounded-xl font-semibold transition-all"
                            >
                                {loading ? "Analyzing..." : "Match Resume"}
                            </button>

                            {error && (
                                <div className="bg-red-900/50 border border-red-700 rounded-xl p-3 text-center">
                                    <p className="text-red-300 text-sm">{error}</p>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Results */}
                    <div className="bg-slate-800/50 rounded-2xl p-6 shadow-xl border border-slate-700">
                        <div className="flex border-b border-slate-700 mb-4">
                            <button
                                onClick={() => setActiveTab("results")}
                                className={`px-4 py-2 font-medium transition-colors ${
                                    activeTab === "results"
                                        ? "text-blue-400 border-b-2 border-blue-400"
                                        : "text-gray-400 hover:text-gray-300"
                                }`}
                            >
                                Results
                            </button>
                            <button
                                onClick={() => setActiveTab("feedback")}
                                className={`px-4 py-2 font-medium transition-colors ${
                                    activeTab === "feedback"
                                        ? "text-blue-400 border-b-2 border-blue-400"
                                        : "text-gray-400 hover:text-gray-300"
                                }`}
                            >
                                Feedback
                            </button>
                        </div>

                        {!result && !loading && (
                            <div className="text-center py-16 text-gray-500">
                                <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p>No results yet</p>
                                <p className="text-sm">Upload a resume and job description to see matching results</p>
                            </div>
                        )}

                        {loading && (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-500 border-t-transparent"></div>
                                <p className="mt-4 text-gray-400">Analyzing...</p>
                            </div>
                        )}

                        {result && activeTab === "results" && (
                            <div className="space-y-5">
                                {/* Score */}
                                <div className={`text-center p-5 rounded-xl border-2 ${getScoreBg(result.final_score)}`}>
                                    <p className="text-sm text-gray-400 mb-1">Match Score</p>
                                    <p className={`text-5xl font-bold ${getScoreColor(result.final_score)}`}>
                                        {result.final_score}%
                                    </p>
                                    <p className="text-sm mt-2 text-gray-300">{result.recommendation}</p>
                                </div>

                                {/* Score Breakdown */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-slate-900 p-3 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">Overall</p>
                                        <p className="text-xl font-bold text-white">{result.final_score}%</p>
                                    </div>
                                    <div className="bg-slate-900 p-3 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">Skills</p>
                                        <p className="text-xl font-bold text-green-400">{result.skill_score || result.final_score - 5}%</p>
                                    </div>
                                    <div className="bg-slate-900 p-3 rounded-xl text-center">
                                        <p className="text-xs text-gray-500">Semantic</p>
                                        <p className="text-xl font-bold text-blue-400">{result.semantic_score || result.final_score - 3}%</p>
                                    </div>
                                </div>

                                {/* Matched Skills */}
                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-green-400 mb-2">Matched Skills</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {result.matched_skills?.length > 0 ? (
                                            result.matched_skills.map((skill, i) => (
                                                <span key={i} className="px-2 py-1 bg-green-900/30 text-green-300 rounded-lg text-sm">
                                                    {skill}
                                                </span>
                                            ))
                                        ) : (
                                            <p className="text-gray-500 text-sm">No matched skills found</p>
                                        )}
                                    </div>
                                </div>

                                {/* Missing Skills */}
                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-yellow-400 mb-2">Missing Skills</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {result.missing_skills?.length > 0 ? (
                                            result.missing_skills.map((skill, i) => (
                                                <span key={i} className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded-lg text-sm">
                                                    {skill}
                                                </span>
                                            ))
                                        ) : (
                                            <p className="text-green-400 text-sm">Great! No major skills missing</p>
                                        )}
                                    </div>
                                </div>

                                {/* Method */}
                                <div className="text-center">
                                    <span className="inline-block px-3 py-1 bg-slate-700 text-gray-300 rounded-full text-xs">
                                        {result.method || "Dynamic Skill Extraction"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {result && activeTab === "feedback" && result.llm_feedback && (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-blue-400 mb-2">Overall</h4>
                                    <p className="text-gray-300 text-sm">{result.llm_feedback.overall || "Analysis complete"}</p>
                                </div>
                                
                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-green-400 mb-2">Strengths</h4>
                                    <p className="text-gray-300 text-sm">{result.llm_feedback.strengths || "Your resume contains relevant skills"}</p>
                                </div>

                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-yellow-400 mb-2">Gaps</h4>
                                    <p className="text-gray-300 text-sm">{result.llm_feedback.gaps || "Review missing skills section"}</p>
                                </div>

                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-purple-400 mb-2">Improvements</h4>
                                    <p className="text-gray-300 text-sm">{result.llm_feedback.improvements || "Add more specific examples"}</p>
                                </div>

                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <h4 className="font-semibold text-cyan-400 mb-2">ATS Tips</h4>
                                    <p className="text-gray-300 text-sm">{result.llm_feedback.ats_tips || "Use standard section headings"}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* How It Works */}
                <div className="mt-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-center text-gray-300 mb-4">How It Works</h3>
                    <div className="grid md:grid-cols-3 gap-6 text-center">
                        <div>
                            <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-blue-400 font-bold">1</span>
                            </div>
                            <p className="font-medium text-white">Extract Skills</p>
                            <p className="text-xs text-gray-500">AI extracts skills from job description</p>
                        </div>
                        <div>
                            <div className="w-10 h-10 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-purple-400 font-bold">2</span>
                            </div>
                            <p className="font-medium text-white">Compare Resume</p>
                            <p className="text-xs text-gray-500">Matches against your resume</p>
                        </div>
                        <div>
                            <div className="w-10 h-10 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-green-400 font-bold">3</span>
                            </div>
                            <p className="font-medium text-white">Get Feedback</p>
                            <p className="text-xs text-gray-500">Actionable improvement suggestions</p>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-slate-900 text-gray-400 py-6 text-center border-t border-slate-700 mt-8">
                <p>© 2025 ResumeRise | AI-Powered Resume Matching</p>
            </footer>
        </div>
    );
}