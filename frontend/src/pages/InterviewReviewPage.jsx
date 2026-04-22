import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function InterviewReviewPage() {
    const location = useLocation();
    const navigate = useNavigate();

    const responses = location.state?.responses || [];
    const config = location.state?.config || {};

    const [finalFeedback, setFinalFeedback] = useState(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!responses.length || finalFeedback) return;

        const generateFinalReport = async () => {
            setError("");
            setIsLoading(true);

            const payload = {
                responses: responses.map(r => ({
                    question: r.question,
                    transcription: r.transcription,
                    feedback: r.feedback,
                    score: r.score,
                    emotion: r.emotion
                })),
                config
            };

            try {
                const res = await axios.post(
                    `${API_BASE_URL}/generate-final-feedback`,
                    payload
                );
                setFinalFeedback(res.data);
            } catch (err) {
                const msg = err.response?.data?.detail || "Failed to generate report.";
                setError(msg);
                setFinalFeedback({
                    overall_score: "N/A",
                    overall_summary: "Could not generate summary.",
                    emotional_summary: "Unable to analyze emotional state.",
                    strengths: msg,
                    improvement_areas: "Could not generate final report.",
                    verdict: "Please try again."
                });
            } finally {
                setIsLoading(false);
            }
        };

        generateFinalReport();
    }, [responses, config, finalFeedback]);

    if (!responses.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
                <p className="text-xl">No interview data found. Please complete an interview first.</p>
                <button 
                    onClick={() => navigate('/interview-setup')} 
                    className="mt-4 text-[#fcd34d] hover:text-white"
                >
                    Go to Setup
                </button>
            </div>
        );
    }

    // Calculate average score
    const avgScore = (responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length).toFixed(1);

    // Get emotion color for styling
    const getEmotionColor = (emotion) => {
        const colors = {
            confident: "text-green-400",
            nervous: "text-yellow-400",
            neutral: "text-gray-400",
            enthusiastic: "text-purple-400",
            focused: "text-blue-400",
            confused: "text-orange-400",
            tired: "text-red-400"
        };
        return colors[emotion] || "text-white";
    };

    // Get emotion background for badge
    const getEmotionBg = (emotion) => {
        const bg = {
            confident: "bg-green-900/30",
            nervous: "bg-yellow-900/30",
            neutral: "bg-gray-900/30",
            enthusiastic: "bg-purple-900/30",
            focused: "bg-blue-900/30",
            confused: "bg-orange-900/30",
            tired: "bg-red-900/30"
        };
        return bg[emotion] || "bg-gray-900/30";
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white p-6 pt-20 font-sans">

            {/* Header */}
            <header className="fixed top-0 w-full z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md flex justify-between items-center shadow-lg">
                <Link to="/interview-setup" className="text-xl text-[#fcd34d] hover:text-white transition-colors">
                    ← New Interview
                </Link>
                <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#22c55e] to-[#4ade80] bg-clip-text text-transparent">
                    Interview Feedback
                </h1>
                <p className="text-lg text-gray-400">
                    {config.interviewType || "General"} Interview
                </p>
            </header>

            <main className="container mx-auto px-6 py-4 flex-1">

                {/* Final Report */}
                <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl mb-8">
                    <h2 className="text-3xl font-bold mb-6 text-[#fcd34d] text-center">
                        Final Interview Report
                    </h2>

                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
                            <p className="text-xl text-gray-400 mt-4">Analyzing your interview performance...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/50 border border-red-700 rounded-xl p-6 text-center">
                            <p className="text-red-400 text-xl font-bold">{error}</p>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="mt-4 text-[#fcd34d] hover:text-white"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : finalFeedback ? (
                        <div className="space-y-6">
                            
                            {/* Overall Score */}
                            <div className="text-center bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-400 mb-2">
                                    Overall Score
                                </h3>
                                <p className="text-3xl font-bold text-[#22c55e]">
                                    {finalFeedback.overall_score || `${avgScore}/10`}
                                </p>
                            </div>

                            {/* Your Interview Journey - Overall Summary Paragraph */}
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-lg font-semibold text-[#fcd34d] mb-2">
                                    Your Interview Journey
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    {finalFeedback.overall_summary || finalFeedback.emotion_journey || "You completed the interview and answered all questions. Your responses showed basic understanding of the topics discussed."}
                                </p>
                            </div>

                            {/* Emotional Summary - Separate Paragraph */}
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-lg font-semibold text-purple-400 mb-2">
                                    Emotional Summary
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    {finalFeedback.emotional_summary || "You maintained composure throughout the interview. Your emotional state was generally stable, which helped you deliver consistent answers."}
                                </p>
                            </div>

                            {/* Strengths */}
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-lg font-semibold text-green-400 mb-2">
                                    Strengths
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    {finalFeedback.strengths || "You answered all the questions and stayed engaged throughout the conversation."}
                                </p>
                            </div>

                            {/* Areas for Improvement */}
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-lg font-semibold text-yellow-400 mb-2">
                                    Areas for Improvement
                                </h3>
                                <p className="text-gray-300 leading-relaxed">
                                    {finalFeedback.improvement_areas || "Your answers would benefit from more specific examples and details. Try to share concrete experiences from your work history."}
                                </p>
                            </div>

                            {/* Final Verdict */}
                            {finalFeedback.verdict && (
                                <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                    <h3 className="text-lg font-semibold text-blue-400 mb-2">
                                        Final Verdict
                                    </h3>
                                    <p className="text-gray-300 leading-relaxed">
                                        {finalFeedback.verdict}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">
                            Preparing report...
                        </p>
                    )}
                </div>

                {/* Question-wise Review */}
                <h2 className="text-2xl font-bold text-[#fcd34d] mb-6 border-b border-gray-700 pb-2">
                    Question by Question Review
                </h2>

                <div className="space-y-6">
                    {responses.map((res, index) => (
                        <div
                            key={index}
                            className="bg-[#1e293b] p-6 rounded-2xl shadow-xl border border-[#7c3aed]"
                        >
                            <h3 className="text-lg font-bold text-[#22c55e] mb-3">
                                Question {index + 1}
                            </h3>
                            <p className="text-gray-300 mb-4 italic">
                                {res.question}
                            </p>

                            <div className="bg-[#0f172a] p-4 rounded-lg border border-gray-700 space-y-3">
                                <div>
                                    <p className="text-gray-400 text-sm mb-1">Your Answer:</p>
                                    <p className="text-gray-300">
                                        {res.transcription || "No answer provided"}
                                    </p>
                                </div>

                                {/* Score and Emotion side by side */}
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <p className="text-gray-400 text-sm">Score:</p>
                                        <p className="text-blue-400 font-semibold text-lg">
                                            {res.score || 0}/10
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-sm">Emotion:</p>
                                        <p className={`${getEmotionColor(res.emotion)} font-semibold capitalize text-lg flex items-center gap-2`}>
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${getEmotionBg(res.emotion)}`}>
                                                {res.emotion || "neutral"}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {res.feedback && (
                                    <div className="pt-2 border-t border-gray-700">
                                        <p className="text-gray-400 text-sm mb-1">Feedback:</p>
                                        <p className="text-green-400">
                                            {res.feedback}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700 mt-8">
                <p>© 2025 ResumeRise. All rights reserved.</p>
            </footer>
        </div>
    );
}