export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketSentiment = "Positive" | "Neutral" | "Negative";
export type TicketStatus =
  | "Open"
  | "Pending"
  | "In Progress"
  | "Resolved"
  | "Escalated";

export interface BackendMessage {
  _id: string;
  gmailMessageId: string;
  userId: string;
  sender: string;
  subject: string;
  body: string;
  receivedAt: string;
  category: string;
  priority: TicketPriority;
  summary: string;
  sentiment: TicketSentiment;
  suggestedResponse: string;
  editedReply?: string;
  sentAt?: string | null;
  isEscalated?: boolean;
  escalatedAt?: string | null;
  escalationReason?: string;
  isTicket: boolean;
  status?: TicketStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ticket {
  id: string;
  rawId: string;
  subject: string;
  customer: string;
  email: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  message: string;
  orderId: string;
  received: string;
  reply: string;
  originalSuggestedReply?: string;
  summary: string;
  sentiment: TicketSentiment;
  isEscalated?: boolean;
  escalatedAt?: string | null;
  escalationReason?: string;
  sentAt?: string | null;
}

export interface GmailStatusResponse {
  connected: boolean;
  email?: string;
}

export interface FetchMessagesResponse {
  count: number;
  messages: BackendMessage[];
}

export interface SendReplyResponse {
  message: string;
  ticket: BackendMessage;
  sendResult?: {
    id?: string;
    threadId?: string;
  };
}

export interface KnowledgeArticle {
  _id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

