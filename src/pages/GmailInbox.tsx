import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000";

type Message = {
  _id?: string;
  sender?: string;
  subject?: string;
  body?: string;
  summary?: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  status?: string;
  receivedAt?: string;
};

function priorityClass(priority?: string) {
  if (priority === "Urgent" || priority === "High") {
    return "gmail-priority-high";
  }

  if (priority === "Medium") {
    return "gmail-priority-medium";
  }

  return "gmail-priority-low";
}

function sentimentClass(sentiment?: string) {
  if (sentiment === "Negative") return "gmail-negative";
  if (sentiment === "Positive") return "gmail-positive";
  return "gmail-neutral";
}

export default function GmailInbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("All");

  async function loadMessages() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API}/api/messages`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load Gmail messages");
      }

      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Gmail messages"
      );
    } finally {
      setLoading(false);
    }
  }

  async function fetchAndAnalyze() {
    try {
      setFetching(true);
      setError("");

      const response = await fetch(`${API}/api/messages/fetch`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to fetch Gmail messages"
        );
      }

      await loadMessages();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch Gmail messages"
      );
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, []);

  const filteredMessages = useMemo(() => {
    const query = search.toLowerCase().trim();

    return messages.filter((message) => {
      const matchesPriority =
        priority === "All" || message.priority === priority;

      const searchable = [
        message.sender,
        message.subject,
        message.summary,
        message.category,
        message.sentiment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesPriority && (!query || searchable.includes(query));
    });
  }, [messages, search, priority]);

  const stats = useMemo(() => {
    return {
      total: messages.length,

      urgent: messages.filter(
        (m) =>
          m.priority === "Urgent" ||
          m.priority === "High"
      ).length,

      medium: messages.filter(
        (m) => m.priority === "Medium"
      ).length,

      low: messages.filter(
        (m) =>
          m.priority === "Low" ||
          !m.priority
      ).length,

      negative: messages.filter(
        (m) => m.sentiment === "Negative"
      ).length,
    };
  }, [messages]);

  return (
    <div className="gmail-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">GMAIL AI CENTER</p>

          <h1 className="page-title">
            Gmail Intelligence
          </h1>

          <p className="page-copy">
            View your Gmail conversations and AI-generated
            priority, category, sentiment and summaries.
          </p>
        </div>

        <div className="gmail-actions">
          <button
            className="btn btn-primary"
            onClick={fetchAndAnalyze}
            disabled={fetching}
          >
            {fetching
              ? "Analyzing..."
              : "âœ¦ Fetch & Analyze Gmail"}
          </button>

          <button
            className="btn"
            onClick={loadMessages}
            disabled={loading}
          >
            â†» Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="gmail-stats">
        <div className="card stat-card">
          <div className="stat-label">Total emails</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-change">
            Gmail conversations analyzed
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">High priority</div>
          <div className="stat-value">
            {stats.urgent}
          </div>
          <div className="stat-change">
            Immediate attention
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Medium</div>
          <div className="stat-value">
            {stats.medium}
          </div>
          <div className="stat-change">
            Needs review
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">Low</div>
          <div className="stat-value">
            {stats.low}
          </div>
          <div className="stat-change">
            Normal conversations
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            Negative sentiment
          </div>
          <div className="stat-value">
            {stats.negative}
          </div>
          <div className="stat-change">
            Customer frustration detected
          </div>
        </div>
      </div>

      <div className="gmail-toolbar card">
        <input
          className="gmail-search"
          placeholder="Search sender, subject, summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="gmail-filter"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="All">All priorities</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      <div className="gmail-layout">
        <section className="card gmail-list-card">
          <div className="gmail-section-header">
            <div>
              <h2>Gmail conversations</h2>
              <p className="page-copy">
                {filteredMessages.length} conversations
              </p>
            </div>
          </div>

          {loading ? (
            <div className="alert alert-info">
              Loading Gmail messages...
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="alert alert-info">
              No analyzed Gmail messages found.
              <br />
              Click <strong>Fetch & Analyze Gmail</strong>.
            </div>
          ) : (
            <div className="gmail-message-list">
              {filteredMessages.map((message) => (
                <button
                  key={message._id}
                  className={`gmail-message ${
                    selected?._id === message._id
                      ? "gmail-message-selected"
                      : ""
                  }`}
                  onClick={() => setSelected(message)}
                >
                  <div className="gmail-message-main">
                    <div className="gmail-message-subject">
                      {message.subject ||
                        "No subject"}
                    </div>

                    <div className="gmail-message-sender">
                      {message.sender ||
                        "Unknown sender"}
                    </div>

                    <div className="gmail-message-summary">
                      {message.summary ||
                        "No AI summary available"}
                    </div>
                  </div>

                  <div className="gmail-message-side">
                    <span
                      className={`gmail-badge ${priorityClass(
                        message.priority
                      )}`}
                    >
                      {message.priority ||
                        "Medium"}
                    </span>

                    <span className="gmail-badge gmail-category">
                      {message.category ||
                        "Other"}
                    </span>

                    <span
                      className={`gmail-badge ${sentimentClass(
                        message.sentiment
                      )}`}
                    >
                      {message.sentiment ||
                        "Neutral"}
                    </span>

                    <span className="gmail-date">
                      {message.receivedAt
                        ? new Date(
                            message.receivedAt
                          ).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="card gmail-detail-card">
          {!selected ? (
            <div className="gmail-empty-detail">
              <div className="gmail-empty-icon">
                âœ‰
              </div>

              <h2>Select an email</h2>

              <p>
                Choose a Gmail conversation to view the
                complete email and its AI analysis.
              </p>
            </div>
          ) : (
            <>
              <div className="gmail-detail-header">
                <div>
                  <p className="eyebrow">
                    EMAIL ANALYSIS
                  </p>

                  <h2>
                    {selected.subject ||
                      "No subject"}
                  </h2>
                </div>

                <span
                  className={`gmail-badge ${priorityClass(
                    selected.priority
                  )}`}
                >
                  {selected.priority ||
                    "Medium"}
                </span>
              </div>

              <div className="gmail-detail-meta">
                <div>
                  <span>From</span>
                  <strong>
                    {selected.sender ||
                      "Unknown"}
                  </strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>
                    {selected.category ||
                      "Other"}
                  </strong>
                </div>

                <div>
                  <span>Sentiment</span>
                  <strong>
                    {selected.sentiment ||
                      "Neutral"}
                  </strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {selected.status ||
                      "Open"}
                  </strong>
                </div>
              </div>

              <div className="gmail-ai-summary">
                <p className="eyebrow">
                  AI SUMMARY
                </p>

                <p>
                  {selected.summary ||
                    "No summary available."}
                </p>
              </div>

              <div className="gmail-original">
                <p className="eyebrow">
                  ORIGINAL EMAIL
                </p>

                <div className="gmail-body">
                  {selected.body ||
                    "Email body unavailable."}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}


