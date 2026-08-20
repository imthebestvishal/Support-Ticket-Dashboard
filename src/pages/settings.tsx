import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  DEFAULT_SETTINGS,
  getWorkspaceSettings,
  saveWorkspaceSettings,
  resetWorkspaceSettings,
  type WorkspaceSettings,
} from "../lib/settings";

export default function Settings() {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [savedMessage, setSavedMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark-theme", theme === "dark");
    document.body.classList.toggle("dark-theme", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    const loaded = getWorkspaceSettings();
    setSettings(loaded);
  }, []);

  function handleChange<K extends keyof WorkspaceSettings>(
    key: K,
    value: WorkspaceSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSavedMessage("");
  }

  function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    saveWorkspaceSettings(settings);
    setHasChanges(false);
    setSavedMessage("✓ Settings saved successfully.");
    setTimeout(() => setSavedMessage(""), 4000);
  }

  function handleReset() {
    const defaults = resetWorkspaceSettings();
    setSettings(defaults);
    setHasChanges(false);
    setSavedMessage("✓ Settings restored to system defaults.");
    setTimeout(() => setSavedMessage(""), 4000);
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Settings & Configuration</span>
        </div>

        <div className="dashboard-card settings-card" style={{ maxWidth: "860px" }}>
          <div style={{ marginBottom: "20px" }}>
            <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
              Configuration & Preferences
            </span>
            <h1 style={{ margin: "2px 0 6px", fontSize: "28px", fontWeight: 800 }}>
              Workspace Settings
            </h1>
            <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: "14px" }}>
              Configure AI response defaults, automation rules, visual theme, and workspace preferences.
            </p>
          </div>

          {savedMessage && (
            <div
              className="dashboard-message"
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                color: "#15803d",
                border: "1px solid #86efac",
                marginBottom: "20px",
              }}
            >
              {savedMessage}
            </div>
          )}

          {/* SECTION: Appearance & Theme */}
          <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 12px", fontWeight: 800 }}>
              🎨 Appearance & Theme
            </h2>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                  Workspace Visual Theme
                </strong>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Switch between clean Light mode and high-contrast Dark theme.
                </span>
              </div>

              <button
                type="button"
                className={`theme-toggle-btn ${theme === "dark" ? "is-dark" : "is-light"}`}
                onClick={toggleTheme}
                title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                aria-label="Toggle visual theme"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  background: theme === "dark" ? "#1e293b" : "#e2e8f0",
                  color: theme === "dark" ? "#f8fafc" : "#1e293b",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "13px",
                  transition: "all 0.2s ease",
                }}
              >
                <span>{theme === "dark" ? "🌙 Dark Mode" : "☀️ Light Mode"}</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: "grid", gap: "24px" }}>
            {/* SECTION 1: AI & Response Configuration */}
            <div>
              <h2 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", fontWeight: 800 }}>
                ✨ AI Assistance & Model Behavior
              </h2>

              <div style={{ display: "grid", gap: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                      AI Auto-Suggested Replies
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Automatically generate initial response drafts for incoming customer tickets using Gemini.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.aiSuggestedReplies}
                    onChange={(e) => handleChange("aiSuggestedReplies", e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    aria-label="Toggle AI auto suggested replies"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                      Default Reply Tone
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Preferred default tone when composing or auto-refining agent replies.
                    </span>
                  </div>
                  <select
                    className="filter-select"
                    value={settings.defaultTone}
                    onChange={(e) =>
                      handleChange(
                        "defaultTone",
                        e.target.value as WorkspaceSettings["defaultTone"]
                      )
                    }
                    style={{ minWidth: "180px", padding: "8px 12px", fontSize: "13px" }}
                    aria-label="Select default tone"
                  >
                    <option value="formal">👔 Formal & Professional</option>
                    <option value="friendly">😊 Friendly & Empathetic</option>
                    <option value="shorten">✂️ Shorten (Direct / Concise)</option>
                    <option value="simplify">💡 Simplify (Step-by-Step)</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                      Automatic Gmail Analysis
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Classify priority, category, sentiment, and summary immediately when messages are fetched.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoAnalyzeGmail}
                    onChange={(e) => handleChange("autoAnalyzeGmail", e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    aria-label="Toggle automatic Gmail analysis"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Notifications & Refresh */}
            <div>
              <h2 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", fontWeight: 800 }}>
                🔔 Notifications & Sync Preferences
              </h2>

              <div style={{ display: "grid", gap: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                      Email Notification Alerts
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Notify team leads when urgent or escalated tickets require attention.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleChange("emailNotifications", e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    aria-label="Toggle email notifications"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>
                      Dashboard Auto-Refresh Interval
                    </strong>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Automatically refresh stored tickets in the background while viewing the workspace.
                    </span>
                  </div>
                  <select
                    className="filter-select"
                    value={settings.autoRefreshInterval}
                    onChange={(e) =>
                      handleChange("autoRefreshInterval", Number(e.target.value))
                    }
                    style={{ minWidth: "180px", padding: "8px 12px", fontSize: "13px" }}
                    aria-label="Select auto refresh interval"
                  >
                    <option value={0}>Manual Refresh Only</option>
                    <option value={30}>Every 30 seconds</option>
                    <option value={60}>Every 60 seconds</option>
                    <option value={120}>Every 2 minutes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "18px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={handleReset}
              >
                Reset to Defaults
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={!hasChanges && !savedMessage}
              >
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
