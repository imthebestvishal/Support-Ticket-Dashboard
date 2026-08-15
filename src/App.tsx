import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000";

type Ticket = {
  _id?: string;
  gmailMessageId?: string;
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

const initialTickets: Ticket[] = [
  {
    _id: "demo-1",
    sender: "customer@example.com",
    subject: "Unable to access my account",
    summary: "Customer is unable to log into their account.",
    category: "Technical",
    priority: "High",
    sentiment: "Negative",
    status: "Open",
  },
  {
    _id: "demo-2",
    sender: "client@example.com",
    subject: "Question about billing",
    summary: "Customer wants clarification regarding their latest bill.",
    category: "Billing",
    priority: "Medium",
    sentiment: "Neutral",
    status: "Open",
  },
];

function priorityClass(priority?: string) {
  const value = (priority || "Medium").toLowerCase();

  if (value === "high" || value === "urgent") {
    return "badge badge-red";
  }

  if (value === "medium") {
    return "badge badge-yellow";
  }

  return "badge badge-green";
}

function App() {
  const [active, setActive] = useState("Dashboard");

  const [tickets, setTickets] =
    useState<Ticket[]>(initialTickets);

  const [gmailMessages, setGmailMessages] =
    useState<Ticket[]>([]);

  const [gmailStatus, setGmailStatus] =
    useState("Checking...");

  const [backendStatus, setBackendStatus] =
    useState("Checking...");

  const [gmailLoading, setGmailLoading] =
    useState(false);

  const [gmailError, setGmailError] =
    useState("");

  const [gmailFilter, setGmailFilter] =
    useState("All");

  const [gmailSearch, setGmailSearch] =
    useState("");

  const [showTicketForm, setShowTicketForm] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [assistantQuestion, setAssistantQuestion] =
    useState("");

  const [assistantAnswer, setAssistantAnswer] =
    useState("");

  const [assistantLoading, setAssistantLoading] =
    useState(false);

  const [assistantError, setAssistantError] =
    useState("");

  const [newTicket, setNewTicket] =
    useState({
      title: "",
      customer: "",
      priority: "Medium",
      category: "Technical",
    });

  useEffect(() => {
    checkBackend();
    checkGmail();
  }, []);

  useEffect(() => {
    if (
      gmailStatus.startsWith("Connected")
    ) {
      loadGmailMessages();
    }
  }, [gmailStatus]);

  async function askAssistant() {
    if (!assistantQuestion.trim()) {
      return;
    }

    try {
      setAssistantLoading(true);
      setAssistantError("");
      setAssistantAnswer("");

      const response = await fetch(
        `${API}/api/assistant`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: assistantQuestion.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "AI Assistant request failed"
        );
      }

      setAssistantAnswer(
        data.answer || "No answer received."
      );
    } catch (error) {
      console.error("AI Assistant error:", error);

      setAssistantError(
        error instanceof Error
          ? error.message
          : "AI Assistant failed"
      );
    } finally {
      setAssistantLoading(false);
    }
  }
  async function checkBackend() {
    try {
      const response = await fetch(`${API}/`);

      if (response.ok) {
        setBackendStatus("Online");
      } else {
        setBackendStatus("Offline");
      }
    } catch {
      setBackendStatus("Offline");
    }
  }

  async function checkGmail() {
    try {
      const response = await fetch(
        `${API}/api/gmail/status`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (
        response.status === 401 ||
        data.error === "Not authenticated"
      ) {
        setGmailStatus("Not connected");
        return;
      }

      if (data.connected) {
        setGmailStatus(
          data.email
            ? `Connected: ${data.email}`
            : "Connected"
        );

        localStorage.setItem(
          "gmailConnected",
          "true"
        );

        if (data.email) {
          localStorage.setItem(
            "gmailEmail",
            data.email
          );
        }
      } else {
        setGmailStatus("Not connected");
      }
    } catch (error) {
      console.error(
        "Gmail status error:",
        error
      );

      setGmailStatus("Unavailable");
    }
  }

  async function loadGmailMessages() {
    try {
      setGmailLoading(true);
      setGmailError("");

      const response = await fetch(
        `${API}/api/messages`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setGmailStatus("Not connected");
        setGmailMessages([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load Gmail messages"
        );
      }

      const messages = Array.isArray(data)
        ? data
        : Array.isArray(data.messages)
        ? data.messages
        : [];

      setGmailMessages(messages);

      /*
       * Also use the Gmail messages as dashboard
       * tickets so the dashboard reflects real data.
       */
      if (messages.length > 0) {
        setTickets(messages);
      }
    } catch (error) {
      console.error(
        "Failed to load Gmail messages:",
        error
      );

      setGmailError(
        error instanceof Error
          ? error.message
          : "Failed to load Gmail messages"
      );
    } finally {
      setGmailLoading(false);
    }
  }

  async function analyzeGmail() {
    try {
      setGmailLoading(true);
      setGmailError("");

      setGmailStatus(
        "Analyzing Gmail..."
      );

      const response = await fetch(
        `${API}/api/messages/fetch`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to analyze Gmail"
        );
      }

      console.log(
        "Gmail analysis result:",
        data
      );

      await loadGmailMessages();

      setGmailStatus(
        `Connected · ${data.count || 0} emails analyzed`
      );
    } catch (error) {
      console.error(
        "Gmail analysis error:",
        error
      );

      setGmailError(
        error instanceof Error
          ? error.message
          : "Gmail analysis failed"
      );

      setGmailStatus(
        "Gmail analysis failed"
      );
    } finally {
      setGmailLoading(false);
    }
  }

  function connectGmail() {
    window.location.href =
      `${API}/auth/google`;
  }

  function createTicket(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (
      !newTicket.title ||
      !newTicket.customer
    ) {
      setMessage(
        "Please enter ticket title and customer name."
      );
      return;
    }

    const ticket: Ticket = {
      _id: Date.now().toString(),
      subject: newTicket.title,
      sender: newTicket.customer,
      category: newTicket.category,
      priority: newTicket.priority,
      status: "Open",
      sentiment: "Neutral",
      summary:
        "Manually created support ticket.",
    };

    setTickets((previous) => [
      ticket,
      ...previous,
    ]);

    setNewTicket({
      title: "",
      customer: "",
      priority: "Medium",
      category: "Technical",
    });

    setShowTicketForm(false);

    setMessage(
      "Ticket created successfully."
    );
  }

  const filteredTickets = useMemo(() => {
    const value =
      search.toLowerCase();

    return tickets.filter((ticket) =>
      `
        ${ticket.subject || ""}
        ${ticket.sender || ""}
        ${ticket.category || ""}
        ${ticket.summary || ""}
      `
        .toLowerCase()
        .includes(value)
    );
  }, [tickets, search]);

  const filteredGmailMessages =
    useMemo(() => {
      const searchValue =
        gmailSearch.toLowerCase();

      return gmailMessages.filter(
        (mail) => {
          const priority =
            mail.priority || "Medium";

          const matchesPriority =
            gmailFilter === "All" ||
            priority === gmailFilter ||
            (
              gmailFilter === "High" &&
              priority === "Urgent"
            );

          const searchableText = `
            ${mail.sender || ""}
            ${mail.subject || ""}
            ${mail.summary || ""}
            ${mail.category || ""}
            ${mail.sentiment || ""}
          `.toLowerCase();

          const matchesSearch =
            searchableText.includes(
              searchValue
            );

          return (
            matchesPriority &&
            matchesSearch
          );
        }
      );
    }, [
      gmailMessages,
      gmailFilter,
      gmailSearch,
    ]);

  const totalGmail =
    gmailMessages.length;

  const highGmail =
    gmailMessages.filter(
      (mail) =>
        mail.priority === "High" ||
        mail.priority === "Urgent"
    ).length;

  const mediumGmail =
    gmailMessages.filter(
      (mail) =>
        mail.priority === "Medium"
    ).length;

  const lowGmail =
    gmailMessages.filter(
      (mail) =>
        mail.priority === "Low"
    ).length;

  const openCount =
    tickets.filter(
      (ticket) =>
        ticket.status !== "Resolved"
    ).length;

  const resolvedCount =
    tickets.filter(
      (ticket) =>
        ticket.status === "Resolved"
    ).length;

  const highCount =
    tickets.filter(
      (ticket) =>
        ticket.priority === "High" ||
        ticket.priority === "Urgent"
    ).length;

  const navigation = [
    {
      name: "Dashboard",
      icon: "¦",
    },
    {
      name: "Tickets",
      icon: "?",
    },
    {
      name: "Gmail Analyzer",
      icon: "?",
    },
    {
      name: "AI Assistant",
      icon: "?",
    },
    {
      name: "Knowledge Base",
      icon: "?",
    },
    {
      name: "Settings",
      icon: "?",
    },
  ];

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            S
          </div>

          <div>
            <strong>
              SupportHub
            </strong>

            <span>
              AI Support
            </span>
          </div>
        </div>

        <nav>
          {navigation.map(
            (item) => (
              <button
                key={item.name}
                className={
                  active === item.name
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setActive(item.name)
                }
              >

                {item.name}

                {item.name ===
                  "Tickets" && (
                  <b className="nav-count">
                    {tickets.length}
                  </b>
                )}

                {item.name ===
                  "Gmail Analyzer" &&
                  gmailMessages.length >
                    0 && (
                    <b className="nav-count">
                      {
                        gmailMessages.length
                      }
                    </b>
                  )}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">

          <div className="connection">
            <div>
              <span className="status-dot"></span>
              Backend
            </div>

            <strong>
              {backendStatus}
            </strong>
          </div>

          <div className="connection">
            <div>
              <span className="status-dot"></span>
              Gmail
            </div>

            <strong>
              {gmailStatus.startsWith(
                "Connected"
              )
                ? "Connected"
                : gmailStatus}
            </strong>
          </div>

        </div>

      </aside>

      {/* MAIN */}

      <main className="main">

        <header className="topbar">

          <div>
            <span className="breadcrumb">
              Workspace /
            </span>

            <strong>
              {active}
            </strong>
          </div>

          <div className="top-actions">

            <button
              className="icon-button"
              title="Notifications"
            >•</button>

            <button className="help-button">•</button>

            <button className="profile-button">
              SM
            </button>

          </div>

        </header>

        <section className="content">

          {/* DASHBOARD */}

          {active === "Dashboard" && (
            <>
              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    OVERVIEW
                  </p>

                  <h2>
                    Good evening, Shagun!
                  </h2>

                  <p className="muted">
                    Here's what's happening
                    with your support
                    operations today.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() =>
                    setActive(
                      "Gmail Analyzer"
                    )
                  }
                >
                  Open Gmail ↗
                </button>

              </div>

              <div
                className="stats-grid"
              >

                <div className="panel">
                  <p className="eyebrow">
                    TOTAL TICKETS
                  </p>

                  <h2>
                    {tickets.length}
                  </h2>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    OPEN
                  </p>

                  <h2>
                    {openCount}
                  </h2>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    HIGH PRIORITY
                  </p>

                  <h2>
                    {highCount}
                  </h2>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    RESOLVED
                  </p>

                  <h2>
                    {resolvedCount}
                  </h2>
                </div>

              </div>

              <div className="dashboard-grid">

                <section className="panel tickets-panel">

                  <div className="panel-heading">

                    <div>
                      <h3>
                        Recent Tickets
                      </h3>

                      <p>
                        Latest support
                        conversations.
                      </p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() =>
                        setActive(
                          "Tickets"
                        )
                      }
                    >
                      View all →
                    </button>

                  </div>

                  <div className="search-box">

                    <span>•</span>

                    <input
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search tickets..."
                    />

                  </div>

                  <div className="ticket-list">

                    {filteredTickets
                      .slice(0, 6)
                      .map(
                        (ticket) => (
                          <div
                            className="ticket-row"
                            key={
                              ticket._id
                            }
                          >

                            <div>

                              <div className="ticket-title">
                                {ticket.subject ||
                                  "Untitled conversation"}
                              </div>

                              <div className="ticket-meta">
                                {ticket.sender ||
                                  "Unknown sender"}
                              </div>

                              <div className="ticket-meta">
                                {ticket.summary ||
                                  "No summary available"}
                              </div>

                            </div>

                            <div className="badges">

                              <span className="badge badge-gray">
                                {ticket.category ||
                                  "Other"}
                              </span>

                              <span
                                className={priorityClass(
                                  ticket.priority
                                )}
                              >
                                {ticket.priority ||
                                  "Medium"}
                              </span>

                              <span className="badge badge-gray">
                                {ticket.status ||
                                  "Open"}
                              </span>

                            </div>

                          </div>
                        )
                      )}

                  </div>

                </section>

                <section className="side-column">

                  <div className="panel gmail-card">

                    <div className="gmail-header">

                      <div className="gmail-logo">
                        M
                      </div>

                      <div>
                        <h3>
                          Gmail Analyzer
                        </h3>

                        <p>
                          Analyze customer
                          emails with AI
                        </p>
                      </div>

                    </div>

                    <div className="gmail-status">

                      <span
                        className={
                          gmailStatus.startsWith(
                            "Connected"
                          )
                            ? "green-dot"
                            : "orange-dot"
                        }
                      ></span>

                      Gmail:
                      <strong>
                        {gmailStatus}
                      </strong>

                    </div>

                    <button
                      className="outline-button"
                      onClick={() =>
                        setActive(
                          "Gmail Analyzer"
                        )
                      }
                    >
                      Open Gmail Analyzer →
                    </button>

                  </div>

                  <div className="panel ai-card">

                    <div className="ai-symbol">•</div>

                    <h3>
                      AI Support Assistant
                    </h3>

                    <p>
                      Get instant help
                      summarizing tickets,
                      drafting replies and
                      finding solutions.
                    </p>

                    <button
                      className="primary-button full"
                      onClick={() =>
                        setActive(
                          "AI Assistant"
                        )
                      }
                    >
                      Open Assistant
                    </button>

                  </div>

                </section>

              </div>
            </>
          )}

          {/* TICKETS */}

          {active === "Tickets" && (
            <div>

              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    SUPPORT
                  </p>

                  <h2>
                    All Tickets
                  </h2>

                  <p className="muted">
                    Create and manage
                    customer tickets.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() =>
                    setShowTicketForm(true)
                  }
                >
                  + New Ticket
                </button>

              </div>

              {message && (
                <div className="alert">
                  {message}
                </div>
              )}

              <section className="panel">

                <div className="search-box">

                  <span>•</span>

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Search tickets..."
                  />

                </div>

                <div className="ticket-list">

                  {filteredTickets.length ===
                  0 ? (
                    <div className="empty-state">
                      No tickets found.
                    </div>
                  ) : (
                    filteredTickets.map(
                      (ticket) => (
                        <div
                          className="ticket-row"
                          key={
                            ticket._id
                          }
                        >

                          <div>

                            <div className="ticket-title">
                              {ticket.subject ||
                                "Untitled"}
                            </div>

                            <div className="ticket-meta">
                              {ticket.sender ||
                                "Unknown customer"}
                            </div>

                            <div className="ticket-meta">
                              {ticket.summary ||
                                "No summary"}
                            </div>

                          </div>

                          <div className="badges">

                            <span className="badge badge-gray">
                              {ticket.category ||
                                "Other"}
                            </span>

                            <span
                              className={priorityClass(
                                ticket.priority
                              )}
                            >
                              {ticket.priority ||
                                "Medium"}
                            </span>

                            <span className="badge badge-gray">
                              {ticket.status ||
                                "Open"}
                            </span>

                          </div>

                        </div>
                      )
                    )
                  )}

                </div>

              </section>

            </div>
          )}

          {/* GMAIL ANALYZER */}

          {active === "Gmail Analyzer" && (
            <section className="gmail-page">

              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    EMAIL INTELLIGENCE
                  </p>

                  <h2>
                    Gmail Priority Inbox
                  </h2>

                  <p className="muted">
                    View your Gmail conversations
                    analyzed by Gemini AI.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                  }}
                >

                  <button
                    className="outline-button"
                    onClick={
                      loadGmailMessages
                    }
                    disabled={
                      gmailLoading
                    }
                  >
                    ? Refresh
                  </button>

                  <button
                    className="primary-button"
                    onClick={
                      gmailStatus.startsWith(
                        "Connected"
                      )
                        ? analyzeGmail
                        : connectGmail
                    }
                    disabled={
                      gmailLoading
                    }
                  >
                    {gmailLoading
                      ? "Processing..."
                      : gmailStatus.startsWith(
                          "Connected"
                        )
                      ? "? Fetch & Analyze Gmail"
                      : "Connect Gmail"}
                  </button>

                </div>

              </div>

              <div className="feature-status">

                <span
                  className={
                    gmailStatus.startsWith(
                      "Connected"
                    )
                      ? "green-dot"
                      : "orange-dot"
                  }
                ></span>

                Backend:
                {" "}
                {backendStatus}
                {" · "}
                Gmail:
                {" "}
                {gmailStatus}

              </div>

              {gmailError && (
                <div className="alert">
                  <strong>
                    Gmail error:
                  </strong>{" "}
                  {gmailError}
                </div>
              )}

              {/* STAT CARDS */}

              <div
                className="stats-grid"
                style={{
                  marginTop: "24px",
                }}
              >

                <div className="panel">
                  <p className="eyebrow">
                    TOTAL
                  </p>

                  <h2>
                    {totalGmail}
                  </h2>

                  <p className="muted">
                    Emails analyzed
                  </p>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    HIGH PRIORITY
                  </p>

                  <h2>
                    {highGmail}
                  </h2>

                  <p className="muted">
                    Immediate attention
                  </p>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    MEDIUM
                  </p>

                  <h2>
                    {mediumGmail}
                  </h2>

                  <p className="muted">
                    Normal attention
                  </p>
                </div>

                <div className="panel">
                  <p className="eyebrow">
                    LOW
                  </p>

                  <h2>
                    {lowGmail}
                  </h2>

                  <p className="muted">
                    Low urgency
                  </p>
                </div>

              </div>

              {/* SEARCH */}

              <section
                className="panel"
                style={{
                  marginTop: "24px",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >

                  <div
                    className="search-box"
                    style={{
                      flex: 1,
                      minWidth:
                        "280px",
                    }}
                  >

                    <span>•</span>

                    <input
                      value={
                        gmailSearch
                      }
                      onChange={(e) =>
                        setGmailSearch(
                          e.target.value
                        )
                      }
                      placeholder="Search sender, subject, summary..."
                    />

                  </div>

                  <select
                    value={
                      gmailFilter
                    }
                    onChange={(e) =>
                      setGmailFilter(
                        e.target.value
                      )
                    }
                    style={{
                      padding:
                        "12px 16px",
                      borderRadius:
                        "8px",
                      border:
                        "1px solid #ddd",
                      background:
                        "white",
                    }}
                  >

                    <option value="All">
                      All priorities
                    </option>

                    <option value="High">
                      High
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="Low">
                      Low
                    </option>

                  </select>

                </div>

              </section>

              {/* EMAIL LIST */}

              <section
                className="panel"
                style={{
                  marginTop: "24px",
                }}
              >

                <div className="panel-heading">

                  <div>
                    <h3>
                      Gmail Conversations
                    </h3>

                    <p>
                      {
                        filteredGmailMessages.length
                      } conversations shown
                    </p>
                  </div>

                </div>

                {gmailLoading ? (
                  <div className="empty-state">
                    <h3>
                      Analyzing Gmail...
                    </h3>

                    <p>
                      Gmail messages are being
                      retrieved and analyzed
                      by Gemini.
                    </p>
                  </div>
                ) : !gmailStatus.startsWith(
                    "Connected"
                  ) ? (
                  <div className="empty-state">

                    <h3>
                      Gmail is not connected
                    </h3>

                    <p>
                      Connect your Gmail
                      account to start
                      analyzing emails.
                    </p>

                    <button
                      className="primary-button"
                      onClick={
                        connectGmail
                      }
                    >
                      Connect Gmail
                    </button>

                  </div>
                ) : filteredGmailMessages.length ===
                  0 ? (
                  <div className="empty-state">

                    <h3>
                      No analyzed emails
                    </h3>

                    <p>
                      Click "Fetch & Analyze
                      Gmail" to retrieve
                      messages from your
                      inbox.
                    </p>

                    <button
                      className="primary-button"
                      onClick={
                        analyzeGmail
                      }
                    >
                      ? Fetch & Analyze Gmail
                    </button>

                  </div>
                ) : (
                  <div className="ticket-list">

                    {filteredGmailMessages.map(
                      (mail) => (
                        <div
                          className="ticket-row"
                          key={
                            mail._id ||
                            mail.gmailMessageId
                          }
                        >

                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >

                            <div className="ticket-title">
                              {mail.subject ||
                                "No subject"}
                            </div>

                            <div className="ticket-meta">
                              From:{" "}
                              {mail.sender ||
                                "Unknown sender"}
                            </div>

                            <div
                              className="ticket-meta"
                              style={{
                                marginTop:
                                  "8px",
                              }}
                            >
                              {mail.summary ||
                                "No AI summary available."}
                            </div>

                            <div
                              className="ticket-meta"
                              style={{
                                marginTop:
                                  "8px",
                              }}
                            >
                              {mail.receivedAt
                                ? new Date(
                                    mail.receivedAt
                                  ).toLocaleString()
                                : "Date unavailable"}
                            </div>

                          </div>

                          <div
                            className="badges"
                            style={{
                              minWidth:
                                "180px",
                            }}
                          >

                            <span className="badge badge-gray">
                              {mail.category ||
                                "Other"}
                            </span>

                            <span
                              className={priorityClass(
                                mail.priority
                              )}
                            >
                              {mail.priority ||
                                "Medium"}
                            </span>

                            <span className="badge badge-gray">
                              {mail.sentiment ||
                                "Neutral"}
                            </span>

                            <span className="badge badge-gray">
                              {mail.status ||
                                "Open"}
                            </span>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

            </section>
          )}

          {/* AI ASSISTANT */}

          {active === "AI Assistant" && (
            <section className="feature-page">

              <div className="feature-icon ai-big">•</div>

              <p className="eyebrow">
                AI SUPPORT
              </p>

              <h2>
                AI Support Assistant
              </h2>

              <p>
                Ask questions about tickets,
                create response drafts,
                summarize conversations,
                and find relevant solutions.
              </p>

              <div className="panel">

                <div className="chat-message">
                  <strong>
                    AI Assistant
                  </strong>

                  <p>
                    I can help you analyze
                    support conversations
                    and prioritize tickets.
                  </p>
                </div>

                <div className="chat-input">

                  <input
                    value={assistantQuestion}
                    onChange={(event) =>
                      setAssistantQuestion(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !assistantLoading
                      ) {
                        askAssistant();
                      }
                    }}
                    placeholder="Ask the AI assistant something..."
                    disabled={assistantLoading}
                  />

                  <button
                    onClick={askAssistant}
                    disabled={
                      assistantLoading ||
                      !assistantQuestion.trim()
                    }
                  >
                    {assistantLoading
                      ? "Thinking..."
                      : "Send"}
                  </button>

                </div>

                {assistantError && (
                  <div className="alert">
                    {assistantError}
                  </div>
                )}

                {assistantAnswer && (
                  <div className="chat-message">

                    <strong>
                      AI Assistant
                    </strong>

                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {assistantAnswer}
                    </p>

                  </div>
                )}

              </div>

            </section>
          )}

          {/* KNOWLEDGE BASE */}

          {active === "Knowledge Base" && (
            <section className="feature-page">

              <div className="feature-icon">•</div>

              <p className="eyebrow">
                SELF SERVICE
              </p>

              <h2>
                Knowledge Base
              </h2>

              <p>
                Store troubleshooting guides,
                FAQs, product documentation
                and reusable support solutions.
              </p>

              <div className="panel">

                <h3>
                  Support documentation
                </h3>

                <p className="muted">
                  Knowledge base management
                  can be connected to your
                  backend here.
                </p>

              </div>

            </section>
          )}

          {/* SETTINGS */}

          {active === "Settings" && (
            <section className="feature-page">

              <p className="eyebrow">
                CONFIGURATION
              </p>

              <h2>
                Settings
              </h2>

              <div className="panel">

                <div className="settings-list">

                  <div>
                    <strong>
                      Backend URL
                    </strong>

                    <span>
                      {API}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Backend status
                    </strong>

                    <span>
                      {backendStatus}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Gmail status
                    </strong>

                    <span>
                      {gmailStatus}
                    </span>
                  </div>

                  <div>
                    <strong>
                      Analyzed emails
                    </strong>

                    <span>
                      {gmailMessages.length}
                    </span>
                  </div>

                </div>

              </div>

            </section>
          )}

        </section>

      </main>

      {/* NEW TICKET MODAL */}

      {showTicketForm && (
        <div className="modal-overlay">

          <div className="modal">

            <h2>
              Create Ticket
            </h2>

            <form
              onSubmit={
                createTicket
              }
            >

              <label>
                Ticket title

                <input
                  value={
                    newTicket.title
                  }
                  onChange={(e) =>
                    setNewTicket({
                      ...newTicket,
                      title:
                        e.target.value,
                    })
                  }
                  placeholder="Enter ticket title"
                />
              </label>

              <label>
                Customer

                <input
                  value={
                    newTicket.customer
                  }
                  onChange={(e) =>
                    setNewTicket({
                      ...newTicket,
                      customer:
                        e.target.value,
                    })
                  }
                  placeholder="Customer email/name"
                />
              </label>

              <label>
                Category

                <select
                  value={
                    newTicket.category
                  }
                  onChange={(e) =>
                    setNewTicket({
                      ...newTicket,
                      category:
                        e.target.value,
                    })
                  }
                >
                  <option>
                    Technical
                  </option>

                  <option>
                    Billing
                  </option>

                  <option>
                    Account
                  </option>

                  <option>
                    General
                  </option>
                </select>
              </label>

              <label>
                Priority

                <select
                  value={
                    newTicket.priority
                  }
                  onChange={(e) =>
                    setNewTicket({
                      ...newTicket,
                      priority:
                        e.target.value,
                    })
                  }
                >
                  <option>
                    High
                  </option>

                  <option>
                    Medium
                  </option>

                  <option>
                    Low
                  </option>
                </select>
              </label>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >

                <button
                  type="button"
                  className="outline-button"
                  onClick={() =>
                    setShowTicketForm(
                      false
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Create Ticket
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;







