import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="bg-gradient-to-b from-[#0f172a] to-[#4c1d95] text-white min-h-screen flex flex-col font-sans">
      
      {/* Dynamic Header */}
      <header
        className={`fixed w-full z-50 px-10 py-4 flex justify-between items-center transition-all duration-300 ${
          isScrolled ? "bg-[#1e293b]/90 backdrop-blur-md shadow-lg" : "bg-transparent"
        }`}
      >
        <h1 className="text-3xl font-extrabold text-[#22c55e] tracking-wide transition-colors duration-300">
          ResumeRise
        </h1>
        <nav className="space-x-8 hidden md:flex text-lg">
          <a href="#home" className="hover:text-[#fcd34d] transition">Home</a>
          <a href="#purpose" className="hover:text-[#fcd34d] transition">Purpose</a>
          <a href="#about" className="hover:text-[#fcd34d] transition">About</a>
        </nav>
        <div className="w-10 h-10 bg-[#22c55e] rounded-full border-2 border-[#fcd34d]" />
      </header>

      {/* Hero Section */}
      <section id="home" className="h-screen flex flex-col justify-center items-center text-center px-6 relative pt-20">
        <h2 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight animate-fade-in">
          ResumeRise
        </h2>
        <p className="text-lg md:text-2xl text-gray-300 mb-8 max-w-3xl animate-fade-in delay-200">
          AI-powered Resume Matching & Mock Interviews. Discover your strengths, improve your skills, and land your dream job faster.
        </p>
        <div className="flex space-x-6 animate-fade-in delay-400">
          <Link to="/resume-match">
            <button className="bg-[#2563eb] hover:bg-[#fcd34d] text-xl px-8 py-4 rounded-lg shadow-xl hover:shadow-[#fcd34d]/50 transition duration-300 transform hover:-translate-y-1">
              Resume Match
            </button>
          </Link>
          <Link to="/mock-interview">
            <button className="bg-[#7c3aed] hover:bg-[#fcd34d] text-xl px-8 py-4 rounded-lg shadow-xl hover:shadow-[#fcd34d]/50 transition duration-300 transform hover:-translate-y-1">
              Mock Interviews
            </button>
          </Link>
        </div>
      </section>

      {/* Purpose Section */}
      <section id="purpose" className="px-10 py-20 bg-[#1e293b]">
        <h3 className="text-4xl font-bold mb-12 text-center text-[#22c55e]">Choose Your Purpose</h3>
        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Resume Matching Card */}
          <div className="bg-[#0f172a] p-10 rounded-2xl shadow-lg hover:shadow-[#fcd34d]/40 transition transform hover:scale-105 relative overflow-hidden">
            <h4 className="text-3xl font-bold mb-4 text-[#2563eb]">📄 Resume Matching</h4>
            <p className="text-gray-300 mb-8 text-lg">
              Upload your resume, compare it with job descriptions, and discover matched & missing skills instantly.
            </p>
            <Link to="/resume-match">
              <button className="bg-[#2563eb] hover:bg-[#fcd34d] w-full py-3 text-lg rounded-lg shadow-md transition duration-200">
                Start Matching
              </button>
            </Link>
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#2563eb]/20 rounded-full blur-3xl" />
          </div>

          {/* Mock Interviews Card */}
          <div className="bg-[#0f172a] p-10 rounded-2xl shadow-lg hover:shadow-[#fcd34d]/40 transition transform hover:scale-105 relative overflow-hidden">
            <h4 className="text-3xl font-bold mb-4 text-[#7c3aed]">🎤 Mock Interviews</h4>
            <p className="text-gray-300 mb-8 text-lg">
              Practice with AI-driven interviews and get instant feedback on confidence, tone, and clarity.
            </p>
            <Link to="/mock-interview">
              <button className="bg-[#7c3aed] hover:bg-[#fcd34d] w-full py-3 text-lg rounded-lg shadow-md transition duration-200">
                Start Interview
              </button>
            </Link>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#7c3aed]/20 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-10 py-20 bg-[#0f172a] text-center">
        <h3 className="text-4xl font-bold mb-6 text-[#22c55e]">About ResumeRise</h3>
        <p className="text-gray-300 max-w-4xl mx-auto leading-relaxed text-lg">
          ResumeRise is your AI-powered career companion. We help job seekers bridge the gap between resumes and job descriptions, while also preparing them for interviews with realistic simulations. Our goal is to provide insights, confidence, and tools to help you land your dream job faster.
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-[#1e293b] text-gray-400 text-sm py-6 px-8 text-center border-t border-gray-700">
        © 2025 ResumeRise. All rights reserved.
      </footer>

      {/* Tailwind Animations */}
      <style>
        {`
          .animate-fade-in {
            opacity: 0;
            animation: fadeIn 1s forwards;
          }
          .animate-fade-in.delay-200 {
            animation-delay: 0.2s;
          }
          .animate-fade-in.delay-400 {
            animation-delay: 0.4s;
          }
          @keyframes fadeIn {
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
