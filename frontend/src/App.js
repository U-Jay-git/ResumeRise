import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ResumeBuilder from "./pages/ResumePage";
import HomePage from "./pages/HomePage";
import ResumeMatchPage from "./pages/ResumeMatchPage";
import MockInterviewPage from "./pages/MockInterviewPage";
import ResumePage from "./pages/ResumePage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
         <Route path="/resume-builder" element={<ResumePage />} />
        <Route path="/resume-match" element={<ResumeMatchPage />} />
        <Route path="/mock-interview" element={<MockInterviewPage />} />
      </Routes>
    </Router>
  );
}

export default App;
