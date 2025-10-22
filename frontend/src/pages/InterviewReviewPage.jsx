import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

export default function InterviewReviewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Responses now correctly contain the 'emotion' field, but we must explicitly include it in the payload.
    const responses = location.state?.responses || [];
    const config = location.state?.config || {};
    
    const [finalFeedback, setFinalFeedback] = useState(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false); 

    useEffect(() => {
        if (responses.length === 0 || finalFeedback) {
            return;
        }

        const generateFinalFeedback = async () => {
            setError("");
            setIsLoading(true);

            // --- FIX START: Including the required 'emotion' field in the payload ---
            const payloadResponses = responses.map(res => ({
                question: res.question,
                transcription: res.transcription,
                feedback: res.feedback, 
                emotion: res.emotion || "Neutral", // Added 'emotion' to satisfy backend validation
            }));
            // --- FIX END ---

            const payload = {
                responses: payloadResponses,
                config: config
            };

            const MAX_RETRIES = 5;
            let attempt = 0;

            while (attempt < MAX_RETRIES) {
                try {
                    const response = await axios.post("http://localhost:8000/generate-final-feedback", payload);
                    
                    console.log("SUCCESS: Final feedback response received.", response.data);
                    
                    setFinalFeedback(response.data); 
                    setIsLoading(false); 
                    console.log("Final feedback state successfully updated.");
                    return; 
                } catch (err) {
                    attempt++;
                    
                    if (attempt >= MAX_RETRIES) {
                        console.error("API Error during final feedback generation after retries:", err);
                        
                        let errorMessage = "Failed to load final report. Check the FastAPI server for the /generate-final-feedback endpoint.";
                        
                        if (err.response) {
                            const serverDetail = err.response.data.detail;
                            if (typeof serverDetail === 'string') {
                                errorMessage = `Server Error (${err.response.status}): ${serverDetail}`;
                            } else if (Array.isArray(serverDetail)) {
                                errorMessage = `Validation Error (${err.response.status}): ${serverDetail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(' | ')}`;
                            } else {
                                errorMessage = `Server Error (${err.response.status}): ${err.response.statusText}. Could not parse error details.`;
                            }
                        } else if (err.request) {
                            errorMessage = "Could not connect to the backend (http://localhost:8000). Is the FastAPI server running?";
                        }

                        setError(errorMessage);
                        
                        setFinalFeedback({ 
                            overall_score: "N/A", 
                            strengths: errorMessage, 
                            improvement_areas: "Error loading final report." 
                        }); 
                        setIsLoading(false);
                        break;
                    }

                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        };

        generateFinalFeedback();
    }, [responses, config, navigate, finalFeedback]);


    if (responses.length === 0) {
        return <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
            <p className="text-xl">No interview data found. Please complete an interview first.</p>
            <button className="text-[#fcd34d] mt-4 hover:text-white transition duration-200" onClick={() => navigate('/interview-setup')}>Go to Setup</button>
        </div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white flex flex-col font-sans p-6 pt-20">
            <header className="fixed w-full top-0 left-0 z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md shadow-lg flex justify-between items-center">
                <Link to="/interview-setup" className="text-xl text-[#fcd34d] hover:text-white transition duration-200">
                    &larr; New Interview
                </Link>
                <h1 className="text-3xl font-extrabold text-[#22c55e] tracking-wide">
                    Interview Feedback & Review (Text-Only)
                </h1>
                <p className="text-lg text-gray-400">Role: {config.interviewType || 'N/A'}</p>
            </header>

            <main className="container mx-auto px-6 py-4 flex-1">
                <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl mb-8">
                    <h2 className="text-4xl font-bold mb-4 text-[#fcd34d] text-center">Final Interview Report</h2>
                    
                    {isLoading ? (
                        <div className="text-center">
                            <p className="text-xl text-gray-400 flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#fcd34d]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing all responses and generating final report...
                            </p>
                        </div>
                    ) : error ? (
                        <p className="text-red-400 text-xl font-bold text-center">{error}</p>
                    ) : finalFeedback ? (
                        <div className="space-y-4">
                            <p className="text-2xl font-bold text-[#22c55e] text-center">Overall Score: {finalFeedback.overall_score || 'N/A'}</p> 
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-semibold text-white mb-2">Strengths (Summary Feedback)</h3>
                                <p className="text-gray-300 whitespace-pre-wrap">{finalFeedback.strengths}</p> 
                            </div>
                            <div className="bg-[#0f172a] p-6 rounded-xl border border-gray-700">
                                <h3 className="text-xl font-semibold text-white mb-2">Areas for Improvement</h3>
                                <p className="text-gray-300 whitespace-pre-wrap">{finalFeedback.improvement_areas}</p> 
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500">Preparing to fetch final report...</p>
                    )}
                </div>

                <h2 className="text-3xl font-bold text-[#fcd34d] mb-6 border-b border-gray-700 pb-2">Question-by-Question Review</h2>
                
                <div className="space-y-10">
                    {responses.map((res, index) => (
                        <div key={index} className="bg-[#1e293b] p-6 rounded-3xl shadow-xl border border-[#7c3aed]">
                            <h3 className="text-xl font-bold text-[#22c55e] mb-4">Q{index + 1}: {res.question}</h3>
                            
                            <div className="space-y-4">
                                {/* Transcribed Answer */}
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-2">Your Transcribed Answer:</h4>
                                    <div className="bg-[#0f172a] p-4 rounded-lg min-h-[100px] shadow-inner border border-gray-700">
                                        <p className="text-gray-300 italic whitespace-pre-wrap">{res.transcription}</p>
                                    </div>
                                </div>

                                {/* AI Feedback */}
                                <div>
                                    <div className="p-4 bg-[#22c55e]/10 border-l-4 border-[#22c55e] rounded-lg">
                                        <h4 className="text-white font-semibold mb-2">AI Feedback:</h4>
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                            {res.feedback || "Feedback is pending or missing from the per-question analysis."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
            
            <footer className="bg-[#1e293b] text-gray-400 py-6 text-center border-t border-gray-700 mt-8">
                © 2025 ResumeRise. All rights reserved.
            </footer>
        </div>
    );
}
