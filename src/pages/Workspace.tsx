import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const GMAIL_AUTH_TOKEN_KEY = "gmailAuthToken";

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
  deletedAt?: string | null;
  expiresAt?: string | null;
};

type SessionUser = {
  email?: string;
  image?: string;
  picture?: string;
  avatar_url?: string;
  displayName?: string;
  full_name?: string;
  name?: string;
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
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

function ticketId(ticket: Ticket) {
  return ticket._id || ticket.gmailMessageId || "";
}

function daysRemaining(date?: string | null) {
  if (!date) {
    return "30 days";
  }

  const ms =
    new Date(date).getTime() - Date.now();
  const days = Math.max(
    0,
    Math.ceil(ms / (24 * 60 * 60 * 1000))
  );

  return `${days} day${days === 1 ? "" : "s"}`;
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getGmailAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(GMAIL_AUTH_TOKEN_KEY);

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

function formatDisplayName(user: SessionUser | null) {
  const rawName =
    user?.name ||
    user?.displayName ||
    user?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.raw_user_meta_data?.name ||
    user?.raw_user_meta_data?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
  const cleanName = rawName.trim();

  if (!cleanName || cleanName.toLowerCase() === "there") {
    return "there";
  }

  return cleanName
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(user: SessionUser | null) {
  const displayName = formatDisplayName(user);

  if (displayName === "there") {
    return "ME";
  }

  const parts = displayName.split(/\s+/);
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`
      : displayName.slice(0, 2);

  return initials.toUpperCase();
}

function getProfileImage(user: SessionUser | null, gmailProfileImage: string) {
  return (
    gmailProfileImage ||
    user?.image ||
    user?.picture ||
    user?.avatar_url ||
    ""
  );
}

function percentOf(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function CategoryIcon({ category, subject, sender }: { category?: string; subject?: string; sender?: string }) {
  const cat = (category || "").toLowerCase();
  const text = `${subject || ""} ${sender || ""}`.toLowerCase();
  const combined = `${cat} ${text}`;

  // 1. Social & Networking (LinkedIn, Twitter, Slack, GitHub, Social)
  if (combined.includes("linkedin") || combined.includes("twitter") || combined.includes("slack") || combined.includes("github") || cat.includes("social") || combined.includes("you may know")) {
    return (
      <div className="category-badge cat-social" title="Social & Networking">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    );
  }

  // 2. Account & Financial (Billing, BankAlerts, Kotak, Card, Transaction, Payment, Invoice, Declined, Account)
  if (cat.includes("account") || cat.includes("billing") || combined.includes("bill") || combined.includes("card") || combined.includes("transaction") || combined.includes("bank") || combined.includes("kotak") || combined.includes("payment") || combined.includes("declined") || combined.includes("fund")) {
    return (
      <div className="category-badge cat-account" title="Account & Billing">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </div>
    );
  }

  // 3. Technical & Engineering (Atlassian, Application, Code, Bug, Technical, Server, System, Form)
  if (cat.includes("tech") || combined.includes("atlassian") || combined.includes("amity") || combined.includes("application") || combined.includes("code") || combined.includes("bug") || combined.includes("system") || combined.includes("server") || combined.includes("form")) {
    return (
      <div className="category-badge cat-technical" title="Technical">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
    );
  }

  // 4. Promotions & Contests (Unstop, Prize, Contest, Cash, Offer, News, Deal, Promo, Sarvgyan)
  if (combined.includes("unstop") || combined.includes("prize") || combined.includes("contest") || combined.includes("cash") || combined.includes("offer") || combined.includes("deal") || combined.includes("promo") || combined.includes("sarvgyan") || cat.includes("promo")) {
    return (
      <div className="category-badge cat-promo" title="Promotions & Contests">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      </div>
    );
  }

  // 5. Feature & AI (Feature, AI, Automation, Spark, Upgrade, Request)
  if (cat.includes("feature") || combined.includes("feature") || combined.includes("ai ") || combined.includes("ai away") || combined.includes("request")) {
    return (
      <div className="category-badge cat-feature" title="Feature & AI">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
    );
  }

  // 6. General Support (Standard Customer Conversations)
  return (
    <div className="category-badge cat-general" title="General Email">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    </div>
  );
}

function formatAssistantLine(line: string) {
  return line
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function renderAssistantAnswer(answer: string) {
  return answer
    .split(/\n+/)
    .map(formatAssistantLine)
    .filter(Boolean)
    .map((line, index) => {
      const labelMatch = line.match(/^([^:]{2,42}):\s*(.+)$/);

      if (labelMatch) {
        return (
          <p key={`${line}-${index}`} className="assistant-answer-line">
            <strong>{labelMatch[1]}:</strong> {labelMatch[2]}
          </p>
        );
      }

      return (
        <p key={`${line}-${index}`} className="assistant-answer-line">
          {line}
        </p>
      );
    });
}

function SidebarLogo() {
  return (
    <img src="/assets/brand-logo.png" alt="SupportHub Logo" style={{ height: "46px", maxWidth: "100%", objectFit: "contain" }} />
  );
}

function NavIcon({ name, isDark = false }: { name: string; isDark?: boolean }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  if (name === "Dashboard") {
    return (
      <img src={isDark ? "/assets/dashboard_dark.png" : "/assets/dashboard.png"} alt="Dashboard" />
    );
  }

  if (name === "Tickets") {
    return (
      <img src={isDark ? "/assets/tickets_dark.png" : "/assets/tickets.png"} alt="Tickets" />
    );
  }

  if (name === "Gmail Analyzer") {
    return (
      <img src={isDark ? "/assets/gmail_dark.png" : "/assets/gmail.png"} alt="Gmail Analyzer" />
    );
  }

  if (name === "Recycle Bin") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7h8M10 7V5h4v2M6 9l1 10h10l1-10" {...common} />
        <path d="M10 12v4M14 12v4" {...common} />
      </svg>
    );
  }

  if (name === "AI Assistant") {
    return (
      <img src={isDark ? "/assets/assistant_dark.png" : "/assets/assistant.png"} alt="AI Assistant" />
    );
  }

  if (name === "Notifications") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" {...common} />
        <path d="M10 21h4" {...common} />
      </svg>
    );
  }

  if (name === "Settings") {
    return (
      <img src={isDark ? "/assets/settings_dark.png" : "/assets/settings.png"} alt="Settings" />
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" {...common} />
      <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M19.8 7.5 17.2 9M6.8 15l-2.6 1.5" {...common} />
    </svg>
  );
}

function Workspace() {
  const navigate = useNavigate();

  async function handleLogout() {
    await authClient.signOut();
    navigate("/");
  }

  async function confirmLogout() {
    setShowLogoutConfirm(false);
    await handleLogout();
  }

  const [active, setActive] = useState("Dashboard");

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

  const [sessionUser, setSessionUser] =
    useState<SessionUser | null>(null);

  const [topbarNotice, setTopbarNotice] =
    useState("");

  const [showLogoutConfirm, setShowLogoutConfirm] =
    useState(false);

  const [tickets, setTickets] =
    useState<Ticket[]>(initialTickets);

  const [gmailMessages, setGmailMessages] =
    useState<Ticket[]>([]);

  const [deletedMessages, setDeletedMessages] =
    useState<Ticket[]>([]);

  const [gmailStatus, setGmailStatus] =
    useState("Checking...");

  const [backendStatus, setBackendStatus] =
    useState("Checking...");

  const [gmailLoading, setGmailLoading] =
    useState(false);

  const [gmailError, setGmailError] =
    useState("");

  const [gmailProfileImage, setGmailProfileImage] =
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

  const [assistantSentQuestion, setAssistantSentQuestion] =
    useState("");

  const [assistantAnswer, setAssistantAnswer] =
    useState("");

  const [assistantSource, setAssistantSource] =
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
    const hashQuery = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(hashQuery);
    const authToken = params.get("auth_token");
    const gmailEmail = params.get("email");

    if (authToken) {
      localStorage.setItem(GMAIL_AUTH_TOKEN_KEY, authToken);
      localStorage.setItem("gmailConnected", "true");

      if (gmailEmail) {
        localStorage.setItem("gmailEmail", gmailEmail);
      }

      window.history.replaceState(null, "", "/#/dashboard");
    }

    checkBackend();
    checkGmail();
    loadSessionUser();
  }, []);

  async function loadSessionUser() {
    const result = await authClient.getSession();
    const user =
      result?.data?.session?.user ||
      result?.data?.user ||
      null;

    setSessionUser(user);
  }

  useEffect(() => {
    if (
      gmailStatus.startsWith("Connected")
    ) {
      loadGmailMessages();
    }
  }, [gmailStatus]);

  async function askAssistant(overrideQuestion?: string) {
    const questionToSubmit = overrideQuestion !== undefined ? overrideQuestion : assistantQuestion;
    if (!questionToSubmit.trim()) {
      return;
    }

    setAssistantSentQuestion(questionToSubmit);
    setAssistantQuestion("");

    const loadingStartedAt = Date.now();
    const minimumLoadingMs = 650;

    try {
      setAssistantLoading(true);
      setAssistantError("");
      setAssistantAnswer("");
      setAssistantSource("");

      const response = await fetch(
        `${API}/api/assistant`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getGmailAuthHeaders(),
          },
          body: JSON.stringify({
            question: questionToSubmit.trim(),
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
      setAssistantSource(
        data.source === "agentrouter"
          ? `AgentRouter · ${data.model || "configured model"}`
          : data.source === "local-fallback"
          ? "Local fallback"
          : ""
      );
    } catch (error) {
      console.error("AI Assistant error:", error);

      setAssistantError(
        error instanceof Error
          ? error.message
          : "AI Assistant failed"
      );
    } finally {
      const elapsed = Date.now() - loadingStartedAt;
      const remaining = minimumLoadingMs - elapsed;

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

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
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (
        response.status === 401 ||
        data.error === "Not authenticated"
      ) {
        setGmailStatus("Not connected");
        setGmailProfileImage("");
        return;
      }

      if (data.connected) {
        setGmailStatus(
          data.email
            ? `Connected: ${data.email}`
            : "Connected"
        );
        setGmailProfileImage(data.picture || "");

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
        setGmailProfileImage("");
      }
    } catch (error) {
      console.error(
        "Gmail status error:",
        error
      );

      setGmailStatus("Unavailable");
      setGmailProfileImage("");
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
          headers: getGmailAuthHeaders(),
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
      await loadDeletedMessages();

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

  async function loadDeletedMessages() {
    try {
      const response = await fetch(
        `${API}/api/messages/trash`,
        {
          credentials: "include",
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setDeletedMessages([]);
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load recycle bin"
        );
      }

      setDeletedMessages(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Failed to load recycle bin:",
        error
      );
    }
  }

  async function moveGmailToTrash(
    mail: Ticket
  ) {
    const id = ticketId(mail);

    if (!id) {
      return;
    }

    const confirmed = window.confirm(
      "Move this email to the recycle bin? It will be kept for 30 days before permanent deletion."
    );

    if (!confirmed) {
      return;
    }

    try {
      setGmailLoading(true);
      setGmailError("");

      const response = await fetch(
        `${API}/api/messages/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to move email to recycle bin"
        );
      }

      setGmailMessages((previous) =>
        previous.filter(
          (item) => ticketId(item) !== id
        )
      );

      setTickets((previous) =>
        previous.filter(
          (item) => ticketId(item) !== id
        )
      );

      await loadDeletedMessages();
    } catch (error) {
      setGmailError(
        error instanceof Error
          ? error.message
          : "Failed to move email to recycle bin"
      );
    } finally {
      setGmailLoading(false);
    }
  }

  async function clearGmailMessages() {
    if (gmailMessages.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Move all ${gmailMessages.length} analyzed emails to the recycle bin? They will be kept for 30 days.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setGmailLoading(true);
      setGmailError("");

      const response = await fetch(
        `${API}/api/messages`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to clear analyzed emails"
        );
      }

      setGmailMessages([]);
      setTickets([]);
      await loadDeletedMessages();
    } catch (error) {
      setGmailError(
        error instanceof Error
          ? error.message
          : "Failed to clear analyzed emails"
      );
    } finally {
      setGmailLoading(false);
    }
  }

  async function restoreGmailMessage(
    mail: Ticket
  ) {
    const id = ticketId(mail);

    if (!id) {
      return;
    }

    try {
      setGmailLoading(true);
      setGmailError("");

      const response = await fetch(
        `${API}/api/messages/${encodeURIComponent(
          id
        )}/restore`,
        {
          method: "POST",
          credentials: "include",
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to restore email"
        );
      }

      await loadGmailMessages();
      await loadDeletedMessages();
    } catch (error) {
      setGmailError(
        error instanceof Error
          ? error.message
          : "Failed to restore email"
      );
    } finally {
      setGmailLoading(false);
    }
  }

  async function permanentlyDeleteGmailMessage(
    mail: Ticket
  ) {
    const id = ticketId(mail);

    if (!id) {
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete this email from the dashboard? This cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    try {
      setGmailLoading(true);
      setGmailError("");

      const response = await fetch(
        `${API}/api/messages/${encodeURIComponent(
          id
        )}/permanent`,
        {
          method: "DELETE",
          credentials: "include",
          headers: getGmailAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to permanently delete email"
        );
      }

      await loadDeletedMessages();
    } catch (error) {
      setGmailError(
        error instanceof Error
          ? error.message
          : "Failed to permanently delete email"
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
            ...getGmailAuthHeaders(),
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
    const redirectUrl =
      `${window.location.origin}/#/dashboard`;

    window.location.href =
      `${API}/auth/google?redirect=${encodeURIComponent(redirectUrl)}`;
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

  const resolvedRate =
    percentOf(resolvedCount, tickets.length);

  const openCategories = ["Technical", "Billing", "General", "Account", "Feature"];
  const trendBars = openCategories.map((cat) => {
    const count = tickets.filter((t) => t.category === cat).length;
    return Math.max(18, Math.min(95, Math.round((count / Math.max(tickets.length, 1)) * 100)));
  });

  const totalRate =
    percentOf(openCount, Math.max(tickets.length, 1));

  const dashboardStats = [
    {
      key: "total",
      label: "TOTAL TICKETS",
      value: tickets.length,
      detail: `${Math.max(0, tickets.length - resolvedCount)} active right now`,
      tone: "green",
      chart: "ring",
      progress: totalRate,
    },
    {
      key: "open",
      label: "OPEN",
      value: openCount,
      detail: "View all open tickets",
      tone: "line",
      chart: "trend",
      trendBars: trendBars,
      progress: percentOf(openCount, Math.max(tickets.length, 1)),
    },
    {
      key: "high",
      label: "HIGH PRIORITY",
      value: highCount,
      detail: highCount > 0 ? "Needs attention" : "All clear",
      tone: "danger",
      chart: "alert",
      progress: percentOf(highCount, Math.max(tickets.length, 1)),
    },
    {
      key: "resolved",
      label: "RESOLVED",
      value: resolvedCount,
      detail: `${resolvedRate}% resolution rate`,
      tone: "muted",
      chart: "ring",
      progress: resolvedRate,
    },
  ];

  const displayName =
    formatDisplayName(sessionUser);

  const userInitials =
    getInitials(sessionUser);

  const profileImage =
    getProfileImage(sessionUser, gmailProfileImage);

  const greeting =
    getGreeting();

  function showAlerts() {
    setActive("Dashboard");
    setTopbarNotice(
      `Alerts: ${highCount} high-priority ticket${highCount === 1 ? "" : "s"}, ${openCount} open ticket${openCount === 1 ? "" : "s"}, Gmail ${gmailStatus.toLowerCase()}.`
    );
  }

  function openHelp() {
    setActive("AI Assistant");
    setTopbarNotice(
      "Help opened: ask the AI Assistant about response patterns and support workflow notes."
    );
  }

  function openProfileSettings() {
    setActive("Settings");
    setTopbarNotice(
      `Showing account settings for ${displayName}.`
    );
  }

  const navigation = [
    {
      name: "Dashboard",
      icon: "DB",
    },
    {
      name: "Tickets",
      icon: "TK",
    },
    {
      name: "Gmail Analyzer",
      icon: "GM",
    },
    {
      name: "AI Assistant",
      icon: "AI",
    },
    {
      name: "Settings",
      icon: "ST",
    },
  ];

  const activeNavName =
    active === "Recycle Bin" ? "Gmail Analyzer" : active;

  const activeIndex = Math.max(
    0,
    navigation.findIndex((item) => item.name === activeNavName)
  );

  return (
    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="brand" style={{ padding: "10px 15px 30px" }}>
          <SidebarLogo />
        </div>

        <nav style={{ "--active-index": activeIndex } as CSSProperties}>
          <span className="nav-active-indicator" aria-hidden="true" />
          {navigation.map(
            (item) => (
              <button
                key={item.name}
                className={
                  activeNavName === item.name
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setActive(item.name)
                }
              >

                <span className="nav-icon">
                  <NavIcon name={item.name} isDark={theme === "dark"} />
                </span>

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

      <main className={`main${active === "Dashboard" ? " dashboard-main" : ""}`}>

        <header className="topbar">

          {active === "AI Assistant" ? (
            <div className="assistant-topbar-title">
              <h1>AI Assistant</h1>
              <p>Your intelligent support companion</p>
            </div>
          ) : (
            <div>
              <span className="breadcrumb">
                Workspace /
              </span>

              <strong>
                {active}
              </strong>
            </div>
          )}

          <div className="top-actions">

            <button
              className={`icon-button notification-button${active === "AI Assistant" ? " has-badge" : ""}`}
              title="Notifications"
              aria-label="Notifications"
              type="button"
              onClick={showAlerts}
            >
              <NavIcon name="Notifications" />
              {active === "AI Assistant" && <span className="notification-badge-dot" />}
            </button>

            <button
              className="help-button"
              type="button"
              onClick={openHelp}
            >
              Help
            </button>

            {active === "AI Assistant" ? (
              <div className="profile-dropdown-trigger" onClick={openProfileSettings}>
                <button
                  className="profile-button"
                  type="button"
                  title={`Account settings for ${displayName}`}
                >
                  {profileImage ? (
                    <img src={profileImage} alt="" />
                  ) : (
                    userInitials
                  )}
                </button>
                <svg className="chevron-down-icon" viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M7 10l5 5 5-5H7z"/>
                </svg>
              </div>
            ) : (
              <button
                className="profile-button"
                type="button"
                title={`Account settings for ${displayName}`}
                onClick={openProfileSettings}
              >
                {profileImage ? (
                  <img src={profileImage} alt="" />
                ) : (
                  userInitials
                )}
              </button>
            )}

            {active !== "AI Assistant" && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="logout-btn topbar-logout"
                type="button"
              >
                Log out
              </button>
            )}

          </div>

        </header>

        <section className="content">
          {topbarNotice && (
            <div className="alert topbar-notice">
              <span>{topbarNotice}</span>
              <button
                type="button"
                onClick={() => setTopbarNotice("")}
                aria-label="Dismiss notice"
              >
                Dismiss
              </button>
            </div>
          )}

          <div key={active} className="workspace-view-transition">

          {/* DASHBOARD */}

          {active === "Dashboard" && (
            <div className="dashboard-home">
              <div className="dashboard-hero-row">
                <div className="dashboard-greeting">
                  <div className="dashboard-avatar">
                    {profileImage ? (
                      <img src={profileImage} alt="" />
                    ) : (
                      userInitials.slice(0, 1)
                    )}
                  </div>

                  <div>
                    <h1>
                      {greeting}, {displayName}! <span aria-hidden="true">👋</span>
                    </h1>
                    <p>
                      Here's what's happening with your support operations today.
                    </p>
                  </div>
                </div>

                <div className="dashboard-hero-actions">
                  <div className="dashboard-top-actions">
                    <button
                      className="icon-button notification-button"
                      title="Notifications"
                      aria-label="Notifications"
                      type="button"
                      onClick={showAlerts}
                    >
                      <NavIcon name="Notifications" />
                    </button>

                    <button
                      className="profile-button"
                      type="button"
                      title={`Account settings for ${displayName}`}
                      onClick={openProfileSettings}
                    >
                      {profileImage ? (
                        <img src={profileImage} alt="" />
                      ) : (
                        userInitials
                      )}
                    </button>

                    <button
                      className="icon-button dashboard-menu-button"
                      type="button"
                      aria-label="More options"
                      title="More options"
                      onClick={openProfileSettings}
                    >
                      <span aria-hidden="true">⌄</span>
                    </button>
                  </div>

                  <button
                    className="primary-button dashboard-open-gmail"
                    onClick={() => setActive("Gmail Analyzer")}
                  >
                    Open Gmail <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>

              <div className="dashboard-stat-grid">
                {dashboardStats.map((stat) => (
                  <article
                    className={`dashboard-stat-card stat-${stat.tone}`}
                    style={{ "--stat-progress": stat.progress } as CSSProperties}
                    key={stat.key}
                  >
                    <div>
                      <p className="dashboard-stat-label">{stat.label}</p>
                      <strong>{stat.value}</strong>
                      <span>{stat.detail}</span>
                    </div>

                    <div className={`dashboard-stat-visual visual-${stat.chart}`} aria-hidden="true">
                      {stat.chart === "ring" && (
                        <div className="metric-ring">
                          <span>{stat.key === "resolved" ? `${stat.progress}%` : stat.value}</span>
                        </div>
                      )}

                      {stat.chart === "trend" && (
                        <div className="metric-trend">
                          {(stat.trendBars || [24, 42, 34, 62, 48]).map((h, i) => (
                            <span key={i} style={{ "--bar-height": `${h}%`, animationDelay: `${i * 0.1}s` } as CSSProperties} />
                          ))}
                        </div>
                      )}

                      {stat.chart === "alert" && (
                        <div className="metric-alert">
                          <NavIcon name="Notifications" />
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="dashboard-work-grid">
                <section className="dashboard-card dashboard-recent-card">
                  <div className="dashboard-card-heading">
                    <div>
                      <h2>Recent Tickets</h2>
                      <p>Latest support conversations.</p>
                    </div>

                    <button
                      className="text-button dashboard-view-all"
                      onClick={() => setActive("Tickets")}
                    >
                      View all <span aria-hidden="true">→</span>
                    </button>
                  </div>

                  <div className="dashboard-ticket-list">
                    {filteredTickets.slice(0, 3).map((ticket) => (
                      <article className="dashboard-ticket-row" key={ticketId(ticket)}>
                        <CategoryIcon category={ticket.category} subject={ticket.subject} sender={ticket.sender} />

                        <div className="dashboard-ticket-copy">
                          <h3>{ticket.subject || "Untitled conversation"}</h3>
                          <p>{ticket.sender || "Unknown sender"}</p>
                          <span>
                            {ticket.receivedAt
                              ? new Date(ticket.receivedAt).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "Just now"}{" "}
                            · {ticket.category || "General"}
                          </span>
                        </div>

                        <div className="dashboard-ticket-badges">
                          <span className={priorityClass(ticket.priority)}>
                            {ticket.priority || "Medium"}
                          </span>
                          <span className="badge badge-green">
                            {ticket.status || "Open"}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="dashboard-side-stack">
                  <article className="dashboard-card dashboard-side-card">
                    <div className="dashboard-side-heading">
                      <div className="gmail-logo">
                        <NavIcon name="Gmail Analyzer" />
                      </div>

                      <div>
                        <h2>Gmail Analyzer</h2>
                        <p>Analyze customer emails with AI</p>
                      </div>
                    </div>

                    <div className="dashboard-connection">
                      <span className={gmailStatus.startsWith("Connected") ? "green-dot" : "orange-dot"}></span>
                      <span>
                        {gmailStatus.startsWith("Connected") ? "Connected:" : "Status:"}
                      </span>
                      <strong>{gmailStatus.replace("Connected: ", "")}</strong>
                    </div>

                    <div className="dashboard-mini-chart" aria-hidden="true">
                      <div className="mini-ring"></div>
                      <div className="mini-bars">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>

                    <button
                      className="primary-button full"
                      onClick={() => setActive("Gmail Analyzer")}
                    >
                      Open Gmail Analyzer <span aria-hidden="true">→</span>
                    </button>
                  </article>

                  <article className="dashboard-card dashboard-side-card dashboard-ai-card">
                    <div className="dashboard-side-heading">
                      <div className="ai-symbol">AI</div>

                      <div>
                        <h2>AI Support Assistant</h2>
                        <p>
                          Get instant help summarizing tickets, drafting replies and finding solutions.
                        </p>
                      </div>
                    </div>

                    <button
                      className="primary-button full"
                      onClick={() => setActive("AI Assistant")}
                    >
                      <span aria-hidden="true">✣</span> AI Support
                    </button>
                  </article>
                </section>
              </div>
            </div>
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

                  <span>Search</span>

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
                          <CategoryIcon category={ticket.category} subject={ticket.subject} sender={ticket.sender} />

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
                    analyzed by AgentRouter AI.
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
                    Refresh
                  </button>

                  <button
                    className="outline-button"
                    onClick={
                      clearGmailMessages
                    }
                    disabled={
                      gmailLoading ||
                      gmailMessages.length ===
                        0
                    }
                  >
                    Clear analyzed
                  </button>

                  <button
                    className="icon-button recycle-icon-button"
                    title="Recycle Bin"
                    aria-label="Recycle Bin"
                    onClick={() => {
                      loadDeletedMessages();
                      setActive(
                        "Recycle Bin"
                      );
                    }}
                  >
                    <NavIcon name="Recycle Bin" />
                    {deletedMessages.length > 0 && (
                      <span className="icon-count">
                        {deletedMessages.length}
                      </span>
                    )}
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
                      ? "Fetch & Analyze Gmail"
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

                    <span>Search</span>

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
                  <div className="gmail-skeleton-container">
                    <div className="gmail-skeleton-header">
                      <div className="spinner-green"></div>
                      <div>
                        <h3>Analyzing Gmail...</h3>
                        <p>Gmail messages are being retrieved and analyzed by AgentRouter.</p>
                      </div>
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="gmail-skeleton-card skeleton">
                        <div className="skeleton-line skeleton-title"></div>
                        <div className="skeleton-line skeleton-body"></div>
                        <div className="skeleton-line skeleton-meta"></div>
                      </div>
                    ))}
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
                      Fetch & Analyze Gmail
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
                          <CategoryIcon category={mail.category} subject={mail.subject} sender={mail.sender} />

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

                            <button
                              className="delete-button"
                              onClick={() =>
                                moveGmailToTrash(
                                  mail
                                )
                              }
                              disabled={
                                gmailLoading
                              }
                            >
                              Delete
                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

              </section>

            </section>
          )}

          {/* RECYCLE BIN */}

          {active === "Recycle Bin" && (
            <section className="gmail-page">

              <div className="page-heading">

                <div>
                  <p className="eyebrow">
                    RECOVERY
                  </p>

                  <h2>
                    Recycle Bin
                  </h2>

                  <p className="muted">
                    Deleted Gmail conversations
                    stay here for 30 days before
                    permanent deletion.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="outline-button"
                    onClick={
                      loadDeletedMessages
                    }
                    disabled={
                      gmailLoading
                    }
                  >
                    Refresh
                  </button>

                  <button
                    className="primary-button"
                    onClick={() =>
                      setActive(
                        "Gmail Analyzer"
                      )
                    }
                  >
                    Back to Gmail
                  </button>
                </div>

              </div>

              {gmailError && (
                <div className="alert">
                  {gmailError}
                </div>
              )}

              <section className="panel">

                <div className="panel-heading">

                  <div>
                    <h3>
                      Deleted Conversations
                    </h3>

                    <p>
                      {
                        deletedMessages.length
                      } conversations in recycle bin
                    </p>
                  </div>

                </div>

                {deletedMessages.length === 0 ? (
                  <div className="empty-state">

                    <h3>
                      Recycle bin is empty
                    </h3>

                    <p>
                      Emails you delete from
                      the dashboard will appear
                      here for 30 days.
                    </p>

                  </div>
                ) : (
                  <div className="ticket-list">

                    {deletedMessages.map(
                      (mail) => (
                        <div
                          className="ticket-row"
                          key={
                            ticketId(mail)
                          }
                        >
                          <CategoryIcon category={mail.category} subject={mail.subject} sender={mail.sender} />

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

                            <div className="ticket-meta">
                              Deletes permanently in{" "}
                              {daysRemaining(
                                mail.expiresAt
                              )}
                            </div>

                            <div className="ticket-meta">
                              Deleted:{" "}
                              {mail.deletedAt
                                ? new Date(
                                    mail.deletedAt
                                  ).toLocaleString()
                                : "Unknown"}
                            </div>

                          </div>

                          <div
                            className="badges"
                            style={{
                              minWidth:
                                "230px",
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

                            <button
                              className="outline-button"
                              onClick={() =>
                                restoreGmailMessage(
                                  mail
                                )
                              }
                              disabled={
                                gmailLoading
                              }
                            >
                              Restore
                            </button>

                            <button
                              className="delete-button"
                              onClick={() =>
                                permanentlyDeleteGmailMessage(
                                  mail
                                )
                              }
                              disabled={
                                gmailLoading
                              }
                            >
                              Delete forever
                            </button>

                          </div>

                        </div>
                      )
                    )}

                  </div>
                )}

                {assistantLoading && (
                  <div className="chat-message">
                    <strong>AI Assistant</strong>
                    <div style={{ marginTop: "10px" }}>
                      <div className="typing-loader">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

              </section>

            </section>
          )}

          {/* AI ASSISTANT */}

          {active === "AI Assistant" && (
            <section className="assistant-container-page">

              {/* Chat history / loading / error feed or Welcome panel */}
              {assistantSentQuestion || assistantLoading || assistantError || assistantAnswer ? (
                <div className="assistant-chat-panel">
                  
                  {/* Sent Question */}
                  {assistantSentQuestion && (
                    <div className="chat-message user-chat-message">
                      <div className="chat-avatar user-avatar-chat">
                        {userInitials}
                      </div>
                      <div className="chat-bubble user-bubble">
                        <p>{assistantSentQuestion}</p>
                      </div>
                    </div>
                  )}

                  {/* Assistant Response Loading */}
                  {assistantLoading && (
                    <div className="chat-message assistant-chat-message">
                      <div className="chat-avatar assistant-avatar-chat">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#599345" strokeWidth="2"><path d="M12 3c0 4.5 1.5 6 6 6-4.5 0-6 1.5-6 6 0-4.5-1.5-6-6-6 4.5 0 6-1.5 6-6z" fill="#eaf4e8"/></svg>
                      </div>
                      <div className="chat-bubble assistant-bubble loading-bubble">
                        <strong>AI Assistant is thinking...</strong>
                        <div className="typing-loader assistant-loader" aria-label="AI response loading" style={{ marginTop: "8px" }}>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assistant Error */}
                  {assistantError && (
                    <div className="chat-message assistant-chat-message">
                      <div className="chat-avatar assistant-avatar-chat error-avatar">
                        ⚠️
                      </div>
                      <div className="chat-bubble assistant-bubble error-bubble">
                        <p style={{ color: "#ef4444", margin: 0 }}>{assistantError}</p>
                      </div>
                    </div>
                  )}

                  {/* Assistant Response Answer */}
                  {assistantAnswer && (
                    <div className="chat-message assistant-chat-message">
                      <div className="chat-avatar assistant-avatar-chat">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#599345" strokeWidth="2"><path d="M12 3c0 4.5 1.5 6 6 6-4.5 0-6 1.5-6 6 0-4.5-1.5-6-6-6 4.5 0 6-1.5 6-6z" fill="#eaf4e8"/></svg>
                      </div>
                      <div className="chat-bubble assistant-bubble">
                        {assistantSource && (
                          <span className="assistant-source-tag">Source: {assistantSource}</span>
                        )}
                        <div className="assistant-answer">
                          {renderAssistantAnswer(assistantAnswer)}
                        </div>
                        {/* Reset / New Chat Button */}
                        <button 
                          className="new-chat-reset-btn"
                          onClick={() => {
                            setAssistantQuestion("");
                            setAssistantSentQuestion("");
                            setAssistantAnswer("");
                            setAssistantError("");
                          }}
                        >
                          Reset Conversation
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                /* Initial Welcome & Suggestion Cards Panel */
                <div className="assistant-welcome-panel">
                  
                  <div className="assistant-welcome-icon-box">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#599345" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3c0 4.5 1.5 6 6 6-4.5 0-6 1.5-6 6 0-4.5-1.5-6-6-6 4.5 0 6-1.5 6-6z" fill="#eaf4e8" />
                      <path d="M17 16h4M19 14v4" stroke="#599345" strokeWidth="2" />
                    </svg>
                  </div>

                  <h2>How can I help you today?</h2>
                  <p className="welcome-subtitle">Ask anything about your support data and get intelligent insights.</p>

                </div>
              )}

              {/* Suggestion cards always visible below the feed or welcome message */}
              <div className="assistant-suggestion-grid" style={{ marginBottom: "20px" }}>
                
                <div 
                  className="assistant-suggestion-card"
                  onClick={() => {
                    const q = "Analyse the recent 5 tickets";
                    askAssistant(q);
                  }}
                >
                  <div className="suggestion-card-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#599345" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                  </div>
                  <div className="suggestion-card-text">
                    <h3>Analyse the recent 5 tickets</h3>
                    <p>Get insights and patterns from your latest 5 tickets</p>
                  </div>
                </div>

                <div 
                  className="assistant-suggestion-card"
                  onClick={() => {
                    const q = "Analyse high priority tickets";
                    askAssistant(q);
                  }}
                >
                  <div className="suggestion-card-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#599345" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  </div>
                  <div className="suggestion-card-text">
                    <h3>Analyse high priority tickets</h3>
                    <p>Review and analyze all high priority tickets</p>
                  </div>
                </div>

                <div 
                  className="assistant-suggestion-card"
                  onClick={() => {
                    const q = "Summarize the most frequent tickets";
                    askAssistant(q);
                  }}
                >
                  <div className="suggestion-card-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="#599345" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                  </div>
                  <div className="suggestion-card-text">
                    <h3>Summarize the most frequent tickets</h3>
                    <p>Identify the most common tickets and their trends</p>
                  </div>
                </div>

              </div>

              {/* Chat Input Container */}
              <div className="assistant-chat-input-wrapper">
                <div className="chat-input-textarea-row">
                  <textarea
                    value={assistantQuestion}
                    onChange={(event) => setAssistantQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !assistantLoading) {
                        event.preventDefault();
                        askAssistant();
                      }
                    }}
                    placeholder="Ask anything about your support data..."
                    disabled={assistantLoading}
                    rows={2}
                  />
                </div>
                <div className="chat-input-footer-row">
                  <div /> {/* Left empty space placeholder */}
                  <button 
                    className="submit-arrow-btn"
                    onClick={() => askAssistant()}
                    disabled={assistantLoading || !assistantQuestion.trim()}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Disclaimer footer */}
              <p className="assistant-disclaimer">
                AI can make mistakes. Please verify important information.
              </p>

            </section>
          )}

          {/* SETTINGS */}

          {active === "Settings" && (
            <section className="feature-page">
              <p className="eyebrow">CONFIGURATION</p>
              <h2>Settings</h2>

              <div className="panel" style={{ marginBottom: "24px" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 800 }}>Appearance & Theme</h3>
                <div className="theme-toggle-row">
                  <div>
                    <strong>Workspace Theme</strong>
                    <span>Switch between light and dark visual themes across the application.</span>
                  </div>
                  <button
                    type="button"
                    className={`theme-toggle-btn ${theme === "dark" ? "is-dark" : "is-light"}`}
                    onClick={toggleTheme}
                    title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                  >
                    <span className="theme-opt light-opt">☀️ Light</span>
                    <span className="theme-opt dark-opt">🌙 Dark</span>
                    <span className="theme-slider" />
                  </button>
                </div>
              </div>

              <div className="panel">
                <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 800 }}>System Status</h3>
                <div className="settings-list">
                  <div>
                    <strong>Backend status</strong>
                    <span>{backendStatus}</span>
                  </div>
                  <div>
                    <strong>Gmail status</strong>
                    <span>{gmailStatus}</span>
                  </div>
                  <div>
                    <strong>Analyzed emails</strong>
                    <span>{gmailMessages.length}</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          </div>

        </section>

      </main>

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <div className="logout-confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2" />
                <path d="M10 12h10M17 9l3 3-3 3" />
              </svg>
            </div>

            <h2 id="logout-confirm-title">Log out?</h2>

            <p>
              You will return to the landing page and can sign in again anytime.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="outline-button"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button logout-confirm-action"
                onClick={confirmLogout}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

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

export default Workspace;









