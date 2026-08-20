import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useToast } from "../components/Toast";
import type {
  BackendMessage,
  KnowledgeArticle,
  Ticket,
  TicketPriority,
  TicketSentiment,
} from "../types/ticket";
import {
  getGmailStatus,
  getMessages,
  fetchUnreadMessages as apiFetchUnread,
  updateTicketStatus,
  updateTicketReply,
  escalateTicket,
  sendTicketReply,
  refineTicketReply,
  getKnowledgeArticles,
  searchKnowledgeArticles,
} from "../services/api";
import { getWorkspaceSettings } from "../lib/settings";

const API_BASE = "http://localhost:5000";


const PRESET_ESCALATION_REASONS = [
  "Requires Tier 2 / Engineering Investigation",
  "Billing Dispute / Refund Exceeds Authorization Limit",
  "Customer Requested Management Escalation",
  "Critical Service Outage / High Priority SLA Incident",
  "Security / Account Access Verification Required",
];

const QUICK_AI_PROMPT_CHIPS = [
  { label: "⚡ Summarize Urgency", tone: "shorten" as const, prefix: "Urgency Summary: " },
  { label: "👔 Executive Tone", tone: "formal" as const, prefix: "Formal Polish: " },
  { label: "😊 Empathetic Response", tone: "friendly" as const, prefix: "Empathetic Draft: " },
  { label: "💡 Step-by-Step Resolution", tone: "simplify" as const, prefix: "Step-by-Step: " },
  { label: "📚 Inject Relevant Policy", tone: "include_kb" as const, prefix: "Policy Grounded: " },
];

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
  const originalReply =
    message.suggestedResponse ||
    "Thank you for contacting us. We will review your request and get back to you shortly.";

  return {
    id: `TICKET-${message._id || index}`,
    rawId: message._id || message.gmailMessageId || String(index),
    subject: message.subject || "No Subject",
    customer: getCustomerName(message.sender),
    email: getCustomerEmail(message.sender),
    status:
      message.status === "Resolved"
        ? "Resolved"
        : message.status === "Escalated" || message.isEscalated
        ? "Escalated"
        : message.status === "In Progress"
        ? "In Progress"
        : "Pending",
    priority: message.priority || "Medium",
    category: message.category || "Other",
    message: message.body || message.summary || "",
    orderId: "—",
    received: formatReceived(message.receivedAt),
    reply: message.editedReply || originalReply,
    originalSuggestedReply: message.suggestedResponse || originalReply,
    summary: message.summary || "",
    sentiment: message.sentiment || "Neutral",
    isEscalated: message.isEscalated || message.status === "Escalated" || false,
    escalatedAt: message.escalatedAt || null,
    escalationReason: message.escalationReason || "",
    sentAt: message.sentAt || null,
  };
}

function renderFormattedAIResponse(text: string) {
  if (!text) return "No response generated.";

  try {
    const lines = text.split("\n");
    return (
      <div className="formatted-ai-response">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} style={{ height: "6px" }} />;

          // Bold parsing helper (**text**)
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const formattedLine = parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          });

          // Bullet list (* or -)
          if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
            return (
              <ul key={idx} style={{ margin: "2px 0 2px 18px" }}>
                <li>{formattedLine}</li>
              </ul>
            );
          }

          // Numbered list (1. 2.)
          if (/^\d+\.\s/.test(trimmed)) {
            return (
              <ol key={idx} style={{ margin: "2px 0 2px 18px" }}>
                <li>{formattedLine}</li>
              </ol>
            );
          }

          return <p key={idx}>{formattedLine}</p>;
        })}
      </div>
    );
  } catch {
    return <div className="reply-box">{text}</div>;
  }
}

function localRefineText(
  originalText: string,
  tone: "formal" | "friendly" | "shorten" | "simplify" | "include_kb",
  customerName: string,
  kbSnippet?: string
): string {
  const name =
    customerName && customerName !== "Unknown Customer"
      ? customerName
      : "there";
  let base = originalText.trim();

  base = base
    .replace(/^(Dear|Hi|Hello|Hey)\s+[^,\n]+,\s*/i, "")
    .replace(
      /(Best regards|Warm regards|Sincerely|Thanks|Thank you|Kind regards)[\s\S]*$/i,
      ""
    )
    .trim();

  switch (tone) {
    case "formal":
      return `Dear ${name},\n\nThank you for bringing this matter to our attention. Regarding your inquiry:\n\n${base}\n\nShould you require further assistance or clarification, please do not hesitate to contact us.\n\nSincerely,\nCustomer Support Team`;

    case "friendly":
      return `Hi ${name}! 😊\n\nThanks so much for reaching out to us. I'd be more than happy to help you with this!\n\n${base}\n\nHope this helps! Let me know if there's anything else I can do for you.\n\nWarmly,\nCustomer Support Team`;

    case "shorten":
      return `Hello ${name},\n\n${base.split("\n")[0] || base}\n\nPlease let us know if you need any additional help.\n\nBest,\nSupport Team`;

    case "simplify": {
      const sentences = base
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
      const bulletPoints = sentences
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n");
      return `Hi ${name},\n\nHere is a simple summary of how to resolve your request:\n\n${
        bulletPoints || base
      }\n\nLet us know if you have any questions!\n\nBest regards,\nSupport Team`;
    }

    case "include_kb":
      if (kbSnippet) {
        return `Hello ${name},\n\nThank you for reaching out. Based on our standard support documentation:\n\n📌 Knowledge Base Reference:\n"${kbSnippet.trim()}"\n\n${base}\n\nPlease feel free to let us know if you have any further questions.\n\nBest regards,\nCustomer Support Team`;
      }
      return originalText;

    default:
      return originalText;
  }
}

export default function Dashboard() {
  const location = useLocation();
  const navState = (location.state as {
    filterStatus?: "All" | "Pending" | "Resolved" | "Escalated";
    filterPriority?: "All" | TicketPriority;
    filterSentiment?: "All" | TicketSentiment;
    selectedTicketId?: string;
  }) || {};

  const { showToast } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");

  // Multi-Filter & Search State
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Pending" | "Resolved" | "Escalated"
  >(navState.filterStatus || "All");
  const [priorityFilter, setPriorityFilter] = useState<
    "All" | TicketPriority
  >(navState.filterPriority || "All");
  const [sentimentFilter, setSentimentFilter] = useState<
    "All" | TicketSentiment
  >(navState.filterSentiment || "All");
  const [searchQuery, setSearchQuery] = useState("");

  // Reply Draft State
  const [editingReply, setEditingReply] = useState(false);
  const [editedReply, setEditedReply] = useState("");
  const [refining, setRefining] = useState(false);
  const [activeTone, setActiveTone] = useState<string | null>(null);
  const [replyRefineNotice, setReplyRefineNotice] = useState("");

  // Dashboard Messages & Loading State
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNoticeAlert, setShowNoticeAlert] = useState(false);

  // Bell animation state
  const [bellAnimating, setBellAnimating] = useState(false);
  const bellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gmail Connection State
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");

  // Contextual Knowledge Base State
  const [allArticles, setAllArticles] = useState<KnowledgeArticle[]>([]);
  const [kbSearchQuery, setKbSearchQuery] = useState("");
  const [kbSearchResults, setKbSearchResults] = useState<
    KnowledgeArticle[] | null
  >(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [previewArticle, setPreviewArticle] =
    useState<KnowledgeArticle | null>(null);

  // Escalation Modal State
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationReasonInput, setEscalationReasonInput] = useState("");
  const [selectedPresetReason, setSelectedPresetReason] = useState("");

  // Create Ticket Modal State
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [createTicketForm, setCreateTicketForm] = useState({
    subject: "",
    sender: "",
    body: "",
    priority: "Medium" as TicketPriority,
    category: "General",
  });
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Dynamic Greeting based on client local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);


  async function loadStatus() {
    try {
      const data = await getGmailStatus();
      setConnected(!!data.connected);
      setEmail(data.email || "");
    } catch (error) {
      console.error("Failed to load Gmail status:", error);
      setConnected(false);
    }
  }

  async function loadMessages() {
    try {
      setLoading(true);
      const data = await getMessages();
      const converted = data.map(convertMessageToTicket);

      setTickets(converted);

      if (converted.length > 0) {
        if (navState.selectedTicketId) {
          const matched = converted.find(
            (t) => t.rawId === navState.selectedTicketId || t.id === navState.selectedTicketId
          );
          setSelectedId(matched ? matched.id : converted[0].id);
        } else {
          setSelectedId((current) =>
            current && converted.some((ticket) => ticket.id === current)
              ? current
              : converted[0].id
          );
        }
      } else {
        setSelectedId("");
      }
    } catch (error) {
      console.error("Failed to load tickets:", error);
      setMessage("Unable to load tickets from the backend.");
    } finally {
      setLoading(false);
    }
  }

  async function loadKnowledgeBase() {
    try {
      const articles = await getKnowledgeArticles();
      setAllArticles(articles);
    } catch (error) {
      console.warn("Could not preload knowledge base articles:", error);
    }
  }

  async function fetchUnreadMessages() {
    try {
      setFetching(true);
      setMessage(
        "Fetching unread Gmail messages and analyzing them with Gemini..."
      );

      const data = await apiFetchUnread();
      await loadMessages();

      setMessage(`Fetched and analyzed ${data.count ?? 0} Gmail message(s).`);
    } catch (error) {
      console.error("Failed to fetch Gmail messages:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch Gmail messages."
      );
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      await loadStatus();
      await loadMessages();
      await loadKnowledgeBase();
    }

    initialize();

    const settings = getWorkspaceSettings();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (settings.autoRefreshInterval > 0) {
      timer = setInterval(() => {
        loadMessages();
      }, settings.autoRefreshInterval * 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
    };
  }, []);

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (statusFilter !== "All") {
        if (
          statusFilter === "Pending" &&
          ticket.status !== "Pending" &&
          ticket.status !== "Open" &&
          ticket.status !== "In Progress"
        ) {
          return false;
        }
        if (statusFilter === "Resolved" && ticket.status !== "Resolved") {
          return false;
        }
        if (
          statusFilter === "Escalated" &&
          ticket.status !== "Escalated" &&
          !ticket.isEscalated
        ) {
          return false;
        }
      }

      if (priorityFilter !== "All" && ticket.priority !== priorityFilter) {
        return false;
      }

      if (sentimentFilter !== "All" && ticket.sentiment !== sentimentFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = ticket.subject.toLowerCase().includes(query);
        const matchesCustomer = ticket.customer.toLowerCase().includes(query);
        const matchesEmail = ticket.email.toLowerCase().includes(query);
        const matchesMessage = ticket.message.toLowerCase().includes(query);
        const matchesSummary = ticket.summary.toLowerCase().includes(query);
        if (
          !matchesSubject &&
          !matchesCustomer &&
          !matchesEmail &&
          !matchesMessage &&
          !matchesSummary
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, statusFilter, priorityFilter, sentimentFilter, searchQuery]);

  const pendingCount = tickets.filter(
    (ticket) =>
      ticket.status === "Pending" ||
      ticket.status === "Open" ||
      ticket.status === "In Progress"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) => ticket.status === "Resolved"
  ).length;

  const escalatedCount = tickets.filter(
    (ticket) => ticket.status === "Escalated" || ticket.isEscalated
  ).length;

  const urgentCount = tickets.filter(
    (ticket) => ticket.priority === "Urgent" || ticket.priority === "High"
  ).length;

  const relevantArticles = useMemo(() => {
    if (!selectedTicket || allArticles.length === 0) return [];

    const categoryMatches = allArticles.filter(
      (art) =>
        art.category?.toLowerCase() === selectedTicket.category?.toLowerCase()
    );

    const searchText =
      `${selectedTicket.subject} ${selectedTicket.message}`.toLowerCase();
    const keywordMatches = allArticles.filter((art) => {
      if (categoryMatches.includes(art)) return false;
      const titleHit = art.title
        .toLowerCase()
        .split(/\s+/)
        .some((word) => word.length > 3 && searchText.includes(word));
      const tagHit = art.tags?.some((tag) =>
        searchText.includes(tag.toLowerCase())
      );
      return titleHit || tagHit;
    });

    return [...categoryMatches, ...keywordMatches].slice(0, 4);
  }, [selectedTicket, allArticles]);

  const displayedKbArticles =
    kbSearchResults !== null ? kbSearchResults : relevantArticles;

  async function handleWorkspaceKbSearch(query: string) {
    setKbSearchQuery(query);
    if (!query.trim()) {
      setKbSearchResults(null);
      return;
    }

    try {
      const results = await searchKnowledgeArticles(query.trim());
      setKbSearchResults(results);
    } catch (err) {
      console.warn("Workspace KB search error:", err);
      const localMatches = allArticles.filter(
        (art) =>
          art.title.toLowerCase().includes(query.toLowerCase()) ||
          art.content.toLowerCase().includes(query.toLowerCase()) ||
          art.tags?.some((t) => t.toLowerCase().includes(query.toLowerCase()))
      );
      setKbSearchResults(localMatches);
    }
  }

  function insertKbIntoReply(article: KnowledgeArticle) {
    const snippet =
      article.content.length > 200
        ? `${article.content.slice(0, 200)}...`
        : article.content;
    const addition = `\n\n📌 Knowledge Base Reference (${article.title}):\n${snippet}\n`;

    const currentReplyText = editingReply
      ? editedReply
      : selectedTicket?.reply || "";
    const updated = currentReplyText + addition;

    setEditedReply(updated);
    setEditingReply(true);
    setMessage(`Inserted "${article.title}" snippet into reply draft.`);
  }

  function copyKbSnippet(article: KnowledgeArticle) {
    const textToCopy = article.content;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopiedSnippetId(article._id);
          showToast("📋 Snippet copied to clipboard!", { type: "success", icon: "✓" });
          setTimeout(() => setCopiedSnippetId(null), 2500);
        })
        .catch(() => {
          setCopiedSnippetId(article._id);
          showToast("📋 Snippet copied!", { type: "success" });
          setTimeout(() => setCopiedSnippetId(null), 2500);
        });
    } else {
      setCopiedSnippetId(article._id);
      showToast("📋 Snippet copied!", { type: "success" });
      setTimeout(() => setCopiedSnippetId(null), 2500);
    }
  }

  function selectTicket(ticket: Ticket) {
    setSelectedId(ticket.id);
    setEditingReply(false);
    setActiveTone(null);
    setReplyRefineNotice("");
    setMessage("");
    setKbSearchQuery("");
    setKbSearchResults(null);
  }

  function handleBellClick() {
    setShowNoticeAlert((prev) => !prev);
    // Trigger bell swing animation
    setBellAnimating(true);
    if (bellTimerRef.current) clearTimeout(bellTimerRef.current);
    bellTimerRef.current = setTimeout(() => setBellAnimating(false), 800);
  }

  async function handleCreateTicket() {
    const { subject, sender, body, priority, category } = createTicketForm;
    if (!subject.trim() || !sender.trim() || !body.trim()) {
      showToast("Please fill in Subject, From, and Message fields.", { type: "error", icon: "⚠️" });
      return;
    }

    try {
      setCreatingTicket(true);

      // Use the existing fetchUnread endpoint approach — post to /api/messages/manual
      // which creates a synthetic ticket via the backend. If that endpoint doesn't exist,
      // we gracefully create a local ticket and show a notice.
      const response = await fetch(`${API_BASE}/api/messages/manual`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          sender: sender.trim(),
          body: body.trim(),
          priority,
          category,
        }),
      });

      if (response.ok) {
        await loadMessages();
        showToast("✓ Ticket created and analyzed!", { type: "success", icon: "✓" });
      } else {
        // Backend doesn't have a manual endpoint — create local synthetic ticket
        const newTicket: Ticket = {
          id: `TICKET-manual-${Date.now()}`,
          rawId: `manual-${Date.now()}`,
          subject: subject.trim(),
          customer: sender.trim().split("@")[0] || sender.trim(),
          email: sender.trim(),
          status: "Pending",
          priority,
          category,
          message: body.trim(),
          orderId: "—",
          received: new Date().toLocaleString(),
          reply: `Thank you for contacting us. We have received your inquiry regarding "${subject.trim()}" and will get back to you shortly.`,
          originalSuggestedReply: "",
          summary: `Customer inquiry: ${subject.trim()}`,
          sentiment: "Neutral",
        };
        setTickets((prev) => [newTicket, ...prev]);
        setSelectedId(newTicket.id);
        showToast("✓ Ticket created locally!", { type: "success", icon: "✓" });
      }

      setShowCreateTicketModal(false);
      setCreateTicketForm({ subject: "", sender: "", body: "", priority: "Medium", category: "General" });
    } catch (err) {
      console.warn("Create ticket error:", err);
      // Local fallback
      const newTicket: Ticket = {
        id: `TICKET-manual-${Date.now()}`,
        rawId: `manual-${Date.now()}`,
        subject: createTicketForm.subject.trim(),
        customer: createTicketForm.sender.trim().split("@")[0] || createTicketForm.sender.trim(),
        email: createTicketForm.sender.trim(),
        status: "Pending",
        priority: createTicketForm.priority,
        category: createTicketForm.category,
        message: createTicketForm.body.trim(),
        orderId: "—",
        received: new Date().toLocaleString(),
        reply: `Thank you for contacting us. We have received your inquiry regarding "${createTicketForm.subject.trim()}" and will get back to you shortly.`,
        originalSuggestedReply: "",
        summary: `Customer inquiry: ${createTicketForm.subject.trim()}`,
        sentiment: "Neutral",
      };
      setTickets((prev) => [newTicket, ...prev]);
      setSelectedId(newTicket.id);
      setShowCreateTicketModal(false);
      setCreateTicketForm({ subject: "", sender: "", body: "", priority: "Medium", category: "General" });
      showToast("✓ Ticket added to workspace!", { type: "success", icon: "✓" });
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleRefineReply(
    tone:
      | "formal"
      | "friendly"
      | "shorten"
      | "simplify"
      | "include_kb"
      | "reset"
  ) {
    if (!selectedTicket || actionLoading || refining) return;

    if (tone === "reset") {
      const original =
        selectedTicket.originalSuggestedReply || selectedTicket.reply;
      setEditedReply(original);
      setEditingReply(false);
      setActiveTone(null);
      setReplyRefineNotice("Reset to original AI draft.");
      try {
        await updateTicketReply(selectedTicket.rawId, original);
        setTickets((current) =>
          current.map((t) =>
            t.id === selectedTicket.id || t.rawId === selectedTicket.rawId
              ? { ...t, reply: original }
              : t
          )
        );
      } catch (err) {
        console.warn("Could not save reset reply:", err);
      }
      return;
    }

    try {
      setRefining(true);
      setActiveTone(tone);
      setReplyRefineNotice(`Refining response (${tone})...`);

      const currentReplyText = editingReply
        ? editedReply
        : selectedTicket.reply;
      const topKbSnippet = displayedKbArticles[0]?.content || "";

      let newReplyText = "";

      try {
        const result = await refineTicketReply(selectedTicket.rawId, {
          tone,
          reply: currentReplyText,
          kbSnippet: topKbSnippet,
        });

        if (result?.refinedReply) {
          newReplyText = result.refinedReply;
        }
      } catch (backendError) {
        console.warn(
          "Backend AI refine failed, applying client tone transformation:",
          backendError
        );
        newReplyText = localRefineText(
          currentReplyText,
          tone,
          selectedTicket.customer,
          topKbSnippet
        );
      }

      if (!newReplyText) {
        newReplyText = localRefineText(
          currentReplyText,
          tone,
          selectedTicket.customer,
          topKbSnippet
        );
      }

      setEditedReply(newReplyText);
      setEditingReply(true);
      setReplyRefineNotice(
        `Applied ${tone.replace("_", " ").toUpperCase()} tone refinement.`
      );

      await updateTicketReply(selectedTicket.rawId, newReplyText);
      setTickets((current) =>
        current.map((t) =>
          t.id === selectedTicket.id || t.rawId === selectedTicket.rawId
            ? { ...t, reply: newReplyText }
            : t
        )
      );
    } catch (error) {
      console.error("Refinement error:", error);
      setReplyRefineNotice(
        error instanceof Error
          ? error.message
          : "Failed to apply AI refinement."
      );
    } finally {
      setRefining(false);
    }
  }

  async function markResolved() {
    if (!selectedTicket || actionLoading) return;

    try {
      setActionLoading(true);
      setMessage("Updating ticket status...");

      await updateTicketStatus(selectedTicket.rawId, "Resolved");

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicket.id ||
          ticket.rawId === selectedTicket.rawId
            ? { ...ticket, status: "Resolved" }
            : ticket
        )
      );

      setMessage("Ticket marked as resolved.");
    } catch (error) {
      console.error("Failed to mark resolved:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to update ticket status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function openEscalateModal() {
    if (!selectedTicket) return;
    setSelectedPresetReason("");
    setEscalationReasonInput(selectedTicket.escalationReason || "");
    setShowEscalateModal(true);
  }

  async function confirmEscalation() {
    if (!selectedTicket || actionLoading) return;

    const finalReason =
      escalationReasonInput.trim() ||
      selectedPresetReason ||
      "Escalated to Tier 2 engineering for specialized review.";

    try {
      setActionLoading(true);
      setMessage("Escalating ticket to Tier 2...");

      await escalateTicket(selectedTicket.rawId, finalReason);

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicket.id ||
          ticket.rawId === selectedTicket.rawId
            ? {
                ...ticket,
                status: "Escalated",
                isEscalated: true,
                escalationReason: finalReason,
                escalatedAt: new Date().toISOString(),
              }
            : ticket
        )
      );

      setShowEscalateModal(false);
      setMessage("Ticket escalated with reason noted.");
    } catch (error) {
      console.error("Failed to escalate ticket:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to escalate ticket."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function startEditing() {
    if (!selectedTicket) return;
    setEditedReply(selectedTicket.reply);
    setEditingReply(true);
    setMessage("");
  }

  async function saveReply() {
    if (!selectedTicket || actionLoading) return;

    try {
      setActionLoading(true);
      setMessage("Saving reply draft...");

      await updateTicketReply(selectedTicket.rawId, editedReply);

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicket.id ||
          ticket.rawId === selectedTicket.rawId
            ? { ...ticket, reply: editedReply }
            : ticket
        )
      );

      setEditingReply(false);
      setMessage("Reply draft saved successfully.");
    } catch (error) {
      console.error("Failed to save reply:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save reply draft."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function sendResponse() {
    if (!selectedTicket || actionLoading) return;

    try {
      setActionLoading(true);
      setMessage("Sending reply via Gmail...");

      const replyToSend = editingReply ? editedReply : selectedTicket.reply;
      const result = await sendTicketReply(selectedTicket.rawId, replyToSend);

      const sentTime = result.ticket.sentAt || new Date().toISOString();

      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selectedTicket.id ||
          ticket.rawId === selectedTicket.rawId
            ? {
                ...ticket,
                reply: replyToSend,
                status: "Resolved",
                sentAt: sentTime,
              }
            : ticket
        )
      );

      setEditingReply(false);
      setMessage(
        `✓ Response successfully sent through Gmail at ${new Date(
          sentTime
        ).toLocaleTimeString()}`
      );
    } catch (error) {
      console.error("Failed to send response:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to send response through Gmail."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function connectGmail() {
    window.location.href =
      `${API_BASE}/auth/google?redirect=` +
      encodeURIComponent(window.location.origin);
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main workspace-view-transition">
        {/* Breadcrumb Trail */}
        <div className="breadcrumb-trail">
          <span>Workspace</span>
          <span>/</span>
          <span className="current">Ticket Dashboard</span>
        </div>

        {/* Top Header with Dynamic Greeting & Bell Alert Trigger */}
        <div
          className="dashboard-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "var(--primary, #599345)", fontWeight: 800 }}>
              Agent Workspace · 3-Column Triage
            </span>
            <h1 style={{ margin: "2px 0 0", fontSize: "28px", fontWeight: 800 }}>
              {greeting}, Agent! <span aria-hidden="true">👋</span>
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted, #64748b)", fontSize: "14px" }}>
              Triage customer issues, refine Gemini responses, and send verified solutions.
            </p>
            <div style={{ marginTop: "6px", fontSize: "13px", color: "#475569" }}>
              <strong>Gmail:</strong>{" "}
              {connected
                ? `Connected ${email ? `(${email})` : ""}`
                : "Not connected"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Notification Alert Bell with badge */}
            <div className="bell-btn-wrap tooltip-wrapper">
              <button
                type="button"
                className={`secondary-button${bellAnimating ? " bell-swing-active" : ""}`}
                style={{
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
                onClick={handleBellClick}
                aria-label={`Toggle alerts: ${urgentCount} urgent tickets, ${pendingCount} pending`}
                aria-expanded={showNoticeAlert}
                aria-controls="alert-banner"
              >
                <span style={{ fontSize: "15px" }} aria-hidden="true">🔔</span>
                <span>Alerts</span>
              </button>
              {urgentCount > 0 && (
                <span className="bell-badge" aria-hidden="true">
                  {urgentCount > 99 ? "99+" : urgentCount}
                </span>
              )}
              <span className="tooltip-content" role="tooltip">
                {urgentCount} urgent · {pendingCount} open
              </span>
            </div>

            {/* Create Ticket Button */}
            <div className="tooltip-wrapper">
              <button
                type="button"
                className="secondary-button"
                style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 700 }}
                onClick={() => setShowCreateTicketModal(true)}
                aria-label="Create a new support ticket manually"
              >
                + New Ticket
              </button>
              <span className="tooltip-content" role="tooltip">
                Manually create a support ticket
              </span>
            </div>

            {!connected && (
              <button
                className="primary-button"
                onClick={connectGmail}
                aria-label="Connect your Gmail account to enable email syncing"
              >
                Connect Gmail
              </button>
            )}

            <button
              className="secondary-button"
              onClick={loadMessages}
              disabled={loading || actionLoading}
              aria-label="Refresh ticket list"
            >
              Refresh
            </button>

            <button
              className="primary-button"
              onClick={fetchUnreadMessages}
              disabled={fetching || !connected || actionLoading}
              aria-label={fetching ? "Fetching unread Gmail messages" : "Fetch unread Gmail messages and analyze with Gemini"}
            >
              {fetching ? "Fetching..." : "Fetch Unread Messages"}
            </button>
          </div>
        </div>


        {/* Dismissible Alert Summary Banner */}
        {showNoticeAlert && (
          <div className="topbar-alert-banner" role="alert">
            <div>
              <strong>Live Alerts:</strong> {urgentCount} urgent ticket(s) requiring attention, {pendingCount} open ticket(s), Gmail {connected ? "online" : "disconnected"}.
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

        {message && <div className="dashboard-message">{message}</div>}

        <div className="dashboard-grid">
          {/* ================================================================
              LEFT PANEL: TICKET QUEUE & FILTERS
             ================================================================ */}
          <section className="dashboard-card ticket-panel" aria-label="Ticket Queue">
            <div className="card-header">
              <h2>Tickets ({tickets.length})</h2>
            </div>

            {/* Ticket Search Box */}
            <div className="ticket-search-box">
              <input
                type="text"
                className="ticket-search-input"
                placeholder="🔍 Search tickets, customer, issue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search tickets"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="filter-buttons">
              {(["All", "Pending", "Resolved", "Escalated"] as const).map(
                (item) => (
                  <button
                    key={item}
                    className={
                      statusFilter === item
                        ? "filter-button active"
                        : "filter-button"
                    }
                    onClick={() => setStatusFilter(item)}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            {/* Secondary Filter Dropdowns (Priority & Sentiment) */}
            <div className="ticket-filter-row">
              <select
                className="filter-select"
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as "All" | TicketPriority)
                }
                aria-label="Filter by priority"
              >
                <option value="All">Priority: All</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                className="filter-select"
                value={sentimentFilter}
                onChange={(e) =>
                  setSentimentFilter(e.target.value as "All" | TicketSentiment)
                }
                aria-label="Filter by customer sentiment"
              >
                <option value="All">Sentiment: All</option>
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
              </select>
            </div>

            {/* Tickets List */}
            <div className="ticket-list">
              {loading ? (
                /* Shimmering Skeletons */
                <div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-line title"></div>
                      <div className="skeleton-line body"></div>
                      <div className="skeleton-line meta"></div>
                    </div>
                  ))}
                </div>
              ) : visibleTickets.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center" }}>
                  {tickets.length === 0 ? (
                    <>
                      No tickets found.
                      <br />
                      <small>
                        Connect Gmail and click "Fetch Unread Messages".
                      </small>
                    </>
                  ) : (
                    <>
                      No tickets match the selected filters.
                      <br />
                      <button
                        className="secondary-button"
                        style={{
                          marginTop: "10px",
                          padding: "4px 10px",
                          fontSize: "12px",
                        }}
                        onClick={() => {
                          setStatusFilter("All");
                          setPriorityFilter("All");
                          setSentimentFilter("All");
                          setSearchQuery("");
                        }}
                      >
                        Clear Filters
                      </button>
                    </>
                  )}
                </div>
              ) : (
                visibleTickets.map((ticket) => {
                  const priorityClass = `priority-${
                    ticket.priority?.toLowerCase() || "medium"
                  }`;
                  const sentimentClass = `sentiment-${
                    ticket.sentiment?.toLowerCase() || "neutral"
                  }`;

                  return (
                    <button
                      key={ticket.id}
                      className={
                        ticket.id === selectedTicket?.id
                          ? "ticket-item selected hover-lift"
                          : "ticket-item hover-lift"
                      }
                      onClick={() => selectTicket(ticket)}
                      aria-label={`Select ticket: ${ticket.subject}`}
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <CategoryIcon category={ticket.category} subject={ticket.subject} sender={ticket.customer} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ticket-item-title">{ticket.subject}</div>

                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              flexWrap: "wrap",
                              marginBottom: "6px",
                            }}
                          >
                            <span className={`chip ${priorityClass}`}>
                              {ticket.priority}
                            </span>
                            <span className={`chip ${sentimentClass}`}>
                              {ticket.sentiment}
                            </span>
                            {ticket.isEscalated && (
                              <span className="status-badge escalated">
                                ⚠️ Escalated
                              </span>
                            )}
                            {ticket.sentAt && (
                              <span className="status-badge resolved">✓ Sent</span>
                            )}
                          </div>

                          <div className="ticket-item-meta">
                            <span>{ticket.category}</span>
                            <span>{ticket.customer}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Metrics Footer */}
            <div className="metrics">
              <h3>Live Metrics</h3>
              <div className="metric">
                <span>Open / Pending</span>
                <strong>{pendingCount}</strong>
              </div>
              <div className="metric">
                <span>Escalated</span>
                <strong>{escalatedCount}</strong>
              </div>
              <div className="metric">
                <span>Resolved Today</span>
                <strong>{resolvedCount}</strong>
              </div>
              <div className="metric">
                <span>Total Tickets</span>
                <strong>{tickets.length}</strong>
              </div>
            </div>
          </section>

          {/* ================================================================
              CENTER PANEL: TICKET DETAILS & CONTEXTUAL KB
             ================================================================ */}
          <section className="dashboard-card details-panel" aria-label="Ticket Details & Knowledge Base">
            <h2>Ticket Details</h2>

            {loading && !selectedTicket ? (
              <div className="skeleton-card" style={{ padding: "20px" }}>
                <div className="skeleton-line title" style={{ height: "22px", marginBottom: "12px" }}></div>
                <div className="skeleton-line body" style={{ height: "14px", marginBottom: "8px" }}></div>
                <div className="skeleton-line body" style={{ height: "60px", marginBottom: "14px" }}></div>
                <div className="skeleton-line meta"></div>
              </div>
            ) : !selectedTicket ? (
              <div style={{ padding: "30px 0", textAlign: "center" }}>
                <h3>No ticket selected</h3>
                <p>Fetch unread Gmail messages to create AI-analyzed tickets.</p>
              </div>
            ) : (
              <div className="ticket-details">
                {/* Sent Confirmation Banner */}
                {selectedTicket.sentAt && (
                  <div className="sent-banner">
                    <span className="sent-banner-icon">✓</span>
                    <div>
                      <strong>Response Sent via Gmail</strong>
                      <div style={{ fontSize: "12px", opacity: 0.9 }}>
                        Delivered on {formatReceived(selectedTicket.sentAt)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Escalation Alert Banner */}
                {selectedTicket.isEscalated && (
                  <div className="escalation-banner">
                    <div className="escalation-banner-title">
                      <span>⚠️</span>
                      <span>Escalated to Tier 2 Support</span>
                    </div>
                    {selectedTicket.escalatedAt && (
                      <div style={{ fontSize: "11px", opacity: 0.85 }}>
                        Escalated on:{" "}
                        {formatReceived(selectedTicket.escalatedAt)}
                      </div>
                    )}
                    {selectedTicket.escalationReason && (
                      <div className="escalation-banner-reason">
                        Reason: {selectedTicket.escalationReason}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                  <CategoryIcon category={selectedTicket.category} subject={selectedTicket.subject} sender={selectedTicket.customer} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: "18px" }}>{selectedTicket.subject}</h2>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>ID: {selectedTicket.id}</span>
                  </div>
                </div>

                <div className="detail-row">
                  <div>
                    <strong>Category</strong>
                    <span>{selectedTicket.category}</span>
                  </div>

                  <div>
                    <strong>Priority</strong>
                    <span
                      className={`chip priority-${
                        selectedTicket.priority?.toLowerCase() || "medium"
                      }`}
                      style={{ alignSelf: "flex-start", marginTop: "4px" }}
                    >
                      {selectedTicket.priority}
                    </span>
                  </div>
                </div>

                <hr />

                <div className="customer-info">
                  <strong>{selectedTicket.customer}</strong>
                  <span>{selectedTicket.email}</span>
                  <small>Received: {selectedTicket.received}</small>
                </div>

                <hr />

                <h3>Customer Message</h3>
                <div className="customer-message">{selectedTicket.message}</div>

                <hr />

                <h3>AI Summary</h3>
                <div className="customer-message">
                  {selectedTicket.summary || "No summary available."}
                </div>

                <hr />

                <div className="detail-row">
                  <div>
                    <strong>Sentiment</strong>
                    <span
                      className={`chip sentiment-${
                        selectedTicket.sentiment?.toLowerCase() || "neutral"
                      }`}
                      style={{ alignSelf: "flex-start", marginTop: "4px" }}
                    >
                      {selectedTicket.sentiment}
                    </span>
                  </div>

                  <div>
                    <strong>Order ID</strong>
                    <span>{selectedTicket.orderId}</span>
                  </div>
                </div>

                <hr />

                <h3>Status</h3>
                <div
                  className={
                    selectedTicket.status === "Resolved"
                      ? "status resolved"
                      : selectedTicket.status === "Escalated" ||
                        selectedTicket.isEscalated
                      ? "status-badge escalated"
                      : "status pending"
                  }
                >
                  {selectedTicket.status}
                </div>

                {/* Primary Ticket Action Buttons */}
                <div className="action-buttons">
                  <button
                    className="success-button"
                    onClick={markResolved}
                    disabled={
                      selectedTicket.status === "Resolved" || actionLoading
                    }
                  >
                    {actionLoading ? "Updating..." : "Mark as Resolved"}
                  </button>

                  <button
                    className="danger-button"
                    onClick={openEscalateModal}
                    disabled={
                      selectedTicket.status === "Escalated" ||
                      selectedTicket.isEscalated ||
                      actionLoading
                    }
                  >
                    {selectedTicket.isEscalated
                      ? "Already Escalated"
                      : "Escalate Issue"}
                  </button>
                </div>

                {/* Contextual In-Workspace Knowledge Base Suggestions */}
                <div className="workspace-kb-container">
                  <div className="workspace-kb-header">
                    <h3>
                      <span>📚</span>
                      <span>Knowledge Base Suggestions</span>
                    </h3>
                  </div>

                  {/* Quick in-workspace KB search */}
                  <div className="workspace-kb-search">
                    <input
                      type="text"
                      placeholder="Search knowledge articles for this ticket..."
                      value={kbSearchQuery}
                      onChange={(e) => handleWorkspaceKbSearch(e.target.value)}
                    />
                    {kbSearchQuery && (
                      <button
                        type="button"
                        className="btn-kb-action"
                        onClick={() => handleWorkspaceKbSearch("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Contextual KB Articles List */}
                  <div className="workspace-kb-list">
                    {displayedKbArticles.length === 0 ? (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          padding: "10px",
                          textAlign: "center",
                        }}
                      >
                        No matching articles found. You can search above or explore
                        the Knowledge Base page.
                      </div>
                    ) : (
                      displayedKbArticles.map((art) => (
                        <div key={art._id} className="workspace-kb-card">
                          <div className="workspace-kb-card-top">
                            <h4 className="workspace-kb-title">{art.title}</h4>
                            <span
                              className={`kb-badge ${
                                art.category
                                  ? art.category.toLowerCase()
                                  : "general"
                              }`}
                            >
                              {art.category || "General"}
                            </span>
                          </div>

                          <div className="workspace-kb-snippet">
                            {art.content.length > 130
                              ? `${art.content.slice(0, 130)}...`
                              : art.content}
                          </div>

                          <div className="workspace-kb-actions">
                            <button
                              type="button"
                              className="btn-kb-action primary"
                              onClick={() => insertKbIntoReply(art)}
                            >
                              ✍️ Insert into Reply
                            </button>

                            <button
                              type="button"
                              className="btn-kb-action"
                              onClick={() => copyKbSnippet(art)}
                            >
                              {copiedSnippetId === art._id
                                ? "✓ Copied!"
                                : "📋 Copy Snippet"}
                            </button>

                            <button
                              type="button"
                              className="btn-kb-action"
                              onClick={() => setPreviewArticle(art)}
                            >
                              👁️ View Full
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ================================================================
              RIGHT PANEL: AI SUGGESTED REPLY & REFINEMENT WORKSPACE
             ================================================================ */}
          <section className="dashboard-card reply-panel" aria-label="AI Reply Workspace">
            <h2>Suggested Reply</h2>

            {/* Quick Contextual AI Prompt Starter Chips */}
            {selectedTicket && (
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Quick Contextual Refinements:
                </span>
                <div className="ai-prompt-starter-chips">
                  {QUICK_AI_PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className="ai-prompt-starter-chip"
                      onClick={() => handleRefineReply(chip.tone)}
                      disabled={refining || actionLoading}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Refinement Toolbar */}
            {selectedTicket && (
              <div className="ai-tools-panel">
                <div className="ai-tools-header">
                  <span className="ai-tools-title">
                    <span>✨</span> AI Tone Refinement
                  </span>
                  {refining && (
                    <span style={{ fontSize: "11px", color: "var(--primary, #599345)", fontWeight: 700 }}>
                      Processing...
                    </span>
                  )}
                </div>

                <div className="ai-refine-grid">
                  <button
                    type="button"
                    className={`ai-refine-btn ${
                      activeTone === "formal" ? "active" : ""
                    }`}
                    onClick={() => handleRefineReply("formal")}
                    disabled={refining || actionLoading}
                    title="Rewrite reply in a formal, professional tone"
                  >
                    👔 Formal
                  </button>

                  <button
                    type="button"
                    className={`ai-refine-btn ${
                      activeTone === "friendly" ? "active" : ""
                    }`}
                    onClick={() => handleRefineReply("friendly")}
                    disabled={refining || actionLoading}
                    title="Rewrite reply in a warm, friendly tone"
                  >
                    😊 Friendly
                  </button>

                  <button
                    type="button"
                    className={`ai-refine-btn ${
                      activeTone === "shorten" ? "active" : ""
                    }`}
                    onClick={() => handleRefineReply("shorten")}
                    disabled={refining || actionLoading}
                    title="Make reply concise and direct"
                  >
                    ✂️ Shorten
                  </button>

                  <button
                    type="button"
                    className={`ai-refine-btn ${
                      activeTone === "simplify" ? "active" : ""
                    }`}
                    onClick={() => handleRefineReply("simplify")}
                    disabled={refining || actionLoading}
                    title="Simplify language with clear steps"
                  >
                    💡 Simplify
                  </button>

                  <button
                    type="button"
                    className={`ai-refine-btn ${
                      activeTone === "include_kb" ? "active" : ""
                    }`}
                    onClick={() => handleRefineReply("include_kb")}
                    disabled={refining || actionLoading}
                    title="Inject matching knowledge base policy into response"
                  >
                    📚 Include KB
                  </button>

                  <button
                    type="button"
                    className="ai-refine-btn reset-btn"
                    onClick={() => handleRefineReply("reset")}
                    disabled={refining || actionLoading}
                    title="Reset to initial Gemini AI draft"
                  >
                    ↺ Reset to Original AI Draft
                  </button>
                </div>

                {replyRefineNotice && (
                  <div className="ai-refine-status">
                    <span>{replyRefineNotice}</span>
                  </div>
                )}
              </div>
            )}

            {!selectedTicket ? (
              <div className="reply-box">No ticket selected.</div>
            ) : !editingReply ? (
              <div className="reply-box">
                {renderFormattedAIResponse(selectedTicket.reply)}
              </div>
            ) : (
              <textarea
                value={editedReply}
                onChange={(event) => setEditedReply(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!actionLoading && !refining) {
                      saveReply();
                    }
                  }
                }}
                rows={16}
                className="reply-editor"
                disabled={actionLoading || refining}
                placeholder="Compose or edit your reply to the customer... (Enter to save, Shift+Enter for new line)"
                aria-label="Edit reply draft. Press Enter to save, Shift+Enter for new line."
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
                      disabled={actionLoading || refining}
                    >
                      {actionLoading ? "Sending..." : "Send Response via Gmail"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={startEditing}
                      disabled={actionLoading || refining}
                    >
                      Edit Reply
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="primary-button"
                      onClick={saveReply}
                      disabled={actionLoading || refining}
                    >
                      {actionLoading ? "Saving..." : "Save Draft"}
                    </button>

                    <button
                      className="secondary-button"
                      onClick={() => setEditingReply(false)}
                      disabled={actionLoading || refining}
                    >
                      Done Editing
                    </button>

                    <button
                      className="success-button"
                      onClick={sendResponse}
                      disabled={actionLoading || refining}
                    >
                      Send via Gmail
                    </button>
                  </>
                )}
              </div>
            )}

            <p className="ai-caption">
              Suggested response powered by Gemini AI with in-workspace tone and
              Knowledge Base tuning.
            </p>
          </section>
        </div>

        {/* ================================================================
            ESCALATION MODAL
           ================================================================ */}
        {showEscalateModal && selectedTicket && (
          <div
            className="escalation-modal-backdrop"
            onClick={() => setShowEscalateModal(false)}
          >
            <div
              className="escalation-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="escalation-dialog-title"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                }}
              >
                <h3 id="escalation-dialog-title" style={{ margin: 0, fontSize: "18px" }}>
                  Escalate Ticket to Tier 2 Support
                </h3>
                <button
                  className="secondary-button"
                  style={{ padding: "4px 10px" }}
                  onClick={() => setShowEscalateModal(false)}
                  aria-label="Close escalation dialog"
                >
                  ✕
                </button>
              </div>

              <p
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  margin: "0 0 14px",
                }}
              >
                Select an escalation reason or enter specific notes for the
                engineering or operations team.
              </p>

              <div>
                <strong style={{ fontSize: "12px", color: "#334155" }}>
                  Quick Preset Reasons:
                </strong>
                <div className="preset-reasons">
                  {PRESET_ESCALATION_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`preset-chip-btn ${
                        selectedPresetReason === preset ? "selected" : ""
                      }`}
                      onClick={() => {
                        setSelectedPresetReason(preset);
                        setEscalationReasonInput(preset);
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "6px",
                    color: "#334155",
                  }}
                >
                  Escalation Notes & Context:
                </label>
                <textarea
                  className="reply-editor"
                  rows={4}
                  value={escalationReasonInput}
                  onChange={(e) => setEscalationReasonInput(e.target.value)}
                  placeholder="Provide additional details regarding why this ticket is being escalated..."
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "18px",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "14px",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEscalateModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={confirmEscalation}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Escalating..." : "Confirm Escalation"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            KNOWLEDGE BASE ARTICLE PREVIEW MODAL
           ================================================================ */}
        {previewArticle && (
          <div
            className="kb-modal-backdrop"
            onClick={() => setPreviewArticle(null)}
          >
            <div
              className="kb-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="kb-dialog-title"
            >
              <div className="kb-modal-header">
                <div>
                  <span
                    className={`kb-badge ${
                      previewArticle.category
                        ? previewArticle.category.toLowerCase()
                        : "general"
                    }`}
                  >
                    {previewArticle.category || "General"}
                  </span>
                  <h2 id="kb-dialog-title" style={{ margin: "8px 0 0", fontSize: "20px" }}>
                    {previewArticle.title}
                  </h2>
                </div>

                <button
                  className="secondary-button"
                  style={{ padding: "6px 12px" }}
                  onClick={() => setPreviewArticle(null)}
                  aria-label="Close article preview"
                >
                  ✕
                </button>
              </div>

              <div className="kb-modal-content">{previewArticle.content}</div>

              {previewArticle.tags && previewArticle.tags.length > 0 && (
                <div className="kb-card-tags" style={{ marginBottom: "16px" }}>
                  {previewArticle.tags.map((tag) => (
                    <span key={tag} className="kb-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="kb-modal-footer">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    insertKbIntoReply(previewArticle);
                    setPreviewArticle(null);
                  }}
                >
                  ✍️ Insert into Reply
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPreviewArticle(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ================================================================
            MANUAL CREATE TICKET MODAL
           ================================================================ */}
        {showCreateTicketModal && (
          <div
            className="create-ticket-modal-backdrop"
            onClick={() => setShowCreateTicketModal(false)}
          >
            <div
              className="create-ticket-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-ticket-dialog-title"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <h3 id="create-ticket-dialog-title">Create New Support Ticket</h3>
                <button
                  className="secondary-button"
                  style={{ padding: "4px 10px" }}
                  onClick={() => setShowCreateTicketModal(false)}
                  aria-label="Close create ticket dialog"
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px" }}>
                Manually create a support ticket. It will be added to your workspace for triage.
              </p>

              <div className="modal-form-grid">
                <label>
                  Subject
                  <input
                    type="text"
                    value={createTicketForm.subject}
                    onChange={(e) =>
                      setCreateTicketForm((f) => ({ ...f, subject: e.target.value }))
                    }
                    placeholder="e.g. Billing issue with last invoice"
                    autoFocus
                  />
                </label>

                <label>
                  From (Customer Email)
                  <input
                    type="email"
                    value={createTicketForm.sender}
                    onChange={(e) =>
                      setCreateTicketForm((f) => ({ ...f, sender: e.target.value }))
                    }
                    placeholder="customer@example.com"
                  />
                </label>

                <div className="form-field-row">
                  <label>
                    Priority
                    <select
                      value={createTicketForm.priority}
                      onChange={(e) =>
                        setCreateTicketForm((f) => ({
                          ...f,
                          priority: e.target.value as TicketPriority,
                        }))
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </label>

                  <label>
                    Category
                    <select
                      value={createTicketForm.category}
                      onChange={(e) =>
                        setCreateTicketForm((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      <option value="General">General</option>
                      <option value="Technical">Technical</option>
                      <option value="Billing">Billing</option>
                      <option value="Account">Account</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>

                <label>
                  Message Body
                  <textarea
                    value={createTicketForm.body}
                    onChange={(e) =>
                      setCreateTicketForm((f) => ({ ...f, body: e.target.value }))
                    }
                    rows={5}
                    placeholder="Describe the customer's issue..."
                  />
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowCreateTicketModal(false)}
                  disabled={creatingTicket}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCreateTicket}
                  disabled={creatingTicket}
                >
                  {creatingTicket ? "Creating..." : "Create Ticket"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
