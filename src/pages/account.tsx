import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { authClient } from "../lib/auth";
import { getGmailStatus, getMessages } from "../services/api";
import type { BackendMessage } from "../types/ticket";

interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  createdAt?: string | Date;
}

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");
  const [ticketCount, setTicketCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  useEffect(() => {
    async function loadAccountData() {
      try {
        setLoading(true);
        // 1. Fetch authenticated session
        const sessionResult = await authClient.getSession().catch(() => null);
        if (sessionResult?.data?.user) {
          setUser(sessionResult.data.user);
        } else {
          setUser({
            name: "Support Specialist",
            email: "agent@support-dashboard.local",
          });
        }

        // 2. Fetch Gmail connection status
        try {
          const status = await getGmailStatus();
          setGmailConnected(Boolean(status.connected));
          setGmailEmail(status.email || "");
        } catch {
          setGmailConnected(false);
        }

        // 3. Fetch live message stats
        try {
          const messages: BackendMessage[] = await getMessages();
          setTicketCount(messages.length);
          setResolvedCount(messages.filter((m) => m.status === "Resolved").length);
          setEscalatedCount(
            messages.filter((m) => m.status === "Escalated" || m.isEscalated).length
          );
        } catch {
          // Fallback if messages not available
        }
      } catch (error) {
        console.error("Failed to load account overview:", error);
      } finally {
        setLoading(false);
      }
    }

    loadAccountData();
  }, []);

  async function confirmSignOut() {
    try {
      setSigningOut(true);
      await authClient.signOut().catch(() => null);
      navigate("/auth", { replace: true });
    } catch (err) {
      console.error("Sign out error:", err);
      navigate("/auth", { replace: true });
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "SP";

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Account & Profile</span>
        </div>

        <div className="dashboard-card" style={{ maxWidth: "900px" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: "20px",
              marginBottom: "24px",
              flexWrap: "wrap",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, var(--primary, #599345), #23671e)",
                  color: "white",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "20px",
                  fontWeight: 800,
                }}
              >
                {initials}
              </div>

              <div>
                <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
                  Agent Profile & Session
                </span>
                <h1 style={{ margin: "2px 0 0", fontSize: "24px", color: "#1e293b", fontWeight: 800 }}>
                  {user?.name || "Support Specialist"}
                </h1>
                <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "14px" }}>
                  Active Neon Auth session details and workspace statistics.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "#dcfce7",
                  color: "#166534",
                  fontSize: "12px",
                  fontWeight: 700,
                  border: "1px solid #86efac",
                }}
              >
                ● Active Session
              </span>

              <button
                type="button"
                className="danger-button"
                style={{ padding: "8px 16px", fontSize: "13px" }}
                onClick={() => setShowSignOutModal(true)}
                disabled={signingOut}
                aria-label="Open sign out dialog"
              >
                Sign Out
              </button>
            </div>
          </div>

          {loading ? (
            /* Shimmering Skeletons */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              <div className="skeleton-card" style={{ height: "180px" }}>
                <div className="skeleton-line title"></div>
                <div className="skeleton-line body"></div>
                <div className="skeleton-line meta"></div>
              </div>
              <div className="skeleton-card" style={{ height: "180px" }}>
                <div className="skeleton-line title"></div>
                <div className="skeleton-line body"></div>
                <div className="skeleton-line meta"></div>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
              {/* Account Details Card */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "22px",
                }}
                className="hover-lift"
              >
                <h2 style={{ fontSize: "17px", margin: "0 0 16px", color: "#1e293b", fontWeight: 800 }}>
                  👤 User Identity
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Full Name</span>
                    <strong style={{ fontSize: "15px", color: "#1e293b" }}>
                      {user?.name || "Support Specialist"}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Primary Email</span>
                    <strong style={{ fontSize: "15px", color: "#1e293b" }}>
                      {user?.email || "N/A"}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Assigned Role</span>
                    <strong style={{ fontSize: "15px", color: "#1e293b" }}>
                      Support Tier 1 / AI Operator
                    </strong>
                  </div>

                  {user?.id && (
                    <div>
                      <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Account User ID</span>
                      <code style={{ fontSize: "11px", color: "#475569", background: "#e2e8f0", padding: "3px 8px", borderRadius: "4px" }}>
                        {user.id}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {/* Integrations & Live Stats Card */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "22px",
                }}
                className="hover-lift"
              >
                <h2 style={{ fontSize: "17px", margin: "0 0 16px", color: "#1e293b", fontWeight: 800 }}>
                  📊 Workspace Activity
                </h2>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Connected Gmail</span>
                    <strong style={{ fontSize: "15px", color: gmailConnected ? "#15803d" : "#b91c1c" }}>
                      {gmailConnected
                        ? `✓ Connected (${gmailEmail || "Google Account"})`
                        : "✕ Not Connected"}
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Total Tickets Managed</span>
                    <strong style={{ fontSize: "15px", color: "#1e293b" }}>
                      {ticketCount} tickets
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Resolution Metrics</span>
                    <strong style={{ fontSize: "15px", color: "#1e293b" }}>
                      {resolvedCount} resolved / {escalatedCount} escalated
                    </strong>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#64748b", display: "block" }}>AI Model Engine</span>
                    <strong style={{ fontSize: "15px", color: "var(--primary, #599345)" }}>
                      Gemini 2.5 Flash
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIGN OUT CONFIRMATION MODAL */}
        {showSignOutModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowSignOutModal(false)}
          >
            <div
              className="modal logout-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-dialog-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="logout-confirm-icon" aria-hidden="true">
                🚪
              </div>

              <h2 id="logout-dialog-title" style={{ margin: "0 0 8px", fontSize: "20px" }}>
                Confirm Sign Out?
              </h2>

              <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 20px" }}>
                Are you sure you want to end your active support session? You will be redirected to the sign-in screen.
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowSignOutModal(false)}
                  disabled={signingOut}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="danger-button"
                  onClick={confirmSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? "Signing Out..." : "Yes, Sign Out"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
