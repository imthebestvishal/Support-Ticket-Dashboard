import { useEffect, useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getGmailStatus, getMessages } from "../services/api";

const API_BASE = "http://localhost:5000";

const items = [
  { to: "/dashboard", label: "Ticket Workspace", key: "dashboard" },
  { to: "/home", label: "Analytics & Overview", key: "home" },
  { to: "/gmail", label: "Gmail Inbox", key: "gmail" },
  { to: "/knowledge-base", label: "Knowledge Base", key: "knowledge-base" },
  { to: "/settings", label: "Settings", key: "settings" },
  { to: "/account", label: "Account & Profile", key: "account" },
];

export default function Sidebar() {
  const location = useLocation();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailEmail, setGmailEmail] = useState("");
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [gmailCount, setGmailCount] = useState<number | null>(null);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.to === location.pathname)
  );

  useEffect(() => {
    let isMounted = true;

    async function checkHealthAndCounts() {
      // 1. Check backend ping & live ticket count
      try {
        const messages = await getMessages();
        if (isMounted) {
          setBackendOnline(true);
          const count = Array.isArray(messages) ? messages.length : 0;
          setTicketCount(count);
          setGmailCount(count);
        }
      } catch {
        if (isMounted) {
          setBackendOnline(false);
        }
      }

      // 2. Check Gmail connection status
      try {
        const data = await getGmailStatus();
        if (isMounted) {
          setGmailConnected(Boolean(data.connected));
          setGmailEmail(data.email || "");
        }
      } catch {
        if (isMounted) {
          setGmailConnected(false);
        }
      }
    }

    checkHealthAndCounts();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  return (
    <aside className="dashboard-sidebar" aria-label="Main Workspace Navigation">
      <div className="sidebar-brand">
        <img
          src="/assets/brand-logo.png"
          alt="SupportHub Logo"
          style={{ height: "40px", maxWidth: "100%", objectFit: "contain" }}
        />
        <div>
          <strong>SupportHub</strong>
          <small>AI Agentic Workspace</small>
        </div>
      </div>

      <nav
        className="sidebar-nav"
        style={{ "--active-index": activeIndex } as CSSProperties}
      >
        <span className="nav-active-indicator" aria-hidden="true" />
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
            title={item.label}
          >
            <span className="sidebar-link-text">{item.label}</span>

            {/* Dynamic Count Badges */}
            {item.key === "dashboard" && ticketCount !== null && ticketCount > 0 && (
              <span
                className="sidebar-count-badge"
                title={`${ticketCount} active tickets in workspace`}
                aria-label={`${ticketCount} tickets`}
              >
                {ticketCount}
              </span>
            )}

            {item.key === "gmail" && gmailCount !== null && gmailCount > 0 && (
              <span
                className="sidebar-count-badge"
                title={`${gmailCount} analyzed emails`}
                aria-label={`${gmailCount} emails`}
              >
                {gmailCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        className="sidebar-bottom"
        style={{ marginTop: "auto", paddingTop: "20px" }}
      >
        <div
          className="connection"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "12px",
            marginBottom: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            <span
              className={backendOnline ? "green-dot" : "orange-dot"}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: backendOnline ? "#10b981" : "#f59e0b",
                display: "inline-block",
              }}
              aria-hidden="true"
            />
            <span>Backend</span>
          </div>
          <strong
            style={{
              fontSize: "11px",
              color: backendOnline ? "#10b981" : "#f59e0b",
            }}
          >
            {backendOnline === null
              ? "Checking..."
              : backendOnline
              ? "Online"
              : "Offline"}
          </strong>
        </div>

        <div
          className="connection"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            <span
              className={gmailConnected ? "green-dot" : "orange-dot"}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: gmailConnected ? "#10b981" : "#f59e0b",
                display: "inline-block",
              }}
              aria-hidden="true"
            />
            <span>Gmail</span>
          </div>
          <strong
            style={{
              fontSize: "11px",
              color: gmailConnected ? "#10b981" : "#9ca3af",
              maxWidth: "110px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={gmailEmail || (gmailConnected ? "Connected" : "Disconnected")}
          >
            {gmailConnected === null
              ? "Checking..."
              : gmailConnected
              ? gmailEmail || "Connected"
              : "Disconnected"}
          </strong>
        </div>
      </div>
    </aside>
  );
}
