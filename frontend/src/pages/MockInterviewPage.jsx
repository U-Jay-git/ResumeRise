import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

// Use environment variable for API URL, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export default function MockInterviewPage() {
    const navigate = useNavigate();
    const location = useLocation();

    // State Management
    const [currentQuestion, setCurrentQuestion] = useState("");
    const [textualAnswer, setTextualAnswer] = useState("");
    const [interviewResponses, setInterviewResponses] = useState([]);
    const [conversation, setConversation] = useState([]);
    const [aiMessage, setAiMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [sessionId, setSessionId] = useState(null);
    const [emotionDisplay, setEmotionDisplay] = useState(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showEmotionIndicator, setShowEmotionIndicator] = useState(false);
    const [questionCounter, setQuestionCounter] = useState(0);
    const [isCapturingFrames, setIsCapturingFrames] = useState(false);

    // Refs
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);
    const frameCaptureIntervalRef = useRef(null);
    const capturedFramesRef = useRef([]);

    // Constants
    const MAX_QUESTIONS = 5;
    const FRAME_CAPTURE_INTERVAL = 5000;

    // Load Interview Configuration
    useEffect(() => {
        const loadInterviewConfig = async () => {
            try {
                const storedConfig = sessionStorage.getItem("interviewConfig");
                const interviewConfig = location.state?.config || 
                    (storedConfig ? JSON.parse(storedConfig) : {});
                
                const storedQuestions = sessionStorage.getItem("interviewQuestions");
                let questions = [];
                
                if (storedQuestions) {
                    questions = JSON.parse(storedQuestions);
                } else if (location.state?.questions) {
                    questions = location.state.questions;
                }
                
                if (questions && questions.length > 0) {
                    const firstQ = typeof questions[0] === "object" ? questions[0].question : questions[0];
                    setCurrentQuestion(firstQ);
                } else {
                    setCurrentQuestion("Tell me about yourself and your professional background.");
                }
                
                if (!storedConfig) {
                    sessionStorage.setItem("interviewConfig", JSON.stringify(interviewConfig));
                }
                
                setSessionId(Date.now().toString());
                
            } catch (err) {
                console.error("Failed to start interview:", err);
                setError("Failed to initialize interview. Please try again.");
                setCurrentQuestion("Tell me about yourself and your professional background.");
            }
        };
        
        loadInterviewConfig();
    }, [location.state]);

    // Initialize Camera and Microphone
    useEffect(() => {
        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                
                streamRef.current = stream;
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraReady(true);
                }
                
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length === 0) {
                    setError("No microphone detected. Please check your audio input.");
                }
                
            } catch (err) {
                console.error("Camera/Microphone error:", err);
                setError("Camera or microphone permission denied. Please allow access to continue.");
                setIsCameraReady(false);
            }
        };
        
        initCamera();
        
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
            if (frameCaptureIntervalRef.current) {
                clearInterval(frameCaptureIntervalRef.current);
            }
        };
    }, []);

    // Recording Timer
    useEffect(() => {
        if (isRecording) {
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        }
        
        return () => {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, [isRecording]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Capture Single Frame
    const captureFrame = async () => {
        if (!videoRef.current || !isCameraReady) return null;
        
        try {
            const canvas = document.createElement("canvas");
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            
            const ctx = canvas.getContext("2d");
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8));
            return blob;
        } catch (err) {
            console.error("Frame capture error:", err);
            return null;
        }
    };

    // Start Capturing Frames Every 5 Seconds
    const startCapturingFrames = () => {
        capturedFramesRef.current = [];
        setIsCapturingFrames(true);
        
        captureFrame().then(frame => {
            if (frame) capturedFramesRef.current.push(frame);
        });
        
        frameCaptureIntervalRef.current = setInterval(async () => {
            if (isCapturingFrames) {
                const frame = await captureFrame();
                if (frame) {
                    capturedFramesRef.current.push(frame);
                }
            }
        }, FRAME_CAPTURE_INTERVAL);
    };

    // Stop Capturing Frames
    const stopCapturingFrames = () => {
        setIsCapturingFrames(false);
        if (frameCaptureIntervalRef.current) {
            clearInterval(frameCaptureIntervalRef.current);
            frameCaptureIntervalRef.current = null;
        }
    };

    // Audio Recording Controls
    const startRecording = () => {
        if (!streamRef.current) {
            setError("Microphone not available. Please check permissions.");
            return;
        }
        
        try {
            const audioStream = new MediaStream(streamRef.current.getAudioTracks());
            const recorder = new MediaRecorder(audioStream, {
                mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
            });
            
            chunksRef.current = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                if (chunksRef.current.length > 0) {
                    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
                    recorderRef.current = { audioBlob };
                    setTextualAnswer("Processing audio...");
                }
            };
            
            recorder.start(1000);
            recorderRef.current = { recorder, audioBlob: null };
            setIsRecording(true);
            setError("");
            startCapturingFrames();
            
        } catch (err) {
            console.error("Recording error:", err);
            setError("Failed to start recording. Please check your microphone.");
        }
    };

    const stopRecording = () => {
        if (recorderRef.current && recorderRef.current.recorder) {
            recorderRef.current.recorder.stop();
            setIsRecording(false);
            stopCapturingFrames();
        }
    };

    // Analyze Facial Expressions
    const analyzeFacialExpressions = async () => {
        if (capturedFramesRef.current.length === 0) {
            return null;
        }
        
        try {
            const formData = new FormData();
            
            for (let i = 0; i < capturedFramesRef.current.length; i++) {
                formData.append("images", capturedFramesRef.current[i], `frame_${i}.jpg`);
            }
            
            const faceResponse = await axios.post(`${API_BASE_URL}/face-emotion-batch`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            
            return faceResponse.data;
        } catch (err) {
            console.error("Face analysis error:", err);
            return null;
        }
    };

    // Generate Next Question
    const generateNextQuestion = async (finalText, analysisData, faceAnalysisData) => {
        try {
            const updatedConversation = [
                ...conversation,
                {
                    question: currentQuestion,
                    transcription: finalText,
                    emotion: faceAnalysisData?.face_emotion || analysisData.emotion,
                    score: analysisData.score,
                    feedback: analysisData.feedback,
                    face_analysis: faceAnalysisData?.face_analysis || "",
                    timestamp: new Date().toISOString()
                }
            ];
            
            setConversation(updatedConversation);
            
            const storedConfig = sessionStorage.getItem("interviewConfig");
            const interviewConfig = storedConfig ? JSON.parse(storedConfig) : {};
            
            const nextQResponse = await axios.post(`${API_BASE_URL}/next-question`, {
                interview_history: updatedConversation,
                interview_type: interviewConfig.interviewType || "General",
                job_role: interviewConfig.jobRole || null,
                difficulty: interviewConfig.difficulty || "medium"
            });
            
            setCurrentQuestion(nextQResponse.data.question);
            setAiMessage(nextQResponse.data.affirmation || "");
            setQuestionCounter(prev => prev + 1);
            
            recorderRef.current = null;
            chunksRef.current = [];
            capturedFramesRef.current = [];
            setTextualAnswer("");
            
        } catch (err) {
            console.error("Next question generation error:", err);
            setError("Failed to generate next question. Please try again.");
            
            const fallbackQuestions = [
                "Can you tell me more about your experience?",
                "What specific skills do you bring to this role?",
                "Describe a challenging project you worked on.",
                "How do you handle pressure or tight deadlines?"
            ];
            const randomFallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
            setCurrentQuestion(randomFallback);
        }
    };

    // Submit Answer for Analysis
    const handleSubmitAnswer = async () => {
        if (!textualAnswer.trim() && !recorderRef.current?.audioBlob) {
            setError("Please provide an answer (type or record audio) before submitting.");
            return;
        }
        
        setError("");
        setIsLoading(true);
        setEmotionDisplay(null);
        
        try {
            let finalText = textualAnswer;
            let audioEmotion = "neutral";
            
            // Step 1: Transcribe audio if available
            const audioBlob = recorderRef.current?.audioBlob;
            if (audioBlob) {
                const formData = new FormData();
                formData.append("file", audioBlob, "audio.webm");
                
                const transcribeResponse = await axios.post(`${API_BASE_URL}/transcribe-audio`, formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });
                
                finalText = transcribeResponse.data.text;
                audioEmotion = transcribeResponse.data.audio_emotion;
                setTextualAnswer(finalText);
            }
            
            // Step 2: Analyze captured face frames
            let faceAnalysisData = null;
            if (capturedFramesRef.current.length > 0) {
                faceAnalysisData = await analyzeFacialExpressions();
            }
            
            // Step 3: Submit for scoring
            const storedConfig = sessionStorage.getItem("interviewConfig");
            const interviewConfig = storedConfig ? JSON.parse(storedConfig) : {};
            
            const analysisResponse = await axios.post(`${API_BASE_URL}/submit-response`, {
                question_text: currentQuestion,
                response_text: finalText,
                audio_emotion: audioEmotion,
                face_emotion: faceAnalysisData?.face_emotion || "neutral",
                interview_type: interviewConfig.interviewType || "General",
                response_time_seconds: recordingTime
            });
            
            const analysisData = analysisResponse.data;
            
            const displayEmotion = faceAnalysisData?.face_emotion || analysisData.emotion;
            setEmotionDisplay(displayEmotion);
            
            setShowEmotionIndicator(true);
            setTimeout(() => setShowEmotionIndicator(false), 3000);
            
            // Store response (score saved but NOT displayed)
            const updatedResponses = [
                ...interviewResponses,
                {
                    question: currentQuestion,
                    transcription: finalText,
                    emotion: displayEmotion,
                    feedback: analysisData.feedback,
                    score: analysisData.score,
                    audio_emotion: audioEmotion,
                    face_emotion: faceAnalysisData?.face_emotion || "neutral",
                    face_analysis: faceAnalysisData?.face_analysis || "",
                    timestamp: new Date().toISOString()
                }
            ];
            
            setInterviewResponses(updatedResponses);
            
            // End interview if max questions reached
            if (updatedResponses.length >= MAX_QUESTIONS) {
                sessionStorage.setItem("interviewResponses", JSON.stringify(updatedResponses));
                navigate("/interview-review", {
                    state: {
                        responses: updatedResponses,
                        config: interviewConfig,
                        sessionId: sessionId
                    }
                });
                return;
            }
            
            // Generate next question
            await generateNextQuestion(finalText, analysisData, faceAnalysisData);
            
        } catch (err) {
            console.error("Submission error:", err);
            setError(err.response?.data?.detail || "Failed to process your answer. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // End Interview
    const handleEndInterview = () => {
        if (interviewResponses.length === 0) {
            setError("No responses recorded. Please answer at least one question before ending.");
            return;
        }
        
        const storedConfig = sessionStorage.getItem("interviewConfig");
        const interviewConfig = storedConfig ? JSON.parse(storedConfig) : {};
        
        navigate("/interview-review", {
            state: {
                responses: interviewResponses,
                config: interviewConfig,
                sessionId: sessionId,
                earlyEnd: true
            }
        });
    };

    const getEmotionColor = (emotion) => {
        const colors = {
            confident: "text-green-400",
            nervous: "text-yellow-400",
            neutral: "text-gray-400",
            enthusiastic: "text-purple-400",
            focused: "text-blue-400",
            confused: "text-orange-400"
        };
        return colors[emotion] || "text-white";
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] text-white">
            
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur-md shadow-lg z-50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <Link to="/interview-setup" className="text-yellow-400 hover:text-yellow-300 transition-colors">
                        ← Exit Interview
                    </Link>
                    
                    <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        Mock Interview
                    </h1>
                    
                    <div className="flex items-center gap-4">
                        <div className="bg-[#0f172a] px-4 py-2 rounded-full">
                            <span className="text-green-400 font-bold">
                                {interviewResponses.length}/{MAX_QUESTIONS}
                            </span>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto px-6 pt-24 pb-12">
                
                {/* Camera Feed */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-80 rounded-2xl border-4 border-[#1e293b] shadow-2xl"
                        />
                        {!isCameraReady && (
                            <div className="absolute inset-0 bg-black/80 rounded-2xl flex items-center justify-center">
                                <p className="text-yellow-400 text-center px-4">
                                    Camera permission required
                                </p>
                            </div>
                        )}
                        
                        {isRecording && (
                            <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1 rounded-full">
                                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                                <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                            </div>
                        )}
                        
                        {isCapturingFrames && (
                            <div className="absolute bottom-2 right-2 bg-blue-600/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs">
                                Frames: {capturedFramesRef.current.length}
                            </div>
                        )}
                        
                        {showEmotionIndicator && emotionDisplay && (
                            <div className={`absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1 rounded-full ${getEmotionColor(emotionDisplay)}`}>
                                <span className="font-semibold capitalize">{emotionDisplay}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Current Question */}
                <div className="question-container bg-[#1e293b] rounded-2xl p-8 mb-6 shadow-xl border border-[#334155]">
                    <p className="text-sm text-green-400 mb-2">Question {questionCounter + 1}:</p>
                    <p className="text-xl leading-relaxed">{currentQuestion || "Loading..."}</p>
                </div>
                
                {/* AI Message */}
                {aiMessage && (
                    <div className="bg-green-900/50 border border-green-700 rounded-xl p-4 mb-6 text-center">
                        <p className="text-green-300">{aiMessage}</p>
                    </div>
                )}
                
                {/* NO SCORE DISPLAY HERE - Removed intentionally */}
                
                {/* Answer Input */}
                <div className="bg-[#1e293b] rounded-2xl p-6 mb-6 shadow-xl">
                    <label className="block text-sm font-medium text-gray-400 mb-3">
                        Your Answer (Type or Speak)
                    </label>
                    <textarea
                        value={textualAnswer}
                        onChange={(e) => setTextualAnswer(e.target.value)}
                        className="w-full p-4 bg-[#0f172a] border border-[#334155] rounded-xl text-white focus:border-green-500 focus:outline-none transition-colors"
                        rows={6}
                        placeholder="Type your answer here or click 'Start Recording' to speak..."
                        disabled={isLoading}
                    />
                </div>
                
                {/* Buttons */}
                <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {!isRecording ? (
                        <button
                            onClick={startRecording}
                            disabled={isLoading || !isCameraReady}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-8 py-3 rounded-xl font-semibold transition-all"
                        >
                            Start Recording
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-xl font-semibold transition-all"
                        >
                            Stop Recording
                        </button>
                    )}
                    
                    <button
                        onClick={handleSubmitAnswer}
                        disabled={isLoading || (!textualAnswer.trim() && !recorderRef.current?.audioBlob)}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-8 py-3 rounded-xl font-semibold transition-all"
                    >
                        {isLoading ? "Analyzing..." : "Submit Answer"}
                    </button>
                    
                    <button
                        onClick={handleEndInterview}
                        disabled={isLoading}
                        className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-8 py-3 rounded-xl font-semibold transition-all"
                    >
                        End Interview
                    </button>
                </div>
                
                {/* Info Box */}
                <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4 mb-6">
                    <p className="text-blue-300 text-sm text-center">
                        Your camera captures a frame every 5 seconds during your answer to analyze facial expressions.
                    </p>
                </div>
                
                {/* Error */}
                {error && (
                    <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-center">
                        <p className="text-red-300">{error}</p>
                    </div>
                )}
                
                {/* Progress Bar */}
                <div className="mt-8">
                    <div className="bg-[#1e293b] rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${(interviewResponses.length / MAX_QUESTIONS) * 100}%` }}
                        />
                    </div>
                    <p className="text-sm text-gray-400 text-center mt-2">
                        Question {interviewResponses.length + 1} of {MAX_QUESTIONS}
                    </p>
                </div>
                
            </main>
        </div>
    );
}