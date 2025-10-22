import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ResumeMatchPage from "./pages/ResumeMatchPage";
import MockInterviewPage from "./pages/MockInterviewPage";
import InterviewSetupPage from './pages/InterviewSetupPage';
import InterviewReviewPage from "./pages/InterviewReviewPage.jsx"; 
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resume-match" element={<ResumeMatchPage />} /> 
        <Route path="/mock-interview" element={<MockInterviewPage />} />
        <Route path="/interview-setup" element={<InterviewSetupPage />} /> 
        <Route path="/interview-review" element={<InterviewReviewPage />} />
      </Routes>
    </Router>
  );
}

export default App;
