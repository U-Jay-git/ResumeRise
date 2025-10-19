import React, { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// --- Templates Preview ---
function TemplatePreview({ name, onClick, selected, children }) {
  return (
    <div
      onClick={onClick}
      className={`border rounded-xl p-4 m-2 cursor-pointer hover:shadow-lg ${
        selected ? "border-blue-600 shadow-lg" : "border-gray-300"
      }`}
    >
      <h2 className="font-bold mb-2">{name}</h2>
      {children}
    </div>
  );
}

function ModernTemplate({ data }) {
  return (
    <div className="p-4 border rounded-xl bg-white text-gray-800">
      <h1 className="text-2xl font-bold text-blue-700">{data.name || "Your Name"}</h1>
      <p>{data.title || "Your Title"}</p>
      <hr className="my-2" />
      <p>{data.email || "email@example.com"}</p>
      <p>{data.phone || "+91-0000000000"}</p>
      <p>{data.education || "Education"}</p>
      <p>{data.experience || "Experience"}</p>
      <p>{data.skills || "Skills"}</p>
    </div>
  );
}

function MinimalistTemplate({ data }) {
  return (
    <div className="p-4 border-l-4 border-blue-600 bg-gray-50 text-gray-900">
      <h1 className="text-xl font-bold">{data.name || "Your Name"}</h1>
      <p>{data.title || "Your Title"}</p>
      <p>{data.email || "email@example.com"} | {data.phone || "+91-0000000000"}</p>
      <p>{data.education || "Education"}</p>
      <p>{data.experience || "Experience"}</p>
      <p>{data.skills || "Skills"}</p>
    </div>
  );
}

function ProfessionalTemplate({ data }) {
  return (
    <div className="p-4 border rounded-xl shadow bg-white">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.name || "Your Name"}</h1>
          <p>{data.title || "Your Title"}</p>
        </div>
        <div className="text-sm text-gray-700">
          <p>{data.email || "email@example.com"}</p>
          <p>{data.phone || "+91-0000000000"}</p>
        </div>
      </div>
      <p>{data.education || "Education"}</p>
      <p>{data.experience || "Experience"}</p>
      <p>{data.skills || "Skills"}</p>
    </div>
  );
}

// --- Main Component ---
export default function ResumeBuilder() {
  const [step, setStep] = useState(1); // 1 = choose template, 2 = fill form
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    education: "",
    experience: "",
    skills: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const downloadPDF = () => {
    const resume = document.getElementById("resume-preview");
    html2canvas(resume, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`${formData.name || "Resume"}.pdf`);
    });
  };

  // --- Template Options to Choose ---
  const templates = [
    { name: "Modern", component: ModernTemplate },
    { name: "Minimalist", component: MinimalistTemplate },
    { name: "Professional", component: ProfessionalTemplate },
  ];

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold mb-4">Choose Your Resume Template</h1>
          <div className="flex flex-wrap">
            {templates.map((t) => (
              <TemplatePreview
                key={t.name}
                name={t.name}
                selected={selectedTemplate === t.name}
                onClick={() => setSelectedTemplate(t.name)}
              >
                {React.createElement(t.component, { data: {} })}
              </TemplatePreview>
            ))}
          </div>
          {selectedTemplate && (
            <button
              onClick={() => setStep(2)}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Next: Fill Your Resume
            </button>
          )}
        </>
      )}

      {step === 2 && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Form */}
          <div className="w-full md:w-1/2 bg-white p-6 rounded-xl shadow-md border">
            <h1 className="text-2xl font-bold mb-4 text-blue-700">Fill Your Resume</h1>
            {["name", "title", "email", "phone", "education", "experience", "skills"].map((field) => (
              <div className="mb-3" key={field}>
                <label className="block font-medium mb-1">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                <input
                  type="text"
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            ))}

            <button
              onClick={downloadPDF}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Download PDF
            </button>
          </div>

          {/* Right: Preview */}
          <div id="resume-preview" className="w-full md:w-1/2 bg-white p-6 rounded-xl shadow-md border">
            {selectedTemplate === "Modern" && <ModernTemplate data={formData} />}
            {selectedTemplate === "Minimalist" && <MinimalistTemplate data={formData} />}
            {selectedTemplate === "Professional" && <ProfessionalTemplate data={formData} />}
          </div>
        </div>
      )}
    </div>
  );
}
