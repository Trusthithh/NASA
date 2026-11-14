import React from "react";
import { BrowserRouter as Router, Link, Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navigation/Navbar";
import { LocationProvider } from "./context/LocationContext";
import { LandingPage } from "./pages/LandingPage";
import { InvestigationPage } from "./pages/InvestigationPage";
import { EnvironmentalPage } from "./pages/EnvironmentalPage";

const NotFound: React.FC = () => (
  <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-slate-300">
    <h1 className="text-3xl font-bold text-white">Page not found</h1>
    <Link to="/" className="text-cyan-400 hover:text-cyan-300">
      Back to the globe
    </Link>
  </div>
);

export function App() {
  return (
    <Router>
      <LocationProvider>
        <div className="flex min-h-screen flex-col bg-[#050811] font-sans text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/investigate" element={<InvestigationPage />} />
              <Route path="/environmental" element={<EnvironmentalPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </LocationProvider>
    </Router>
  );
}

export default App;
