import { useEffect, useState } from "react";

const API = "http://localhost:5000";

type Ticket = {
  id: number;
  title: string;
  customer: string;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved";
  category: string;
};

const initialTickets: Ticket[] = [
  {
    id: 1001,
    title: "Unable to access account",
    customer: "Rahul Sharma",
    priority: "High",
    status: "Open",
    category: "Account",
  },
  {
    id: 1002,
    title: "Payment confirmation missing",
    customer: "Priya Singh",
    priority: "Medium",
    status: "In Progress",
    category: "Billing",
  },
  {
    id: 1003,
    title: "Password reset request",
    customer: "Amit Kumar",
    priority: "Low",
    status: "Resolved",
    category: "Account",
  },
  {
    id: 1004,
    title: "Application not loading",
    customer: "Neha Verma",
    priority: "High",
    status: "Open",
    category: "Technical",
  },
];

function App() {
  const [active, setActive] = useState("Dashboard");
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [gmailStatus, setGmailStatus] = useState("Checking...");
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [newTicket, setNewTicket] = useState({
    title: "",
    customer: "",
    priority: "Medium" as Ticket["priority"],
    category: "Technical",
  });

  useEffect(() => {
    checkBackend();
    checkGmail();
  }, []);

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
      const response = await fetch(`${API}/api/gmail/status`);
      const data = await response.json();

      if (data.error === "Not authenticated") {
        setGmailStatus("Not connected");
      } else {
        setGmailStatus("Connected");
      }
    } catch {
      setGmailStatus("Unavailable");
    }
  }

  function createTicket(e: React.FormEvent) {
    e.preventDefault();

    if (!newTicket.title || !newTicket.customer) {
      setMessage("Please enter ticket title and customer name.");
      return;
    }

    const ticket: Ticket = {
      id: Date.now(),
      title: newTicket.title,
      customer: newTicket.customer,
      priority: newTicket.priority,
      status: "Open",
      category: newTicket.category,
    };

    setTickets((current) => [ticket, ...current]);
    setNewTicket({
      title: "",
      customer: "",
      priority: "Medium",
      category: "Technical",
    });
    setShowTicketForm(false);
    setMessage("Ticket created successfully.");
  }

  function changeStatus(id: number) {
    setTickets((current) =>
      current.map((ticket) => {
        if (ticket.id !== id) return ticket;

        const next =
          ticket.status === "Open"
            ? "In Progress"
            : ticket.status === "In Progress"
              ? "Resolved"
              : "Open";

        return { ...ticket, status: next };
      })
    );
  }

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.customer.toLowerCase().includes(search.toLowerCase()) ||
      ticket.category.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = tickets.filter((t) => t.status === "Open").length;
  const progressCount = tickets.filter(
    (t) => t.status === "In Progress"
  ).length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;
  const highCount = tickets.filter((t) => t.priority === "High").length;

  const navigation = [
    { name: "Dashboard", icon: "⌂" },
    { name: "Tickets", icon: "▤" },
    { name: "Gmail Analyzer", icon: "✉" },
    { name: "AI Assistant", icon: "✦" },
    { name: "Knowledge Base", icon: "▣" },
    { name: "Settings", icon: "⚙" },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">S</div>
          <div>
            <h1>SupportHub</h1>
            <span>Support Intelligence</span>
          </div>
        </div>

        <div className="workspace">
          <span className="workspace-label">WORKSPACE</span>
          <div className="workspace-box">
            <div className="workspace-avatar">SD</div>
            <div>
              <strong>Support Team</strong>
              <small>Admin workspace</small>
            </div>
            <span>⋯</span>
          </div>
        </div>

        <nav>
          {navigation.map((item) => (
            <button
              key={item.name}
              className={active === item.name ? "nav-item active" : "nav-item"}
              onClick={() => setActive(item.name)}
            >
              <span>{item.icon}</span>
              {item.name}
              {item.name === "Tickets" && (
                <b className="nav-count">{tickets.length}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection">
            <div>
              <span className="status-dot"></span>
              Backend
            </div>
            <strong>{backendStatus}</strong>
          </div>

          <div className="user">
            <div className="user-avatar">SM</div>
            <div>
              <strong>Shagun Mehta</strong>
              <small>Administrator</small>
            </div>
            <span>⋯</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace /</span>
            <strong>{active}</strong>
          </div>

          <div className="top-actions">
            <button className="icon-button" title="Notifications">•</button>
            <button className="help-button">•</button>
            <button className="profile-button">SM</button>
          </div>
        </header>

        <section className="content">
          {active === "Dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">OVERVIEW</p>
                  <h2>Good evening, Shagun!</h2>
                  <p className="muted">
                    Here's what's happening with your support operations today.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setShowTicketForm(true)}
                >
                  + Create Ticket
                </button>
              </div>

              {message && (
                <div className="success-message">
                  {message}
                  <button onClick={() => setMessage("")}>×</button>
                </div>
              )}

              <div className="stats">
                <div className="stat-card">
                  <div className="stat-icon blue">▦</div>
                  <div>
                    <span>Total Tickets</span>
                    <strong>{tickets.length}</strong>
                    <small>All support requests</small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">!</div>
                  <div>
                    <span>Open Tickets</span>
                    <strong>{openCount}</strong>
                    <small>Need attention</small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon purple">◒</div>
                  <div>
                    <span>In Progress</span>
                    <strong>{progressCount}</strong>
                    <small>Being handled</small>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">✓</div>
                  <div>
                    <span>Resolved</span>
                    <strong>{resolvedCount}</strong>
                    <small>Successfully closed</small>
                  </div>
                </div>
              </div>

              <div className="dashboard-grid">
                <section className="panel tickets-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Recent Tickets</h3>
                      <p>Manage your latest support requests</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActive("Tickets")}
                    >
                      View all →
                    </button>
                  </div>

                  <div className="search-box">
                    <span>⋯</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search tickets..."
                    />
                  </div>

                  <div className="ticket-list">
                    {filteredTickets.slice(0, 5).map((ticket) => (
                      <div className="ticket-row" key={ticket.id}>
                        <div className="ticket-number">#{ticket.id}</div>
                        <div className="ticket-main">
                          <strong>{ticket.title}</strong>
                          <span>
                            {ticket.customer} · {ticket.category}
                          </span>
                        </div>
                        <span
                          className={`priority ${ticket.priority.toLowerCase()}`}
                        >
                          {ticket.priority}
                        </span>
                        <button
                          className={`status ${ticket.status
                            .toLowerCase()
                            .replace(" ", "-")}`}
                          onClick={() => changeStatus(ticket.id)}
                        >
                          {ticket.status}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="side-column">
                  <div className="panel gmail-card">
                    <div className="gmail-header">
                      <div className="gmail-logo">M</div>
                      <div>
                        <h3>Gmail Analyzer</h3>
                        <p>Analyze customer emails with AI</p>
                      </div>
                    </div>

                    <div className="gmail-status">
                      <span
                        className={
                          gmailStatus === "Connected"
                            ? "green-dot"
                            : "orange-dot"
                        }
                      ></span>
                      Gmail: <strong>{gmailStatus}</strong>
                    </div>

                    <button
                      className="outline-button"
                      onClick={() =>
                        (window.location.href = `${API}/auth/google`)
                      }
                    >
                      Connect Gmail →
                    </button>
                  </div>

                  <div className="panel ai-card">
                    <div className="ai-symbol">✦</div>
                    <h3>AI Support Assistant</h3>
                    <p>
                      Get instant help summarizing tickets, drafting replies,
                      and finding solutions.
                    </p>
                    <button
                      className="primary-button full"
                      onClick={() => setActive("AI Assistant")}
                    >
                      Open Assistant
                    </button>
                  </div>
                </section>
              </div>

              <div className="bottom-grid">
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Ticket Overview</h3>
                      <p>Current ticket distribution</p>
                    </div>
                  </div>
                  <div className="overview-bars">
                    <div>
                      <span>Open</span>
                      <div className="bar">
                        <i style={{ width: `${Math.max(openCount * 20, 8)}%` }} />
                      </div>
                      <strong>{openCount}</strong>
                    </div>
                    <div>
                      <span>In Progress</span>
                      <div className="bar">
                        <i
                          style={{
                            width: `${Math.max(progressCount * 20, 8)}%`,
                          }}
                        />
                      </div>
                      <strong>{progressCount}</strong>
                    </div>
                    <div>
                      <span>Resolved</span>
                      <div className="bar">
                        <i
                          style={{
                            width: `${Math.max(resolvedCount * 20, 8)}%`,
                          }}
                        />
                      </div>
                      <strong>{resolvedCount}</strong>
                    </div>
                  </div>
                </div>

                <div className="panel attention-card">
                  <div className="attention-icon">!</div>
                  <div>
                    <span>High priority</span>
                    <strong>{highCount} tickets need attention</strong>
                    <small>Review them before the end of the day.</small>
                  </div>
                </div>
              </div>
            </>
          )}

          {active === "Tickets" && (
            <div>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">SUPPORT</p>
                  <h2>All Tickets</h2>
                  <p className="muted">Create and manage customer tickets.</p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setShowTicketForm(true)}
                >
                  + Create Ticket
                </button>
              </div>

              <section className="panel full-panel">
                <div className="search-box">
                  <span>⋯</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ticket, customer or category..."
                  />
                </div>

                <div className="table">
                  <div className="table-header">
                    <span>ID</span>
                    <span>Ticket</span>
                    <span>Customer</span>
                    <span>Priority</span>
                    <span>Status</span>
                  </div>

                  {filteredTickets.map((ticket) => (
                    <div className="table-row" key={ticket.id}>
                      <span>#{ticket.id}</span>
                      <strong>{ticket.title}</strong>
                      <span>{ticket.customer}</span>
                      <span
                        className={`priority ${ticket.priority.toLowerCase()}`}
                      >
                        {ticket.priority}
                      </span>
                      <button
                        className={`status ${ticket.status
                          .toLowerCase()
                          .replace(" ", "-")}`}
                        onClick={() => changeStatus(ticket.id)}
                      >
                        {ticket.status}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {active === "Gmail Analyzer" && (
            <section className="feature-page">
              <div className="feature-icon gmail-big">M</div>
              <p className="eyebrow">EMAIL INTELLIGENCE</p>
              <h2>Gmail Analyzer</h2>
              <p>
                Connect your Gmail account to analyze customer emails,
                identify support issues, and turn conversations into tickets.
              </p>
              <div className="feature-status">
                <span className="green-dot"></span>
                Backend: {backendStatus} · Gmail: {gmailStatus}
              </div>
              <button
                className="primary-button"
                onClick={() =>
                  (window.location.href = `${API}/auth/google`)
                }
              >
                Connect Gmail
              </button>
            </section>
          )}

          {active === "AI Assistant" && (
            <section className="feature-page">
              <div className="feature-icon ai-big">✦</div>
              <p className="eyebrow">AI SUPPORT</p>
              <h2>AI Support Assistant</h2>
              <p>
                Ask questions about tickets, create response drafts, summarize
                support conversations, and find relevant solutions.
              </p>
              <div className="chat-box">
                <div className="chat-message">
                  <div className="assistant-avatar">AI</div>
                  <div>
                    <strong>Support AI</strong>
                    <p>
                      Hello! I'm ready to help you analyze support tickets.
                    </p>
                  </div>
                </div>
                <div className="chat-input">
                  <input placeholder="Ask the AI assistant something..." />
                  <button>Send</button>
                </div>
              </div>
            </section>
          )}

          {active === "Knowledge Base" && (
            <section className="feature-page">
              <div className="feature-icon">▣</div>
              <p className="eyebrow">SELF SERVICE</p>
              <h2>Knowledge Base</h2>
              <p>
                Store troubleshooting guides, FAQs, product documentation and
                reusable support solutions.
              </p>
              <div className="knowledge-cards">
                <div>Getting Started</div>
                <div>Account & Security</div>
                <div>Billing & Payments</div>
                <div>Technical Issues</div>
              </div>
            </section>
          )}

          {active === "Settings" && (
            <section className="feature-page settings-page">
              <p className="eyebrow">CONFIGURATION</p>
              <h2>Settings</h2>
              <div className="settings-list">
                <div>
                  <strong>Backend URL</strong>
                  <span>{API}</span>
                </div>
                <div>
                  <strong>Frontend</strong>
                  <span>Vite + React + TypeScript</span>
                </div>
                <div>
                  <strong>Backend status</strong>
                  <span className="online">{backendStatus}</span>
                </div>
                <div>
                  <strong>Gmail status</strong>
                  <span>{gmailStatus}</span>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>

      {showTicketForm && (
        <div className="modal-backdrop" onClick={() => setShowTicketForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">NEW REQUEST</p>
                <h2>Create Support Ticket</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setShowTicketForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={createTicket}>
              <label>
                Ticket title
                <input
                  value={newTicket.title}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, title: e.target.value })
                  }
                  placeholder="Describe the customer issue"
                />
              </label>

              <label>
                Customer name
                <input
                  value={newTicket.customer}
                  onChange={(e) =>
                    setNewTicket({ ...newTicket, customer: e.target.value })
                  }
                  placeholder="Customer name"
                />
              </label>

              <div className="form-grid">
                <label>
                  Priority
                  <select
                    value={newTicket.priority}
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        priority: e.target.value as Ticket["priority"],
                      })
                    }
                  >
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </label>

                <label>
                  Category
                  <select
                    value={newTicket.category}
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        category: e.target.value,
                      })
                    }
                  >
                    <option>Technical</option>
                    <option>Account</option>
                    <option>Billing</option>
                    <option>General</option>
                  </select>
                </label>
              </div>

              <button className="primary-button full" type="submit">
                Create Ticket
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;




