import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";

const BACKEND = "http://localhost:5000";

type GmailAnalysis = {
  category?: string;
  sentiment?: string;
  priority?: string;
  summary?: string;
};

type GmailMessage = {
  _id?: string;
  gmailMessageId?: string;
  sender?: string;
  subject?: string;
  body?: string;
  receivedAt?: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  summary?: string;
  status?: string;
  analysis?: GmailAnalysis;
};

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

export default function Gmail() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selected, setSelected] = useState<GmailMessage | null>(null);
  const [status, setStatus] = useState("Checking...");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");

  async function refreshStatus() {
    setStatus("Checking...");
    setMessage("");

    try {
      const response = await fetch(`${BACKEND}/api/gmail/status`, {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to check Gmail status.");
      }

      setConnected(Boolean(data.connected));
      setEmail(data.email || "");

      if (data.connected) {
        setStatus(`Connected (${data.email})`);
        setMessage("Gmail is connected. You can fetch unread messages.");
      } else {
        setStatus("Not connected");
        setMessage("Click Connect Gmail to authorize Google access.");
      }
    } catch (error) {
      setConnected(false);
      setEmail("");
      setStatus("Not connected");
      setMessage(
        error instanceof Error ? error.message : "Please connect Gmail."
      );
    }
  }

  function connectGmail() {
    const redirect = window.location.origin;
    window.location.href = `${BACKEND}/auth/google?redirect=${encodeURIComponent(
      redirect
    )}`;
  }

  async function fetchMessages() {
    setFetching(true);
    setMessage("Fetching unread Gmail messages and analyzing with Gemini...");

    try {
      const response = await fetch(`${BACKEND}/api/messages/fetch`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch Gmail messages.");
      }

      setMessages(data.messages || []);
      setStatus(`Fetched ${data.count || 0} messages`);
      setMessage(`✓ ${data.count || 0} unread messages fetched and analyzed.`);
      await loadStoredMessages();
    } catch (error) {
      setStatus("Fetch failed");
      setMessage(
        error instanceof Error ? error.message : "Failed to fetch messages."
      );
    } finally {
      setFetching(false);
    }
  }

  async function loadStoredMessages() {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND}/api/messages`, {
        credentials: "include",
      });

      if (!response.ok) return;

      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setMessages(list);
      if (list.length > 0 && !selected) {
        setSelected(list[0]);
      }
    } catch {
      // Ignore until Gmail is connected.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await refreshStatus();
      await loadStoredMessages();
    }

    initialize();
  }, []);

  const filteredMessages = useMemo(() => {
    const query = search.toLowerCase().trim();

    return messages.filter((msg) => {
      const p = msg.priority || msg.analysis?.priority || "Medium";
      const matchesPriority =
        priorityFilter === "All" || p.toLowerCase() === priorityFilter.toLowerCase();

      const searchable = [
        msg.sender,
        msg.subject,
        msg.summary || msg.analysis?.summary,
        msg.category || msg.analysis?.category,
        msg.sentiment || msg.analysis?.sentiment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesPriority && (!query || searchable.includes(query));
    });
  }, [messages, search, priorityFilter]);

  const stats = useMemo(() => {
    return {
      total: messages.length,
      urgent: messages.filter(
        (m) =>
          m.priority === "Urgent" ||
          m.priority === "High" ||
          m.analysis?.priority === "Urgent" ||
          m.analysis?.priority === "High"
      ).length,
      medium: messages.filter(
        (m) =>
          m.priority === "Medium" ||
          m.analysis?.priority === "Medium"
      ).length,
      low: messages.filter(
        (m) =>
          m.priority === "Low" ||
          m.analysis?.priority === "Low" ||
          (!m.priority && !m.analysis?.priority)
      ).length,
      negative: messages.filter(
        (m) =>
          m.sentiment === "Negative" ||
          m.analysis?.sentiment === "Negative"
      ).length,
    };
  }, [messages]);

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumbs */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Gmail Inbox</span>
        </div>

        <div className="dashboard-card gmail-page" style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
                Gmail AI Intelligence
              </span>
              <h1 style={{ margin: "2px 0 0", fontSize: "28px", fontWeight: 800 }}>
                Gmail Inbox & Analysis
              </h1>
              <p style={{ margin: "4px 0 0", color: "var(--text-muted, #64748b)", fontSize: "14px" }}>
                Connect Gmail to fetch unread messages and automatically analyze them with Gemini.
              </p>
              <div style={{ marginTop: "6px", fontSize: "13px" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: connected ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                  {connected ? `Connected (${email})` : "Not connected"}
                </span>
              </div>
            </div>

            <div className="gmail-actions" style={{ margin: 0, gap: "10px" }}>
              <button className="primary-button" onClick={connectGmail}>
                {connected ? "Reconnect Google" : "Connect Gmail"}
              </button>

              <button className="secondary-button" onClick={refreshStatus}>
                Refresh Status
              </button>

              <button
                className="primary-button"
                onClick={fetchMessages}
                disabled={!connected || fetching}
              >
                {fetching ? "Analyzing..." : "✦ Fetch & Analyze Gmail"}
              </button>
            </div>
          </div>

          {message && <div className="dashboard-message">{message}</div>}

          {/* Top Analytics Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
              marginBottom: "20px",
            }}
          >
            <div className="dashboard-card hover-lift" style={{ padding: "16px", borderLeft: "4px solid #4f46e5" }} title="Total messages analyzed">
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 800 }}>TOTAL EMAILS</span>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#1e293b", margin: "4px 0" }}>{stats.total}</div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Conversations analyzed</span>
            </div>

            <div className="dashboard-card hover-lift" style={{ padding: "16px", borderLeft: "4px solid #ef4444" }} title="High priority / urgent attention">
              <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 800 }}>HIGH PRIORITY</span>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#dc2626", margin: "4px 0" }}>{stats.urgent}</div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Needs immediate review</span>
            </div>

            <div className="dashboard-card hover-lift" style={{ padding: "16px", borderLeft: "4px solid #f59e0b" }} title="Medium priority conversations">
              <span style={{ fontSize: "11px", color: "#b45309", fontWeight: 800 }}>MEDIUM PRIORITY</span>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#b45309", margin: "4px 0" }}>{stats.medium}</div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Standard response</span>
            </div>

            <div className="dashboard-card hover-lift" style={{ padding: "16px", borderLeft: "4px solid #599345" }} title="Low urgency queue">
              <span style={{ fontSize: "11px", color: "#23671e", fontWeight: 800 }}>LOW PRIORITY</span>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#23671e", margin: "4px 0" }}>{stats.low}</div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Normal queue</span>
            </div>

            <div className="dashboard-card hover-lift" style={{ padding: "16px", borderLeft: "4px solid #e11d48" }} title="Frustrated / Negative customer sentiment">
              <span style={{ fontSize: "11px", color: "#be123c", fontWeight: 800 }}>NEGATIVE SENTIMENT</span>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#be123c", margin: "4px 0" }}>{stats.negative}</div>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Frustrated customers</span>
            </div>
          </div>

          {/* Search Toolbar */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
            <input
              className="search-input"
              style={{ flex: 1, minWidth: "260px", margin: 0 }}
              placeholder="Search sender, subject, summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search emails"
            />
            <select
              className="filter-select"
              style={{ minWidth: "160px" }}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by priority level"
            >
              <option value="All">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Conversation List & Detail Split */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "18px", alignItems: "start" }}>
            {/* Conversation List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {loading || fetching ? (
                /* Shimmering Skeletons */
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", marginBottom: "8px" }}>
                    <div className="spinner-green"></div>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#1e293b" }}>Analyzing Gmail messages...</strong>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>Retrieving threads and classifying with Gemini AI</div>
                    </div>
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-line title"></div>
                      <div className="skeleton-line body"></div>
                      <div className="skeleton-line meta"></div>
                    </div>
                  ))}
                </div>
              ) : filteredMessages.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                  No Gmail messages found. Click <strong>✦ Fetch & Analyze Gmail</strong>.
                </div>
              ) : (
                filteredMessages.map((item, index) => {
                  const cat = item.category || item.analysis?.category || "General";
                  const priority = item.priority || item.analysis?.priority || "Medium";
                  const sentiment = item.sentiment || item.analysis?.sentiment || "Neutral";
                  const isSelected = selected?._id === item._id || selected?.gmailMessageId === item.gmailMessageId;

                  return (
                    <div
                      key={item._id || item.gmailMessageId || index}
                      style={{
                        padding: "14px",
                        background: isSelected ? "#eef2ff" : "#ffffff",
                        border: isSelected ? "1px solid #818cf8" : "1px solid #e2e8f0",
                        borderRadius: "12px",
                        cursor: "pointer",
                        display: "flex",
                        gap: "12px",
                        alignItems: "flex-start",
                      }}
                      className="hover-lift"
                      onClick={() => setSelected(item)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View conversation: ${item.subject}`}
                    >
                      <CategoryIcon category={cat} subject={item.subject} sender={item.sender} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: "#1e293b", fontSize: "14px", display: "block", marginBottom: "4px" }}>
                          {item.subject || "No Subject"}
                        </strong>
                        <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "6px" }}>
                          From: {item.sender || "Unknown"}
                        </span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <span className={`chip priority-${priority.toLowerCase()}`}>
                            {priority}
                          </span>
                          <span className={`chip sentiment-${sentiment.toLowerCase()}`}>
                            {sentiment}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Conversation Detail Inspector */}
            <div className="dashboard-card" style={{ padding: "20px" }}>
              {!selected ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <h3>Select an email</h3>
                  <p>Choose an analyzed Gmail conversation to view full details.</p>
                </div>
              ) : (
                <div>
                  <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
                    EMAIL ANALYSIS
                  </span>
                  <h2 style={{ margin: "4px 0 12px", fontSize: "20px", color: "#1e293b" }}>
                    {selected.subject || "No Subject"}
                  </h2>

                  <div className="detail-row" style={{ marginBottom: "14px" }}>
                    <div>
                      <strong>From</strong>
                      <span>{selected.sender || "Unknown"}</span>
                    </div>
                    <div>
                      <strong>Category</strong>
                      <span>{selected.category || selected.analysis?.category || "Other"}</span>
                    </div>
                  </div>

                  {selected.receivedAt && (
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
                      <strong>Received:</strong> {new Date(selected.receivedAt).toLocaleString()}
                    </div>
                  )}

                  <hr style={{ border: 0, borderTop: "1px solid #e2e8f0", margin: "14px 0" }} />

                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#1e293b" }}>AI Summary</h3>
                  <div className="customer-message" style={{ marginBottom: "14px" }}>
                    {selected.summary || selected.analysis?.summary || "No AI summary generated."}
                  </div>

                  <h3 style={{ fontSize: "14px", margin: "0 0 6px", color: "#1e293b" }}>Original Message Body</h3>
                  <div className="customer-message" style={{ maxHeight: "250px", overflowY: "auto" }}>
                    {selected.body || "No email body text available."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
