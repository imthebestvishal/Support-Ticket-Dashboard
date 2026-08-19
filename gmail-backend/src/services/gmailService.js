import { google } from "googleapis";
import { User } from "../models/user.js";
import mongoose from "mongoose";
import { Message } from "../models/message.js";
import {
  getMemoryUser,
  saveMemoryMessage,
} from "./memoryStore.js";
import { askAgentRouter } from "./agentRouterService.js";

const VALID_CATEGORIES = [
  "Technical",
  "Account",
  "Billing",
  "Finance",
  "Personal",
  "Promotions",
  "Social",
  "Education",
  "Job/Career",
  "Security",
  "General",
  "Other",
];

const VALID_PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Urgent",
];

const VALID_SENTIMENTS = [
  "Positive",
  "Neutral",
  "Negative",
];

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

function normalizedValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function fallbackCategory(text) {
  if (
    text.includes("hack") ||
    text.includes("fraud") ||
    text.includes("unauthorized") ||
    text.includes("security") ||
    text.includes("password")
  ) {
    return "Security";
  }

  if (
    text.includes("bank") ||
    text.includes("transaction") ||
    text.includes("investment") ||
    text.includes("portfolio") ||
    text.includes("card")
  ) {
    return "Finance";
  }

  if (
    text.includes("bill") ||
    text.includes("invoice") ||
    text.includes("payment") ||
    text.includes("refund") ||
    text.includes("charged")
  ) {
    return "Billing";
  }

  if (
    text.includes("login") ||
    text.includes("account") ||
    text.includes("access")
  ) {
    return "Account";
  }

  if (
    text.includes("error") ||
    text.includes("bug") ||
    text.includes("technical") ||
    text.includes("not working") ||
    text.includes("server") ||
    text.includes("system")
  ) {
    return "Technical";
  }

  if (
    text.includes("linkedin") ||
    text.includes("twitter") ||
    text.includes("github") ||
    text.includes("social")
  ) {
    return "Social";
  }

  if (
    text.includes("course") ||
    text.includes("class") ||
    text.includes("university") ||
    text.includes("school") ||
    text.includes("exam")
  ) {
    return "Education";
  }

  if (
    text.includes("job") ||
    text.includes("interview") ||
    text.includes("resume") ||
    text.includes("career") ||
    text.includes("application")
  ) {
    return "Job/Career";
  }

  if (
    text.includes("offer") ||
    text.includes("deal") ||
    text.includes("promo") ||
    text.includes("sale") ||
    text.includes("discount")
  ) {
    return "Promotions";
  }

  if (
    text.includes("meet") ||
    text.includes("family") ||
    text.includes("friend") ||
    text.includes("birthday")
  ) {
    return "Personal";
  }

  return "General";
}

function fallbackPriority(text) {
  if (
    text.includes("urgent") ||
    text.includes("critical") ||
    text.includes("emergency") ||
    text.includes("fraud") ||
    text.includes("unauthorized") ||
    text.includes("security breach")
  ) {
    return "Urgent";
  }

  if (
    text.includes("asap") ||
    text.includes("locked") ||
    text.includes("cannot access") ||
    text.includes("charged twice") ||
    text.includes("not working")
  ) {
    return "High";
  }

  if (
    text.includes("issue") ||
    text.includes("problem") ||
    text.includes("refund") ||
    text.includes("billing") ||
    text.includes("help")
  ) {
    return "Medium";
  }

  return "Low";
}

const GMAIL_FETCH_LIMIT = Number(
  process.env.GMAIL_FETCH_LIMIT || 25
);

async function analyzeMessage(subject, body, sender) {
  const prompt = `
You are an expert email triage and support-ticket classifier.

Analyze the following email and decide whether it should become an actionable ticket.

Email:
From: ${sender}
Subject: ${subject}
Body:
${body}

Return ONLY valid JSON in exactly this format:

{
  "category": "Technical",
  "priority": "Medium",
  "summary": "Short specific summary of the email",
  "sentiment": "Neutral",
  "suggestedResponse": "Natural professional reply specific to this email",
  "isTicket": true,
  "classificationReason": "One short reason for category and priority"
}

Rules:

category must be exactly one of:
Technical, Account, Billing, Finance, Personal, Promotions, Social, Education, Job/Career, Security, General, Other

Category definitions:
- Technical: app, website, software, hardware, bugs, errors, outages, broken flows.
- Account: login, profile, credentials, access, account settings, subscription access.
- Billing: invoices, refunds, charges, payment support, plan billing, receipts.
- Finance: bank/card alerts, transactions, investments, portfolio, financial account activity.
- Personal: personal notes, informal messages, friends/family, non-business conversation.
- Promotions: offers, ads, deals, newsletters, campaigns, discounts, marketing.
- Social: social network notifications, follows, messages, community updates.
- Education: school, course, university, exam, assignment, learning content.
- Job/Career: job applications, recruiters, interviews, resumes, hiring, career updates.
- Security: fraud, unauthorized access, password compromise, suspicious activity, account safety.
- General: actionable/support-like but not covered above.
- Other: non-actionable or unclear.

priority must be exactly one of:
Low, Medium, High, Urgent

Priority definitions:
- Urgent: active security/fraud, outage, money loss, legal threat, immediate deadline, or critical access loss.
- High: blocked user, serious account/payment/product issue, strong negative impact, needs quick human attention.
- Medium: normal support request, question, issue, refund/billing request without immediate risk.
- Low: informational, FYI, promotion, newsletter, social update, personal note, no clear support urgency.

sentiment must be exactly one of:
Positive, Neutral, Negative

isTicket must be true if the email contains a request, complaint, support question, account/billing/technical/finance/security issue, or any action that requires attention.
isTicket may be false for pure newsletters, promotions, social notifications, receipts that need no action, and personal FYI emails.

Keep summary short but specific. Avoid generic summaries.
The suggestedResponse must sound human and natural, not a repeated template.
Do not say "we have received your request and will review it shortly" unless there are no useful details.
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
      category: normalizedValue(
        parsed.category,
        VALID_CATEGORIES,
        "Other"
      ),
      priority: normalizedValue(
        parsed.priority,
        VALID_PRIORITIES,
        "Medium"
      ),
      summary: parsed.summary || "No summary available",
      sentiment: normalizedValue(
        parsed.sentiment,
        VALID_SENTIMENTS,
        "Neutral"
      ),
      suggestedResponse:
        parsed.suggestedResponse ||
        "",
      classificationReason:
        parsed.classificationReason || "",
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
    const fallbackText =
      `${subject} ${body}`.toLowerCase();

    return {
      category: fallbackCategory(fallbackText),
      priority: fallbackPriority(fallbackText),
      summary: subject || text.substring(0, 500),
      sentiment: "Neutral",
      suggestedResponse: "",
      classificationReason:
        "Fallback classification used because AgentRouter returned invalid JSON.",
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
  const subject = message.subject || issue;

  if (category === "Personal") {
    return `Hi,

Thanks for your message about "${subject}".

I saw your note: ${issue}

I'll take a closer look and get back to you with a proper update.

Best regards,
Support Team`;
  }

  if (category === "Finance" || category === "Billing") {
    return `Hi,

Thanks for reaching out about "${subject}".

I understand this relates to ${category.toLowerCase()}, specifically: ${issue}

We'll review the details carefully and follow up with the next appropriate step.

Best regards,
Support Team`;
  }

  if (category === "Security") {
    return `Hi,

Thanks for flagging this.

We understand your concern about "${subject}". Based on the details available, the issue is: ${issue}

Please avoid sharing any passwords or sensitive information in email while this is being reviewed.

Best regards,
Support Team`;
  }

  if (category === "Promotions" || category === "Social") {
    return `Hi,

Thanks for the update about "${subject}".

We've noted the details: ${issue}

Best regards,
Support Team`;
  }

  return `Hi,

Thanks for reaching out about "${subject}".

I understand the main issue is: ${issue}

We'll review this and follow up with the next best step.

Best regards,
Support Team`;
}

export async function generateReplyDraft(message) {
  const fallback = buildFallbackReply(message);

  try {
    const draft = await askAgentRouter({
      messages: [
        {
          role: "system",
          content:
            "You write natural, professional email replies. Return only the email body, with no markdown and no subject line. Every draft must be specific to this exact email and should avoid sounding like a reusable support template.",
        },
        {
          role: "user",
          content: `
Draft a natural reply to this email.

Customer: ${message.sender || "Unknown"}
Subject: ${message.subject || "No subject"}
Priority: ${message.priority || "Medium"}
Category: ${message.category || "Other"}
Summary: ${message.summary || "No summary available"}

Original email:
${message.body || "No original body available"}

Suggested response:
${message.suggestedResponse || "No prior suggested response"}

Requirements:
- Use a natural professional tone.
- Mention the specific concern from the subject, summary, or body.
- Vary the wording; do not use the same structure for every email.
- Avoid generic lines like "we have received your request and will review it shortly."
- Do not promise actions that are not stated.
- Keep it concise and ready for a human agent to edit/send.
`,
        },
      ],
      temperature: 0.55,
      maxTokens: 700,
    });

    return {
      draft,
      source: "agentrouter",
    };
  } catch (error) {
    console.warn(
      "AgentRouter reply draft unavailable.",
      error.message
    );

    return {
      draft: fallback,
      source: "fallback",
      providerError: error.message,
    };
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

        analysis = {
          category: fallbackCategory(text),
          priority: fallbackPriority(text),
          summary: subject || "Customer support request",
          sentiment: "Neutral",
          suggestedResponse: "",
          classificationReason:
            "Fallback classification used because AgentRouter analysis failed.",
          isTicket: true
        };

        console.log(
          `Fallback result: ${JSON.stringify(analysis)}`
        );
      }

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

        classificationReason:
          analysis.classificationReason || "",

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










