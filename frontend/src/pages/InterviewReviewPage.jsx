import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

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
            setError(""); setIsLoading(true);

            const payloadResponses = responses.map(r => ({
                question: r.question,
                transcription: r.transcription,
                emotion: r.emotion || "",
                feedback: r.feedback || ""
            }));

            const payload = { responses: payloadResponses, config };

            const MAX_RETRIES = 5;
            let attempt = 0;

            while (attempt < MAX_RETRIES) {
                try {
                    const res = await axios.post("http://localhost:8000/generate-final-feedback", payload);
                    setFinalFeedback(res.data); setIsLoading(false); return;
                } catch (err) {
                    attempt++;
                    if (attempt >= MAX_RETRIES) {
                        const msg = err.response?.data?.detail || "Failed to generate report.";
                        setError(msg);
                        setFinalFeedback({
                            overall_score: "N/A",
                            strengths: msg,
                            improvement_areas: "Could not generate final report."
                        });
                        setIsLoading(false);
                        break;
                    }
                    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
                }
            }
        };

        generateFinalReport();
    }, [responses, config, finalFeedback]);

    if (!responses.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
                <p className="text-xl">No interview data found. Please complete an interview first.</p>
                <button onClick={() => navigate('/interview-setup')} className="mt-4 text-[#fcd34d] hover:text-white">Go to Setup</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white p-6 pt-20 font-sans">
            <header className="fixed top-0 w-full z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md flex justify-between items-center shadow-lg">
                <Link to="/interview-setup" className="text-xl text-[#fcd34d] hover:text-white">← New Interview</Link>
                <h1 className="text-3xl font-extrabold text-[#22c55e]">Interview Feedback & Review (Text-Only)</h1>
                <p className="text-lg text-gray-400">Role: {config.interviewType || "N/A"}</p>
            </header>

            <main className="container mx-auto px-6 py-4 flex-1">
                <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl mb-8">
                    <h2 className="text-4xl font-bold mb-4 text-[#fcd34d] text-center">Final Interview Report</h2>
                    {isLoading ? (
                        <div className="text-center text-xl text-gray-400">Analyzing responses...</div>
                    ) : error ? (
                        <p className="text-red-400 text-xl font-bold text-center">{error}</p>
                    ) : finalFeedback ? (
                        <div className="space-y-4">
                            <p className="text-2xl font-bold text-[#22c55e] text-center">Overall Score: {finalFeedback.overall_score}</p>
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-semibold text-white mb-2">Strengths</h3>
                                <p className="text-gray-300 whitespace-pre-wrap">{finalFeedback.strengths}</p>
                            </div>
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-semibold text-white mb-2">Areas for Improvement</h3>
                                <p className="text-gray-300 whitespace-pre-wrap">{finalFeedback.improvement_areas}</p>
                            </div>
                        </div>
                    ) : <p className="text-center text-gray-500">Preparing report...</p>}
                </div>

                <h2 className="text-3xl font-bold text-[#fcd34d] mb-6 border-b border-gray-700 pb-2">Question-by-Question Review</h2>
                <div className="space-y-10">
                    {responses.map((res, index) => (
                        <div key={index} className="bg-[#1e293b] p-6 rounded-3xl shadow-xl border border-[#7c3aed]">
                            <h3 className="text-xl font-bold text-[#22c55e] mb-4">Q{index + 1}: {res.question}</h3>
                            <div className="bg-[#0f172a] p-4 rounded-lg min-h-[100px] border border-gray-700 shadow-inner">
                                <p className="text-gray-300 italic whitespace-pre-wrap">{res.transcription}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700 mt-8">© 2025 ResumeRise. All rights reserved.</footer>
        </div>
    );
}
