import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

// This component handles the mock interview process in a text-only mode, 
// allowing the user to type answers and submitting them to the backend for AI analysis.

export default function MockInterviewPage() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // --- State and Config Initialization ---
    
    // Fallback: Read from sessionStorage in case location.state is lost (e.g., page refresh)
    const storedQuestions = sessionStorage.getItem('interviewQuestions');
    const storedConfig = sessionStorage.getItem('interviewConfig');
    
    // Data passed from the setup page: prioritize location.state, fall back to sessionStorage
    const initialQuestions = location.state?.questions 
        || (storedQuestions ? JSON.parse(storedQuestions) : []);
    const interviewConfig = location.state?.config 
        || (storedConfig ? JSON.parse(storedConfig) : {});

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [textualAnswer, setTextualAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [statusMessage, setStatusMessage] = useState("Type your answer and press Submit.");
    
    // Stores the results for the final review page
    const [interviewResponses, setInterviewResponses] = useState([]);

    // Get the current question safely using the index
    const currentQuestion = initialQuestions[currentQuestionIndex];

    // --- Validation and Fallback ---

    useEffect(() => {
        // Validation check to ensure questions exist
        if (initialQuestions.length === 0) {
            if (!error) {
                setError("No questions loaded. Redirecting to setup...");
                setTimeout(() => navigate('/interview-setup'), 2000);
            }
            return;
        }
        // Save to session storage for resilience on refresh
        sessionStorage.setItem('interviewQuestions', JSON.stringify(initialQuestions));
        sessionStorage.setItem('interviewConfig', JSON.stringify(interviewConfig));
    }, [initialQuestions.length, navigate, error]);

    // --- Backend Submission Logic (Text) ---

    /**
     * Sends the textual answer and question context to the backend for AI processing.
     */
    const handleSubmitTextResponse = async () => {
        if (!currentQuestion || textualAnswer.trim().length === 0) {
            setError("Please type an answer before submitting.");
            return;
        }

        setIsLoading(true);
        setError("");
        setStatusMessage("Analyzing response with AI...");

        // **CRITICAL FIXES APPLIED HERE**
        // 1. Used FormData as the server expects Form inputs (Form(...))
        // 2. Used the correct server key: 'response_text'
        // 3. Used the correct server endpoint: '/submit-response'
        const formData = new FormData();
        formData.append('question_text', currentQuestion);
        formData.append('interview_type', interviewConfig.interviewType || "General");
        formData.append('response_text', textualAnswer.trim()); // The key the FastAPI server expects

        const apiUrl = "http://localhost:8000/submit-response"; // Corrected endpoint

        try {
            // Send the FormData to the backend for analysis. 
            // Axios handles the Content-Type automatically for FormData, no manual header needed.
            const response = await axios.post(apiUrl, formData);

            const backendData = response.data; 

            // Structure the response data for review page navigation
            const newResponse = { 
                question: currentQuestion, 
                textualAnswer: textualAnswer.trim(), // Stored for review
                transcription: backendData.transcription, // Will contain the submitted text from backend
                emotion: backendData.emotion, // Placeholder from backend
                feedback: backendData.feedback
            };

            const updatedResponses = [...interviewResponses, newResponse];
            setInterviewResponses(updatedResponses);
            
            const nextIndex = currentQuestionIndex + 1;
            
            // Prepare for the next question or finish
            if (nextIndex < initialQuestions.length) {
                setCurrentQuestionIndex(nextIndex);
                setTextualAnswer(''); // Clear input for the next question
                setStatusMessage("Ready for the next question. Type your answer and press Submit.");
            } else {
                // Last question answered, navigate to the final review/feedback stage
                navigate("/interview-review", { 
                    state: { 
                        responses: updatedResponses,
                        config: interviewConfig
                    } 
                });
            }
        } catch (err) {
            console.error("API Error during response submission:", err);
            
            let errorMessage = "An unexpected error occurred while processing your response.";
            if (err.response) {
                if (err.response.data && err.response.data.detail) {
                    errorMessage = `Server Error: ${err.response.data.detail}`;
                } else {
                    errorMessage = `Server Error: Status ${err.response.status}.`;
                }
            } else if (err.request) {
                errorMessage = "Could not connect to the analysis server (http://localhost:8000). Is the FastAPI server running?";
            }
            
            setError(errorMessage);
            setStatusMessage("Submission failed. Please check the console and server status.");

        } finally {
            setIsLoading(false);
        }
    };


    // --- Interview Completion ---

    const handleStopInterview = () => {
        // Navigate to review immediately 
        navigate("/interview-review", { state: { responses: interviewResponses, config: interviewConfig } });
    };

    if (initialQuestions.length === 0 && !error) {
        // Fallback state if questions aren't loaded correctly
        return <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] text-white">
            <p className="text-xl">Interview not configured. Redirecting to setup...</p>
            <button className="text-[#fcd34d] mt-4" onClick={() => navigate('/interview-setup')}>Go to Setup</button>
        </div>;
    }

    // --- Component UI ---

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white flex flex-col font-sans p-6 pt-20">
            {/* Fixed Header */}
            <header className="fixed w-full top-0 left-0 z-50 px-10 py-4 bg-[#1e293b]/90 backdrop-blur-md shadow-lg flex justify-between items-center">
                <Link to="/interview-setup" className="text-xl text-[#fcd34d] hover:text-white transition">
                    &larr; Exit
                </Link>
                <h1 className="text-3xl font-extrabold text-[#22c55e] tracking-wide">
                    Text-Based Mock Interview
                </h1>
                <p className="text-lg text-gray-400">Q: {currentQuestionIndex + 1} / {initialQuestions.length}</p>
            </header>

            <main className="flex-1 flex flex-col gap-6 container mx-auto pt-4">
                
                {/* Interview Interface - Centered Content */}
                <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
                    
                    {/* Question Area */}
                    <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl space-y-4">
                        <h2 className="text-3xl font-bold text-[#22c55e]">
                            AI Interviewer:
                        </h2>
                        <div className="bg-[#0f172a] p-6 rounded-xl min-h-[120px] flex items-center shadow-inner">
                            <p className="text-xl text-white italic leading-relaxed">
                                {currentQuestion ? currentQuestion : "Please wait, loading next question..."}
                            </p>
                        </div>
                    </div>

                    {/* Answer Input Area */}
                    <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl space-y-4">
                        <h2 className="text-3xl font-bold text-[#fcd34d]">Your Answer:</h2>
                        <textarea
                            value={textualAnswer}
                            onChange={(e) => setTextualAnswer(e.target.value)}
                            disabled={isLoading || !currentQuestion}
                            placeholder="Type your response here..."
                            rows={10}
                            className="w-full p-4 bg-[#0f172a] text-white rounded-xl border-2 border-gray-600 focus:border-[#7c3aed] focus:outline-none resize-none text-lg shadow-inner transition duration-150"
                        />
                    </div>
                    
                    {/* Status Message */}
                    <div className="p-4 bg-gray-700 rounded-lg shadow-inner max-w-xl mx-auto">
                        <p className="font-semibold text-sm mb-1 text-white">Status:</p>
                        <p className="text-gray-300 min-h-[20px] text-lg">
                            {isLoading ? "Analyzing Response with AI..." : statusMessage}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-center gap-6 w-full mt-4 mb-8">
                        <button
                            onClick={handleSubmitTextResponse}
                            disabled={isLoading || !currentQuestion || textualAnswer.trim().length === 0}
                            className={`flex-1 max-w-sm py-4 text-xl font-bold rounded-xl shadow-xl transition duration-300 transform hover:-translate-y-1 ${
                                isLoading 
                                    ? 'bg-gray-600' 
                                    : 'bg-[#7c3aed] hover:bg-[#fcd34d] hover:text-black'
                            } disabled:opacity-50 disabled:pointer-events-none`}
                        >
                            {isLoading
                                ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing Response...
                                    </span>
                                )
                                : "Submit Answer"}
                        </button>
                        
                        <button
                            onClick={handleStopInterview}
                            disabled={isLoading}
                            className="flex-1 max-w-xs py-4 text-lg font-bold rounded-xl bg-gray-500 hover:bg-gray-600 transition duration-300 shadow-xl disabled:opacity-50"
                        >
                            End Interview & Get Feedback
                        </button>
                    </div>

                    {error && <p className="text-red-400 text-center font-bold bg-red-900/50 p-3 rounded-lg border border-red-700 max-w-4xl mx-auto">{error}</p>}
                </div>
            </main>
        </div>
    );
}
