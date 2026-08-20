import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Auth from "./pages/auth";
import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Gmail from "./pages/gmail";
import KnowledgeBase from "./pages/knowledge-base";
import Settings from "./pages/settings";
import Account from "./pages/account";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  useEffect(() => {
    // Initialize theme from storage
    const theme = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    document.body.classList.toggle("dark-theme", theme === "dark");
  }, []);

  return (
    <Layout>
      <Routes>
        {/* PUBLIC LANDING PAGE */}
        <Route path="/" element={<Landing />} />

        {/* AUTHENTICATION */}
        <Route path="/auth" element={<Auth />} />

        {/* PROTECTED APPLICATION WORKSPACE ROUTES */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gmail"
          element={
            <ProtectedRoute>
              <Gmail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/knowledge-base"
          element={
            <ProtectedRoute>
              <KnowledgeBase />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK -> Landing Page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;