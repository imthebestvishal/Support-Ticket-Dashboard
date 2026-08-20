import type {
  BackendMessage,
  GmailStatusResponse,
  FetchMessagesResponse,
  SendReplyResponse,
  TicketStatus,
  KnowledgeArticle,
} from "../types/ticket";

const API_BASE = "http://localhost:5000";

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

export async function getGmailStatus(): Promise<GmailStatusResponse> {
  const response = await fetch(`${API_BASE}/api/gmail/status`, {
    credentials: "include",
  });
  return handleResponse<GmailStatusResponse>(response);
}

export async function getMessages(): Promise<BackendMessage[]> {
  const response = await fetch(`${API_BASE}/api/messages`, {
    credentials: "include",
  });
  return handleResponse<BackendMessage[]>(response);
}

export async function fetchUnreadMessages(): Promise<FetchMessagesResponse> {
  const response = await fetch(`${API_BASE}/api/messages/fetch`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<FetchMessagesResponse>(response);
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus
): Promise<BackendMessage> {
  const response = await fetch(`${API_BASE}/api/messages/${id}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse<BackendMessage>(response);
}

export async function updateTicketReply(
  id: string,
  reply: string
): Promise<BackendMessage> {
  const response = await fetch(`${API_BASE}/api/messages/${id}/reply`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reply }),
  });
  return handleResponse<BackendMessage>(response);
}

export async function escalateTicket(
  id: string,
  reason?: string
): Promise<BackendMessage> {
  const response = await fetch(`${API_BASE}/api/messages/${id}/escalate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  return handleResponse<BackendMessage>(response);
}

export async function sendTicketReply(
  id: string,
  reply: string
): Promise<SendReplyResponse> {
  const response = await fetch(`${API_BASE}/api/messages/${id}/send`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reply }),
  });
  return handleResponse<SendReplyResponse>(response);
}

export async function refineTicketReply(
  id: string,
  options: {
    tone: "formal" | "friendly" | "shorten" | "simplify" | "include_kb";
    reply?: string;
    kbSnippet?: string;
  }
): Promise<{ refinedReply: string }> {
  const response = await fetch(`${API_BASE}/api/messages/${id}/refine`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });
  return handleResponse<{ refinedReply: string }>(response);
}

export async function getKnowledgeArticles(
  category?: string
): Promise<KnowledgeArticle[]> {
  const url = category
    ? `${API_BASE}/api/knowledge/articles?category=${encodeURIComponent(category)}`
    : `${API_BASE}/api/knowledge/articles`;
  const response = await fetch(url, {
    credentials: "include",
  });
  return handleResponse<KnowledgeArticle[]>(response);
}

export async function searchKnowledgeArticles(
  query: string
): Promise<KnowledgeArticle[]> {
  const url = `${API_BASE}/api/knowledge/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    credentials: "include",
  });
  return handleResponse<KnowledgeArticle[]>(response);
}

export async function seedKnowledgeArticles(): Promise<{
  message: string;
  count: number;
  articles?: KnowledgeArticle[];
}> {
  const response = await fetch(`${API_BASE}/api/knowledge/seed`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return handleResponse<{
    message: string;
    count: number;
    articles?: KnowledgeArticle[];
  }>(response);
}
