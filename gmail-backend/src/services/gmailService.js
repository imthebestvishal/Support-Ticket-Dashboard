import { google } from "googleapis";
import { User } from "../models/user.js";
import mongoose from "mongoose";
import { Message } from "../models/message.js";
import {
  getMemoryUser,
  saveMemoryMessage,
} from "./memoryStore.js";
import { askAgentRouter } from "./agentRouterService.js";

function extractEmailAddress(value = "") {
  const match = value.match(/<([^>]+)>/);
  const email = (match?.[1] || value).trim();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : "";
}

function replySubject(subject = "") {
  const cleanSubject = subject.trim() || "Your support request";

  return /^re:/i.test(cleanSubject)
    ? cleanSubject
    : `Re: ${cleanSubject}`;
}

function encodeBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildRawReply({ to, from, subject, body }) {
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "MIME-Version: 1.0",
  ];

  return encodeBase64Url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

function calculatePriority(subject = "", body = "", sentiment = "") {
  const text = `${subject} ${body}`.toLowerCase();

  const highPriorityWords = [
    "urgent",
    "urgently",
    "emergency",
    "critical",
    "asap",
    "immediately",
    "account locked",
    "locked out",
    "cannot access",
    "can't access",
    "unable to login",
    "unable to log in",
    "password hacked",
    "hacked",
    "security breach",
    "fraud",
    "unauthorized",
    "unauthorised",
    "stolen",
    "payment failed",
    "payment failure",
    "charged twice",
    "double charged",
    "money missing",
    "service down",
    "system down",
    "website down",
    "outage",
    "not working",
    "completely broken",
    "deadline today",
    "deadline tomorrow",
    "legal action",
    "lawsuit",
    "very angry",
    "extremely disappointed"
  ];

  const mediumPriorityWords = [
    "complaint",
    "complain",
    "refund",
    "return",
    "billing",
    "invoice",
    "payment",
    "technical issue",
    "problem",
    "issue",
    "error",
    "bug",
    "delayed",
    "delay",
    "order problem",
    "account problem",
    "support",
    "help",
    "request",
    "not satisfied",
    "disappointed"
  ];

  const highMatches = highPriorityWords.filter(
    (word) => text.includes(word)
  ).length;

  const mediumMatches = mediumPriorityWords.filter(
    (word) => text.includes(word)
  ).length;

  if (
    highMatches >= 1 ||
    sentiment.toLowerCase() === "very negative"
  ) {
    return "High";
  }

  if (mediumMatches >= 1) {
    return "Medium";
  }

  return "Low";
}

const GMAIL_FETCH_LIMIT = Number(
  process.env.GMAIL_FETCH_LIMIT || 25
);

async function analyzeMessage(subject, body, sender) {
  const prompt = `
You are an AI support-ticket analyzer.

Analyze the following email and determine whether it should become a support ticket.

Email:
From: ${sender}
Subject: ${subject}
Body:
${body}

Return ONLY valid JSON in exactly this format:

{
  "category": "Technical",
  "priority": "Medium",
  "summary": "Short summary of the customer's issue",
  "sentiment": "Neutral",
  "suggestedResponse": "Professional response to the customer",
  "isTicket": true
}

Rules:

category must be exactly one of:
Technical, Billing, Account, General, Other

priority must be exactly one of:
Low, Medium, High, Urgent

sentiment must be exactly one of:
Positive, Neutral, Negative

isTicket must be true if the email contains a request, problem,
complaint, support question, account issue, billing issue,
technical issue, or action that requires attention.

Keep summary short.
`;

  const text = await askAgentRouter({
    messages: [
      {
        role: "system",
        content:
          "You analyze customer support emails. Return only valid JSON and do not include markdown.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.2,
    maxTokens: 900,
    json: true,
  });

  try {
    const parsed = JSON.parse(text);

    return {
      category: parsed.category || "Other",
      priority: parsed.priority || "Medium",
      summary: parsed.summary || "No summary available",
      sentiment: parsed.sentiment || "Neutral",
      suggestedResponse:
        parsed.suggestedResponse ||
        "Thank you for contacting us. We will review your request and get back to you shortly.",
      isTicket:
        typeof parsed.isTicket === "boolean"
          ? parsed.isTicket
          : true,
    };
  } catch (error) {
    console.error(
      "AgentRouter returned invalid JSON:",
      text
    );

    return {
      category: "Other",
      priority: "Medium",
      summary: text.substring(0, 500),
      sentiment: "Neutral",
      suggestedResponse:
        "Thank you for contacting us. We will review your request and get back to you shortly.",
      isTicket: true,
    };
  }
}

/*
|--------------------------------------------------------------------------
| Gmail client
|--------------------------------------------------------------------------
*/

async function getGmailClient(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
    expiry_date: user.tokenExpiry,
  });

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

export async function getAuthenticatedGmailClient(user) {
  return getGmailClient(user);
}

/*
|--------------------------------------------------------------------------
| Decode Gmail body
|--------------------------------------------------------------------------
*/

function decodeBase64(data) {
  if (!data) {
    return "";
  }

  return Buffer.from(
    data
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64"
  ).toString("utf8");
}

/*
|--------------------------------------------------------------------------
| Extract email body
|--------------------------------------------------------------------------
*/

function extractBody(payload) {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (
        part.mimeType === "text/plain" &&
        part.body?.data
      ) {
        return decodeBase64(part.body.data);
      }
    }

    for (const part of payload.parts) {
      const result = extractBody(part);

      if (result) {
        return result;
      }
    }
  }

  return "";
}

/*
|--------------------------------------------------------------------------
| Gmail header helper
|--------------------------------------------------------------------------
*/

function getHeader(headers, name) {
  const header = headers?.find(
    (item) =>
      item.name?.toLowerCase() ===
      name.toLowerCase()
  );

  return header?.value || "";
}

function summarizeForFallback(message) {
  const summary = (message.summary || "").trim();

  if (summary && summary !== "No summary available") {
    return summary;
  }

  const body = (message.body || "")
    .replace(/\s+/g, " ")
    .trim();

  return body
    ? body.slice(0, 220)
    : "your support request";
}

function buildFallbackReply(message) {
  const issue = summarizeForFallback(message);
  const category = message.category || "support";
  const priority = message.priority || "Medium";

  return `Hi,

Thank you for contacting us about "${message.subject || issue}".

We understand this is related to ${category.toLowerCase()} support, and we have noted the priority as ${priority}. Based on the details available, the main issue is: ${issue}

Our support team will review this and follow up with the next available update.

Best regards,
Support Team`;
}

export async function generateReplyDraft(message) {
  const fallback = buildFallbackReply(message);

  try {
    return await askAgentRouter({
      messages: [
        {
          role: "system",
          content:
            "You draft concise, professional customer support replies. Return only the email body, with no markdown and no subject line. Every draft must be specific to the customer's subject, summary, category, and message.",
        },
        {
          role: "user",
          content: `
Draft a reply to this support email.

Customer: ${message.sender || "Unknown"}
Subject: ${message.subject || "No subject"}
Priority: ${message.priority || "Medium"}
Category: ${message.category || "Other"}
Summary: ${message.summary || "No summary available"}

Original email:
${message.body || "No original body available"}

Suggested response:
${message.suggestedResponse || fallback}

Write a fresh reply for this exact email. Mention the specific issue from the summary or body. Use only the supplied facts. Do not promise actions that are not stated.
`,
        },
      ],
      temperature: 0.35,
      maxTokens: 700,
    });
  } catch (error) {
    console.warn(
      "AgentRouter reply draft unavailable.",
      error.message
    );

    return fallback;
  }
}

export async function sendReplyEmail({ user, message, replyBody }) {
  const to = extractEmailAddress(message.sender || "");

  if (!to) {
    throw new Error("This ticket does not have a valid customer email address.");
  }

  if (!replyBody || !replyBody.trim()) {
    throw new Error("Reply body is required.");
  }

  const gmail = await getAuthenticatedGmailClient(user);
  const raw = buildRawReply({
    to,
    from: user.email,
    subject: replySubject(message.subject || ""),
    body: replyBody.trim(),
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      ...(message.gmailThreadId
        ? {
            threadId: message.gmailThreadId,
          }
        : {}),
    },
  });

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Fetch unread Gmail messages and create tickets
|--------------------------------------------------------------------------
*/

export async function fetchAndAnalyzeMessages(userId) {
  const user =
    mongoose.connection.readyState === 1
      ? await User.findById(userId)
      : getMemoryUser(userId.toString());

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.accessToken && !user.refreshToken) {
    throw new Error(
      "Gmail account is not authenticated"
    );
  }

  const gmail = await getGmailClient(user);

  console.log("STEP 1: Fetching Gmail inbox messages...");

  const listResponse =
    await Promise.race([
      gmail.users.messages.list({
        userId: "me",
        q: "in:inbox newer_than:30d",
        maxResults: Math.min(
          Math.max(GMAIL_FETCH_LIMIT, 1),
          100
        ),
      }),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Gmail messages.list timed out after 20 seconds"
              )
            ),
          20000
        )
      ),
    ]);

  const gmailMessages =
    listResponse.data.messages || [];

  console.log(
    `STEP 2: Gmail API returned ${gmailMessages.length} recent inbox messages.`
  );

  const results = [];

  for (const gmailMessage of gmailMessages) {
    try {
      const messageResponse =
        await gmail.users.messages.get({
          userId: "me",
          id: gmailMessage.id,
          format: "full",
        });

      const message = messageResponse.data;

      const headers =
        message.payload?.headers || [];

      const subject =
        getHeader(headers, "Subject");

      const sender =
        getHeader(headers, "From");

      const date =
        getHeader(headers, "Date");

      const body =
        extractBody(message.payload);

      console.log(
        `Analyzing email: ${subject}`
      );

      console.log("STEP 3: Starting AI analysis...");

      let analysis;

      try {
        analysis = await analyzeMessage(
          subject,
          body,
          sender
        );

        console.log(
          `AI result: ${JSON.stringify(analysis)}`
        );

      } catch (aiError) {
        console.error(
          "AgentRouter analysis failed:",
          aiError.message
        );

        console.log(
          "Using fallback analysis for this email."
        );

        const text =
          `${subject} ${body}`.toLowerCase();

        let category = "General";

        if (
          text.includes("bill") ||
          text.includes("billing") ||
          text.includes("invoice") ||
          text.includes("payment") ||
          text.includes("refund") ||
          text.includes("charged")
        ) {
          category = "Billing";
        } else if (
          text.includes("login") ||
          text.includes("log in") ||
          text.includes("password") ||
          text.includes("account") ||
          text.includes("access")
        ) {
          category = "Account";
        } else if (
          text.includes("error") ||
          text.includes("bug") ||
          text.includes("technical") ||
          text.includes("not working") ||
          text.includes("website") ||
          text.includes("system")
        ) {
          category = "Technical";
        }

        analysis = {
          category: category,
          priority: calculatePriority(subject, body, ""),
          summary: subject || "Customer support request",
          sentiment: "Neutral",
          suggestedResponse:
            "Thank you for contacting support. We have received your request and will review it shortly.",
          isTicket: true
        };

        console.log(
          `Fallback result: ${JSON.stringify(analysis)}`
        );
      }

      const calculatedPriority =
        calculatePriority(
          subject,
          body,
          analysis?.sentiment || ""
        );

      analysis.priority =
        calculatedPriority;

      const messageData = {
        gmailMessageId: message.id,
        gmailThreadId: message.threadId || "",
        userId,
        sender,
        subject,
        body,
        receivedAt: date
          ? new Date(date)
          : new Date(),

        category:
          analysis.category,

        priority:
          analysis.priority,

        summary:
          analysis.summary,

        sentiment:
          analysis.sentiment,

        suggestedResponse:
          analysis.suggestedResponse,

        isTicket:
          analysis.isTicket,

        status: "Open",
      };

      const savedMessage =
        mongoose.connection.readyState === 1
          ? await Message.findOneAndUpdate(
              {
                gmailMessageId: message.id,
                userId,
              },
              messageData,
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
              }
            )
          : saveMemoryMessage(
              userId.toString(),
              message.id,
              messageData
            );

      results.push(savedMessage);

      console.log(
        `Ticket saved: ${savedMessage._id}`
      );

    } catch (error) {
      console.error(
        `Failed to process Gmail message ${gmailMessage.id}:`,
        error.message
      );
    }
  }

  return results;
}










