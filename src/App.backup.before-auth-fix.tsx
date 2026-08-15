import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/home";
import Auth from "./pages/auth";
import Account from "./pages/account";

import Dashboard from "./pages/dashboard";
import Gmail from "./pages/gmail";
import KnowledgeBase from "./pages/knowledge-base";
import Settings from "./pages/settings";

import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/account" element={<Account />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/gmail" element={<Gmail />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;



