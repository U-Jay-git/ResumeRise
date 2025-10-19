import React from "react";
import { ArrowRight } from "lucide-react"; // optional icon (if lucide-react installed)

export default function ResumePage() {
  const openResumeBuilder = () => {
    // 👉 You can change the link below to any other platform if you prefer
    window.open("https://rxresu.me", "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 text-gray-800 px-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-xl text-center border border-gray-200">
        <h1 className="text-4xl font-extrabold text-blue-700 mb-4">
          Build Your Professional Resume
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Create a stunning resume in minutes using a free and open-source platform.
        </p>

        <button
          onClick={openResumeBuilder}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
        >
          Start Creating
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-sm text-gray-500 mt-6">
          Powered by <a href="https://rxresu.me" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">Reactive Resume</a>
        </p>
      </div>
    </div>
  );
}
