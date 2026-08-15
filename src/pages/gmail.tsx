import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

const BACKEND = "http://localhost:5000";

type GmailAnalysis = {
  category?: string;
  sentiment?: string;
  priority?: string;
  summary?: string;
};

type GmailMessage = {
  gmailMessageId?: string;
  sender?: string;
  subject?: string;
  body?: string;
  receivedAt?: string;
  analysis?: GmailAnalysis;
};

export default function Gmail() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [status, setStatus] = useState("Checking...");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshStatus() {
    setStatus("Checking...");
    setMessage("");

    try {
      const response = await fetch(
        `${BACKEND}/api/gmail/status`,
        {
          credentials: "include",
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to check Gmail status.");
      }

      setConnected(Boolean(data.connected));
      setEmail(data.email || "");

      if (data.connected) {
        setStatus(`Connected (${data.email})`);
        setMessage(
          "Gmail is connected. You can fetch unread messages.",
        );
      } else {
        setStatus("Not connected");
        setMessage("Click Connect Gmail to authorize access.");
      }
    } catch (error) {
      setConnected(false);
      setEmail("");
      setStatus("Not connected");
      setMessage(
        error instanceof Error
          ? error.message
          : "Please connect Gmail.",
      );
    }
  }

  function connectGmail() {
    const redirect = window.location.origin;

    window.location.href =
      `${BACKEND}/auth/google?redirect=${encodeURIComponent(redirect)}`;
  }

  async function fetchMessages() {
    setLoading(true);
    setMessage("Fetching unread Gmail messages...");

    try {
      const response = await fetch(
        `${BACKEND}/api/messages/fetch`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to fetch Gmail messages.",
        );
      }

      setMessages(data.messages || []);
      setStatus(`Fetched ${data.count || 0} messages`);
      setMessage("Unread messages fetched and analyzed.");
    } catch (error) {
      setStatus("Fetch failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to fetch messages.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStoredMessages() {
    try {
      const response = await fetch(
        `${BACKEND}/api/messages`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) return;

      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      // Ignore until Gmail is connected.
    }
  }

  useEffect(() => {
    async function initialize() {
      await refreshStatus();
      await loadStoredMessages();
    }

    initialize();
  }, []);

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-card gmail-page">
          <h1>Gmail Inbox</h1>

          <p>
            Connect Gmail to fetch unread messages and analyze
            them automatically.
          </p>

          <div className="gmail-actions">
            <button
              className="primary-button"
              onClick={connectGmail}
            >
              {connected ? "Reconnect Gmail" : "Connect Gmail"}
            </button>

            <button
              className="secondary-button"
              onClick={refreshStatus}
            >
              Refresh Status
            </button>

            <button
              className="secondary-button"
              onClick={fetchMessages}
              disabled={!connected || loading}
            >
              {loading
                ? "Fetching..."
                : "Fetch Unread Messages"}
            </button>
          </div>

          <div className="gmail-status">
            <strong>Status:</strong> {status}
          </div>

          {email && (
            <div className="gmail-connected">
              Connected account: {email}
            </div>
          )}

          {message && (
            <div className="dashboard-message">
              {message}
            </div>
          )}

          <div className="gmail-messages">
            {messages.length === 0 ? (
              <p>
                No stored messages yet. Connect Gmail and fetch
                unread messages.
              </p>
            ) : (
              messages.map((item, index) => (
                <div
                  className="gmail-message"
                  key={item.gmailMessageId || index}
                >
                  <h3>{item.subject || "No Subject"}</h3>

                  <p>
                    <strong>From:</strong>{" "}
                    {item.sender || "Unknown"}
                  </p>

                  {item.receivedAt && (
                    <p>
                      <strong>Received:</strong>{" "}
                      {new Date(
                        item.receivedAt,
                      ).toLocaleString()}
                    </p>
                  )}

                  {item.body && (
                    <p>
                      <strong>Message:</strong>{" "}
                      {item.body.slice(0, 500)}
                      {item.body.length > 500 ? "..." : ""}
                    </p>
                  )}

                  {item.analysis && (
                    <pre>
                      {JSON.stringify(
                        item.analysis,
                        null,
                        2,
                      )}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}



