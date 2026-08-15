import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";

type BackendMessage = {
  _id: string;
  gmailMessageId: string;
  userId: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  category: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  summary: string;
  sentiment: "Positive" | "Neutral" | "Negative";
  suggestedResponse: string;
  isTicket: boolean;
  status?: "Open" | "In Progress" | "Resolved";
};

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  email: string;
  status: "Pending" | "Resolved";
  priority: "High" | "Medium" | "Low" | "Urgent";
  category: string;
  message: string;
  orderId: string;
  received: string;
  reply: string;
  summary: string;
  sentiment: string;
};

const API_BASE = "http://localhost:5000";

function getCustomerName(sender: string) {
  if (!sender) return "Unknown Customer";

  const match = sender.match(/^"?([^"<]+)"?\s*</);

  if (match?.[1]) {
    return match[1].trim();
  }

  return sender.split("@")[0] || "Unknown Customer";
}

function getCustomerEmail(sender: string) {
  if (!sender) return "";

  const match = sender.match(/<([^>]+)>/);

  if (match?.[1]) {
    return match[1];
  }

  return sender;
}

function formatReceived(date: string) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString();
}

function convertMessageToTicket(
  message: BackendMessage,
  index: number
): Ticket {
  return {
    id: `TICKET-${message._id || index}`,
    subject: message.subject || "No Subject",
    customer: getCustomerName(message.sender),
    email: getCustomerEmail(message.sender),
    status:
      message.status === "Resolved"
        ? "Resolved"
        : "Pending",
    priority: message.priority || "Medium",
    category: message.category || "Other",
    message: message.body || message.summary || "",
    orderId: "—",
    received: formatReceived(message.receivedAt),
    reply:
      message.suggestedResponse ||
      "Thank you for contacting us. We will review your request and get back to you shortly.",
    summary: message.summary || "",
    sentiment: message.sentiment || "Neutral",
  };
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState<
    "All" | "Pending" | "Resolved"
  >("All");

  const [editingReply, setEditingReply] =
    useState(false);

  const [editedReply, setEditedReply] =
    useState("");

  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [fetching, setFetching] = useState(false);

  const [connected, setConnected] = useState(false);

  const [email, setEmail] = useState("");

  /*
   * Load Gmail connection status
   */
  async function loadStatus() {
    try {
      const response = await fetch(
        `${API_BASE}/api/gmail/status`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        setConnected(false);
        return;
      }

      const data = await response.json();

      setConnected(!!data.connected);
      setEmail(data.email || "");
    } catch (error) {
      console.error(
        "Failed to load Gmail status:",
        error
      );

      setConnected(false);
    }
  }

  /*
   * Load stored analyzed tickets
   */
  async function loadMessages() {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE}/api/messages`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load messages: ${response.status}`
        );
      }

      const data: BackendMessage[] =
        await response.json();

      const converted = data.map(
        convertMessageToTicket
      );

      setTickets(converted);

      if (converted.length > 0) {
        setSelectedId((current) =>
          current &&
          converted.some(
            (ticket) => ticket.id === current
          )
            ? current
            : converted[0].id
        );
      } else {
        setSelectedId("");
      }
    } catch (error) {
      console.error(
        "Failed to load tickets:",
        error
      );

      setMessage(
        "Unable to load tickets from the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Fetch unread Gmail messages and analyze them
   */
  async function fetchUnreadMessages() {
    try {
      setFetching(true);
      setMessage(
        "Fetching unread Gmail messages and analyzing them..."
      );

      const response = await fetch(
        `${API_BASE}/api/messages/fetch`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to fetch Gmail messages"
        );
      }

      await loadMessages();

      setMessage(
        `Fetched and analyzed ${
          data.count ?? 0
        } Gmail message(s).`
      );
    } catch (error) {
      console.error(
        "Failed to fetch Gmail messages:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch Gmail messages."
      );
    } finally {
      setFetching(false);
    }
  }

  /*
   * Initial dashboard load
   */
  useEffect(() => {
    async function initialize() {
      await loadStatus();
      await loadMessages();
    }

    initialize();
  }, []);

  const selectedTicket =
    tickets.find(
      (ticket) => ticket.id === selectedId
    ) ?? tickets[0];

  const visibleTickets = useMemo(() => {
    if (filter === "All") {
      return tickets;
    }

    return tickets.filter(
      (ticket) => ticket.status === filter
    );
  }, [tickets, filter]);

  const pendingCount = tickets.filter(
    (ticket) => ticket.status === "Pending"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "Resolved"
  ).length;

  function selectTicket(ticket: Ticket) {
    setSelectedId(ticket.id);
    setEditingReply(false);
    setMessage("");
  }

  function markResolved() {
    if (!selectedTicket) return;

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === selectedTicket.id
          ? {
              ...ticket,
              status: "Resolved",
            }
          : ticket
      )
    );

    setMessage("Ticket marked as resolved.");
  }

  function escalateIssue() {
    setMessage(
      "Ticket escalated for further review."
    );
  }

  function startEditing() {
    if (!selectedTicket) return;

    setEditedReply(selectedTicket.reply);
    setEditingReply(true);
    setMessage("");
  }

  function saveReply() {
    if (!selectedTicket) return;

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === selectedTicket.id
          ? {
              ...ticket,
              reply: editedReply,
            }
          : ticket
      )
    );

    setEditingReply(false);
    setMessage("Reply saved.");
  }

  function sendResponse() {
    setMessage(
      "Response UI is ready. Sending through Gmail can be connected next."
    );
  }

  function connectGmail() {
    window.location.href =
      `${API_BASE}/auth/google?redirect=` +
      encodeURIComponent(
        window.location.origin
      );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1>Support Ticket Dashboard</h1>

            <p>
              Manage customer support tickets with
              AI assistance.
            </p>

            <div
              style={{
                marginTop: "8px",
                fontSize: "14px",
              }}
            >
              <strong>Gmail:</strong>{" "}
              {connected
                ? `Connected ${
                    email ? `(${email})` : ""
                  }`
                : "Not connected"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
            }}
          >
            {!connected && (
              <button
                className="primary-button"
                onClick={connectGmail}
              >
                Connect Gmail
              </button>
            )}

            <button
              className="secondary-button"
              onClick={loadMessages}
              disabled={loading}
            >
              Refresh
            </button>

            <button
              className="primary-button"
              onClick={fetchUnreadMessages}
              disabled={
                fetching || !connected
              }
            >
              {fetching
                ? "Fetching..."
                : "Fetch Unread Messages"}
            </button>
          </div>
        </div>

        {message && (
          <div className="dashboard-message">
            {message}
          </div>
        )}

        <div className="dashboard-grid">
          {/* LEFT - TICKETS */}

          <section className="dashboard-card ticket-panel">
            <div className="card-header">
              <h2>
                Tickets ({tickets.length})
              </h2>
            </div>

            <div className="filter-buttons">
              {(
                [
                  "All",
                  "Pending",
                  "Resolved",
                ] as const
              ).map((item) => (
                <button
                  key={item}
                  className={
                    filter === item
                      ? "filter-button active"
                      : "filter-button"
                  }
                  onClick={() =>
                    setFilter(item)
                  }
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="ticket-list">
              {loading ? (
                <div style={{ padding: "20px" }}>
                  Loading tickets...
                </div>
              ) : visibleTickets.length ===
                0 ? (
                <div
                  style={{
                    padding: "20px",
                  }}
                >
                  No tickets found.
                  <br />
                  <small>
                    Connect Gmail and click
                    "Fetch Unread Messages".
                  </small>
                </div>
              ) : (
                visibleTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={
                      ticket.id ===
                      selectedTicket?.id
                        ? "ticket-item selected"
                        : "ticket-item"
                    }
                    onClick={() =>
                      selectTicket(ticket)
                    }
                  >
                    <div className="ticket-item-title">
                      {ticket.subject}
                    </div>

                    <div className="ticket-item-meta">
                      <span>
                        {ticket.category}
                      </span>

                      <span>
                        {ticket.priority}
                      </span>
                    </div>

                    <small>
                      {ticket.customer}
                    </small>
                  </button>
                ))
              )}
            </div>

            <div className="metrics">
              <h3>Metrics</h3>

              <div className="metric">
                <span>Open Tickets</span>
                <strong>
                  {pendingCount}
                </strong>
              </div>

              <div className="metric">
                <span>Resolved Today</span>
                <strong>
                  {resolvedCount}
                </strong>
              </div>

              <div className="metric">
                <span>Total Tickets</span>
                <strong>
                  {tickets.length}
                </strong>
              </div>
            </div>
          </section>

          {/* CENTER - DETAILS */}

          <section className="dashboard-card details-panel">
            <h2>Ticket Details</h2>

            {!selectedTicket ? (
              <div
                style={{
                  padding: "30px 0",
                }}
              >
                <h3>No ticket selected</h3>

                <p>
                  Fetch unread Gmail messages to
                  create AI-analyzed tickets.
                </p>
              </div>
            ) : (
              <div className="ticket-details">
                <h2>
                  {selectedTicket.subject}
                </h2>

                <div className="detail-row">
                  <div>
                    <strong>Category</strong>
                    <span>
                      {selectedTicket.category}
                    </span>
                  </div>

                  <div>
                    <strong>Priority</strong>
                    <span>
                      {
                        selectedTicket.priority
                      }
                    </span>
                  </div>
                </div>

                <hr />

                <div className="customer-info">
                  <strong>
                    {selectedTicket.customer}
                  </strong>

                  <span>
                    {selectedTicket.email}
                  </span>

                  <small>
                    Received:{" "}
                    {selectedTicket.received}
                  </small>
                </div>

                <hr />

                <h3>Customer Message</h3>

                <div className="customer-message">
                  {selectedTicket.message}
                </div>

                <hr />

                <h3>AI Summary</h3>

                <div className="customer-message">
                  {selectedTicket.summary ||
                    "No summary available."}
                </div>

                <hr />

                <div className="detail-row">
                  <div>
                    <strong>Sentiment</strong>

                    <span>
                      {
                        selectedTicket.sentiment
                      }
                    </span>
                  </div>

                  <div>
                    <strong>Order ID</strong>

                    <span>
                      {selectedTicket.orderId}
                    </span>
                  </div>
                </div>

                <hr />

                <h3>Status</h3>

                <div
                  className={
                    selectedTicket.status ===
                    "Pending"
                      ? "status pending"
                      : "status resolved"
                  }
                >
                  {selectedTicket.status}
                </div>

                <div className="action-buttons">
                  <button
                    className="success-button"
                    onClick={markResolved}
                    disabled={
                      selectedTicket.status ===
                      "Resolved"
                    }
                  >
                    Mark as Resolved
                  </button>

                  <button
                    className="danger-button"
                    onClick={escalateIssue}
                  >
                    Escalate Issue
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* RIGHT - REPLY */}

          <section className="dashboard-card reply-panel">
            <h2>Suggested Reply</h2>

            {!selectedTicket ? (
              <div className="reply-box">
                No ticket selected.
              </div>
            ) : !editingReply ? (
              <div className="reply-box">
                {selectedTicket.reply}
              </div>
            ) : (
              <textarea
                value={editedReply}
                onChange={(event) =>
                  setEditedReply(
                    event.target.value
                  )
                }
                rows={16}
                className="reply-editor"
              />
            )}

            <hr />

            {selectedTicket && (
              <div className="action-buttons">
                {!editingReply ? (
                  <>
                    <button
                      className="primary-button"
                      onClick={sendResponse}
                    >
                      Send Response
                    </button>

                    <button
                      className="secondary-button"
                      onClick={startEditing}
                    >
                      Edit Reply
                    </button>
                  </>
                ) : (
                  <button
                    className="primary-button"
                    onClick={saveReply}
                  >
                    Save Reply
                  </button>
                )}
              </div>
            )}

            <p className="ai-caption">
              Suggested reply generated automatically
              by Gemini.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}


