import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ResumeMatchPage from "./pages/ResumeMatchPage";
import MockInterviewPage from "./pages/MockInterviewPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/resume-match" element={<ResumeMatchPage />} />
        <Route path="/mock-interview" element={<MockInterviewPage />} />
      </Routes>
    </Router>
  );
}

export default App;
