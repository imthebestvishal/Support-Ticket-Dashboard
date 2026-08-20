import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { getMessages } from "../services/api";
import type { BackendMessage, TicketPriority, TicketSentiment } from "../types/ticket";

function CategoryIcon({ category, subject, sender }: { category?: string; subject?: string; sender?: string }) {
  const cat = (category || "").toLowerCase();
  const text = `${subject || ""} ${sender || ""}`.toLowerCase();
  const combined = `${cat} ${text}`;

  if (combined.includes("linkedin") || combined.includes("twitter") || combined.includes("slack") || combined.includes("github") || cat.includes("social")) {
    return (
      <div className="category-badge cat-social" title="Social & Networking" aria-label="Social category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    );
  }

  if (cat.includes("account") || cat.includes("billing") || combined.includes("bill") || combined.includes("card") || combined.includes("transaction") || combined.includes("bank") || combined.includes("payment")) {
    return (
      <div className="category-badge cat-account" title="Account & Billing" aria-label="Account category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
    );
  }

  if (cat.includes("tech") || combined.includes("application") || combined.includes("code") || combined.includes("bug") || combined.includes("system") || combined.includes("server")) {
    return (
      <div className="category-badge cat-technical" title="Technical" aria-label="Technical category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
    );
  }

  if (combined.includes("prize") || combined.includes("contest") || combined.includes("offer") || combined.includes("deal") || combined.includes("promo") || cat.includes("promo")) {
    return (
      <div className="category-badge cat-promo" title="Promotions" aria-label="Promotions category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      </div>
    );
  }

  if (cat.includes("feature") || combined.includes("ai ") || combined.includes("request")) {
    return (
      <div className="category-badge cat-feature" title="Feature & AI" aria-label="Feature request category">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
    );
  }

  return (
    <div className="category-badge cat-general" title="General Support" aria-label="General support category">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNoticeAlert, setShowNoticeAlert] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        setError("");
        const data = await getMessages();
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Analytics load error:", err);
        setError("Unable to load live ticket data from the backend.");
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, []);

  const total = messages.length;
  const resolved = messages.filter((m) => m.status === "Resolved").length;
  const escalated = messages.filter(
    (m) => m.status === "Escalated" || m.isEscalated
  ).length;
  const pending = messages.filter(
    (m) =>
      m.status === "Pending" ||
      m.status === "Open" ||
      m.status === "In Progress" ||
      (!m.status && !m.isEscalated)
  ).length;

  const urgentCount = messages.filter((m) => m.priority === "Urgent" || m.priority === "High").length;

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const escalationRate = total > 0 ? Math.round((escalated / total) * 100) : 0;

  const urgentOnly = messages.filter((m) => m.priority === "Urgent").length;
  const highCount = messages.filter((m) => m.priority === "High").length;
  const mediumCount = messages.filter((m) => m.priority === "Medium").length;
  const lowCount = messages.filter((m) => m.priority === "Low").length;

  const positiveCount = messages.filter((m) => m.sentiment === "Positive").length;
  const neutralCount = messages.filter((m) => m.sentiment === "Neutral").length;
  const negativeCount = messages.filter((m) => m.sentiment === "Negative").length;

  const categories = ["Technical", "Billing", "Account", "General", "Other"] as const;
  const categoryCounts = categories.map((cat) => ({
    name: cat,
    count: messages.filter(
      (m) => (m.category || "Other").toLowerCase() === cat.toLowerCase()
    ).length,
  }));

  const recentTickets = [...messages]
    .sort(
      (a, b) =>
        new Date(b.receivedAt || 0).getTime() -
        new Date(a.receivedAt || 0).getTime()
    )
    .slice(0, 5);

  function goToDashboard(filter?: {
    filterStatus?: "All" | "Pending" | "Resolved" | "Escalated";
    filterPriority?: "All" | TicketPriority;
    filterSentiment?: "All" | TicketSentiment;
    selectedTicketId?: string;
  }) {
    navigate("/dashboard", { state: filter || {} });
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Analytics & Overview</span>
        </div>

        {/* Top Header with Dynamic Greeting */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <span className="eyebrow" style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--primary, #599345)", fontWeight: 800 }}>
              Live Support Operations
            </span>
            <h1 style={{ margin: "4px 0 0", fontSize: "28px", color: "var(--text-main, #1e293b)", fontWeight: 800 }}>
              {greeting}, Agent! <span aria-hidden="true">👋</span>
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted, #64748b)", fontSize: "14px" }}>
              Real-time ticket volume, resolution SLAs, and AI intelligence insights.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="secondary-button bell-swing"
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 700,
              }}
              onClick={() => setShowNoticeAlert((prev) => !prev)}
              title={`${urgentCount} urgent tickets, ${pending} pending`}
              aria-label="Toggle alerts summary"
            >
              <span style={{ fontSize: "15px" }}>🔔</span>
              <span>Alerts ({urgentCount})</span>
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/gmail")}
            >
              Gmail Inbox
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => goToDashboard()}
            >
              Open Ticket Workspace →
            </button>
          </div>
        </div>

        {/* Dismissible Alert Summary Banner */}
        {showNoticeAlert && (
          <div className="topbar-alert-banner" role="alert">
            <div>
              <strong>Live Operations Alert:</strong> {urgentCount} high/urgent priority ticket(s) requiring attention, {pending} open ticket(s).
            </div>
            <button
              type="button"
              className="topbar-alert-btn"
              onClick={() => setShowNoticeAlert(false)}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div
            className="dashboard-message"
            style={{
              background: "rgba(220, 38, 38, 0.12)",
              color: "#b91c1c",
              border: "1px solid #fca5a5",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          /* Shimmering Skeletons */
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-card" style={{ height: "110px" }}>
                  <div className="skeleton-line title"></div>
                  <div className="skeleton-line body"></div>
                </div>
              ))}
            </div>
            <div className="skeleton-card" style={{ height: "200px" }}>
              <div className="skeleton-line title" style={{ width: "40%" }}></div>
              <div className="skeleton-line body"></div>
              <div className="skeleton-line body"></div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "24px" }}>
            {/* Top Interactive Metric KPI Cards with Trend Visuals */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              {/* Total Tickets */}
              <div
                className="dashboard-card dashboard-stat-card hover-lift"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #4f46e5",
                }}
                onClick={() => goToDashboard({ filterStatus: "All" })}
                title="Click to view all tickets in workspace"
                role="button"
                tabIndex={0}
                aria-label="Total tickets KPI card"
              >
                <div>
                  <p className="dashboard-stat-label" style={{ color: "#4f46e5", margin: "0 0 6px", fontSize: "12px", fontWeight: 800 }}>
                    TOTAL TICKETS
                  </p>
                  <strong style={{ fontSize: "32px", fontWeight: 900, color: "#1e293b", display: "block" }}>
                    {total}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: 600, marginTop: "6px", display: "inline-block" }}>
                    View in Workspace ↗
                  </span>
                </div>
                <div className="metric-trend" style={{ width: "70px", height: "55px" }} aria-hidden="true">
                  <span style={{ "--bar-height": "40%" } as CSSProperties} />
                  <span style={{ "--bar-height": "65%" } as CSSProperties} />
                  <span style={{ "--bar-height": "85%" } as CSSProperties} />
                  <span style={{ "--bar-height": "100%" } as CSSProperties} />
                </div>
              </div>

              {/* Pending / Open Tickets */}
              <div
                className="dashboard-card dashboard-stat-card hover-lift"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #f59e0b",
                }}
                onClick={() => goToDashboard({ filterStatus: "Pending" })}
                title="Click to view pending tickets"
                role="button"
                tabIndex={0}
                aria-label="Open tickets KPI card"
              >
                <div>
                  <p className="dashboard-stat-label" style={{ color: "#b45309", margin: "0 0 6px", fontSize: "12px", fontWeight: 800 }}>
                    OPEN / PENDING
                  </p>
                  <strong style={{ fontSize: "32px", fontWeight: 900, color: "#b45309", display: "block" }}>
                    {pending}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#b45309", fontWeight: 600, marginTop: "6px", display: "inline-block" }}>
                    Needs Attention ↗
                  </span>
                </div>
                <div className="metric-ring" style={{ "--stat-progress": total > 0 ? Math.round((pending / total) * 100) : 0, width: "64px" } as CSSProperties}>
                  <span style={{ fontSize: "14px" }}>{pending}</span>
                </div>
              </div>

              {/* Resolution Rate */}
              <div
                className="dashboard-card dashboard-stat-card hover-lift"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #599345",
                }}
                onClick={() => goToDashboard({ filterStatus: "Resolved" })}
                title="Click to view resolved tickets"
                role="button"
                tabIndex={0}
                aria-label="Resolution rate KPI card"
              >
                <div>
                  <p className="dashboard-stat-label" style={{ color: "#23671e", margin: "0 0 6px", fontSize: "12px", fontWeight: 800 }}>
                    RESOLUTION RATE
                  </p>
                  <strong style={{ fontSize: "32px", fontWeight: 900, color: "#23671e", display: "block" }}>
                    {resolutionRate}%
                  </strong>
                  <span style={{ fontSize: "12px", color: "#23671e", fontWeight: 600, marginTop: "6px", display: "inline-block" }}>
                    {resolved} resolved ↗
                  </span>
                </div>
                <div className="metric-ring" style={{ "--stat-progress": resolutionRate, width: "64px" } as CSSProperties}>
                  <span style={{ fontSize: "14px" }}>{resolutionRate}%</span>
                </div>
              </div>

              {/* Escalated Tickets */}
              <div
                className="dashboard-card dashboard-stat-card hover-lift"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid #ef4444",
                }}
                onClick={() => goToDashboard({ filterStatus: "Escalated" })}
                title="Click to view escalated tickets"
                role="button"
                tabIndex={0}
                aria-label="Escalation rate KPI card"
              >
                <div>
                  <p className="dashboard-stat-label" style={{ color: "#dc2626", margin: "0 0 6px", fontSize: "12px", fontWeight: 800 }}>
                    ESCALATION RATE
                  </p>
                  <strong style={{ fontSize: "32px", fontWeight: 900, color: "#dc2626", display: "block" }}>
                    {escalationRate}%
                  </strong>
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, marginTop: "6px", display: "inline-block" }}>
                    {escalated} Tier 2 tickets ↗
                  </span>
                </div>
                <div className="metric-alert" style={{ width: "52px" }} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" strokeWidth="2">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                    <path d="M10 21h4" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Middle Section: Priority Breakdown & Customer Sentiment */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              {/* Priority Breakdown Card */}
              <div className="dashboard-card">
                <h2 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 16px", fontWeight: 800 }}>
                  ⚡ Priority Breakdown
                </h2>

                <div style={{ display: "grid", gap: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#fee2e2",
                      cursor: "pointer",
                      border: "1px solid #fca5a5",
                    }}
                    className="hover-lift"
                    onClick={() => goToDashboard({ filterPriority: "Urgent" })}
                    role="button"
                    tabIndex={0}
                  >
                    <span style={{ fontWeight: 700, color: "#991b1b", fontSize: "13px" }}>
                      🔴 Urgent Priority
                    </span>
                    <strong style={{ color: "#991b1b", fontSize: "16px" }}>
                      {urgentOnly}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#ffedd5",
                      cursor: "pointer",
                      border: "1px solid #fdba74",
                    }}
                    className="hover-lift"
                    onClick={() => goToDashboard({ filterPriority: "High" })}
                    role="button"
                    tabIndex={0}
                  >
                    <span style={{ fontWeight: 700, color: "#c2410c", fontSize: "13px" }}>
                      🟠 High Priority
                    </span>
                    <strong style={{ color: "#c2410c", fontSize: "16px" }}>
                      {highCount}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#fef9c3",
                      cursor: "pointer",
                      border: "1px solid #fde047",
                    }}
                    className="hover-lift"
                    onClick={() => goToDashboard({ filterPriority: "Medium" })}
                    role="button"
                    tabIndex={0}
                  >
                    <span style={{ fontWeight: 700, color: "#854d0e", fontSize: "13px" }}>
                      🟡 Medium Priority
                    </span>
                    <strong style={{ color: "#854d0e", fontSize: "16px" }}>
                      {mediumCount}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "#f1f5f9",
                      cursor: "pointer",
                      border: "1px solid #e2e8f0",
                    }}
                    className="hover-lift"
                    onClick={() => goToDashboard({ filterPriority: "Low" })}
                    role="button"
                    tabIndex={0}
                  >
                    <span style={{ fontWeight: 700, color: "#475569", fontSize: "13px" }}>
                      ⚪ Low Priority
                    </span>
                    <strong style={{ color: "#475569", fontSize: "16px" }}>
                      {lowCount}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Sentiment & Category Distribution Card */}
              <div className="dashboard-card">
                <h2 style={{ fontSize: "17px", color: "#1e293b", margin: "0 0 16px", fontWeight: 800 }}>
                  💡 Customer Sentiment & Categories
                </h2>

                <div style={{ marginBottom: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", marginBottom: "8px", fontWeight: 600 }}>
                    <span style={{ color: "#166534" }}>● Positive: {positiveCount}</span>
                    <span style={{ color: "#475569" }}>● Neutral: {neutralCount}</span>
                    <span style={{ color: "#991b1b" }}>● Negative: {negativeCount}</span>
                  </div>

                  <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", background: "#e2e8f0" }}>
                    {total > 0 && (
                      <>
                        <div style={{ width: `${(positiveCount / total) * 100}%`, background: "#22c55e" }} title="Positive" />
                        <div style={{ width: `${(neutralCount / total) * 100}%`, background: "#94a3b8" }} title="Neutral" />
                        <div style={{ width: `${(negativeCount / total) * 100}%`, background: "#ef4444" }} title="Negative" />
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {categoryCounts.map((cat) => (
                    <div
                      key={cat.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "13px",
                        padding: "8px 0",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <span style={{ color: "#334155", fontWeight: 600 }}>{cat.name}</span>
                      <strong style={{ color: "#1e293b" }}>{cat.count} tickets</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Section: Recent Support Activity Feed with Category Badges */}
            <div className="dashboard-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h2 style={{ fontSize: "17px", color: "#1e293b", margin: 0, fontWeight: 800 }}>
                    🕒 Recent Incoming Tickets
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
                    Live customer tickets synced from Gmail.
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={() => goToDashboard()}
                >
                  View All Tickets →
                </button>
              </div>

              {recentTickets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                  No tickets logged yet. Sync unread messages from the Gmail tab.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recentTickets.map((t) => (
                    <div
                      key={t._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "#f8fafc",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                      className="hover-lift"
                      onClick={() => goToDashboard({ selectedTicketId: t._id })}
                      role="button"
                      tabIndex={0}
                      aria-label={`View recent ticket: ${t.subject}`}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <CategoryIcon category={t.category} subject={t.subject} sender={t.sender} />
                        <div>
                          <strong style={{ color: "#1e293b", fontSize: "14px", display: "block" }}>
                            {t.subject || "No Subject"}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            From: {t.sender || "Customer"} • {t.category || "General"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span className={`chip priority-${t.priority?.toLowerCase() || "medium"}`}>
                          {t.priority || "Medium"}
                        </span>
                        <span className={`chip sentiment-${t.sentiment?.toLowerCase() || "neutral"}`}>
                          {t.sentiment || "Neutral"}
                        </span>
                        <span
                          className={`status-badge ${
                            t.status === "Resolved"
                              ? "resolved"
                              : t.status === "Escalated" || t.isEscalated
                              ? "escalated"
                              : "pending"
                          }`}
                        >
                          {t.status || "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
