import { google } from "googleapis";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import { extractDeadline } from "./ticketIntelligenceService.js";
import { createCalendarDeadline } from "./calendarService.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function analyzeMessage(subject, body, sender) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Gemini API error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

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
      "Gemini returned invalid JSON:",
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

/*
|--------------------------------------------------------------------------
| Fetch unread Gmail messages and create tickets
|--------------------------------------------------------------------------
*/

export async function fetchAndAnalyzeMessages(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.accessToken && !user.refreshToken) {
    throw new Error(
      "Gmail account is not authenticated"
    );
  }

  const gmail = await getGmailClient(user);

  const listResponse =
    await gmail.users.messages.list({
      userId: "me",
      q: "is:unread newer_than:1d",
      maxResults: 3,
    });

  const gmailMessages =
    listResponse.data.messages || [];

  console.log(
    `Gmail returned ${gmailMessages.length} unread messages`
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

      const analysis =
        await analyzeMessage(
          subject,
          body,
          sender
        );

      console.log(
        `AI result: ${JSON.stringify(analysis)}`
      );

      const deadlineAI = await extractDeadline(
        `${subject || ""} ${body || ""}`
      );

      console.log(
        "AI Deadline Result:",
        deadlineAI
      );

      let calendarResult = null;

      if (deadlineAI.deadline) {

        calendarResult = await createCalendarDeadline({

          accessToken:
            user.accessToken,

          refreshToken:
            user.refreshToken,

          subject,

          deadline:
            deadlineAI.deadline,

          reason:
            deadlineAI.deadlineReason,

        });

        if (calendarResult.success) {
          console.log(
            "Google Calendar deadline created:",
            calendarResult.id
          );
        } else {
          console.error(
            "Google Calendar deadline failed:",
            calendarResult.error
          );
        }
      }

      const savedMessage =
        await Message.findOneAndUpdate(
          {
            gmailMessageId: message.id,
            userId,
          },
          {
            gmailMessageId: message.id,
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

            deadline:
              deadlineAI.deadline,

            deadlineReason:
              deadlineAI.deadlineReason,

            deadlineStatus:
              deadlineAI.deadlineStatus,

            ...(calendarResult
              ? {
                  calendarEventId:
                    calendarResult.success ? calendarResult.id : null,
                  calendarEventLink:
                    calendarResult.success ? calendarResult.htmlLink : null,
                  calendarEventStatus:
                    calendarResult.status,
                  calendarEventError:
                    calendarResult.success ? "" : calendarResult.error || "",
                  calendarEventCreatedAt:
                    calendarResult.success ? new Date() : null,
                }
              : {}),

            status: "Open",
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
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

/*
|--------------------------------------------------------------------------
| Send Gmail reply for an existing ticket/message
|--------------------------------------------------------------------------
*/

export async function sendGmailReply(userId, ticketOrMessage, replyText) {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (!user.accessToken && !user.refreshToken) {
    const error = new Error("Gmail account is not authenticated");
    error.statusCode = 401;
    throw error;
  }

  const gmail = await getGmailClient(user);

  let originalThreadId = null;
  let originalMessageIdHeader = null;
  let originalSubject = ticketOrMessage.subject || "";
  let recipient = ticketOrMessage.sender || "";

  // Attempt to fetch original message metadata from Gmail for threading & headers
  if (ticketOrMessage.gmailMessageId) {
    try {
      const origRes = await gmail.users.messages.get({
        userId: "me",
        id: ticketOrMessage.gmailMessageId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "Subject", "From", "To", "References"],
      });

      if (origRes.data) {
        originalThreadId = origRes.data.threadId || null;
        const headers = origRes.data.payload?.headers || [];
        originalMessageIdHeader = getHeader(headers, "Message-ID");
        const headerSubject = getHeader(headers, "Subject");
        if (headerSubject) {
          originalSubject = headerSubject;
        }
        const headerFrom = getHeader(headers, "From");
        if (headerFrom) {
          recipient = headerFrom;
        }
      }
    } catch (metadataError) {
      console.warn(
        "Could not fetch metadata for original Gmail message, proceeding with stored details:",
        metadataError.message
      );
    }
  }

  if (!recipient) {
    const error = new Error("No recipient email address found for this ticket");
    error.statusCode = 400;
    throw error;
  }

  const replySubject = /^re:\s*/i.test(originalSubject)
    ? originalSubject
    : `Re: ${originalSubject || "Support Ticket"}`;

  const emailLines = [];
  emailLines.push(`To: ${recipient}`);
  emailLines.push(`From: ${user.email}`);
  emailLines.push(`Subject: ${replySubject}`);

  if (originalMessageIdHeader) {
    emailLines.push(`In-Reply-To: ${originalMessageIdHeader}`);
    emailLines.push(`References: ${originalMessageIdHeader}`);
  }

  emailLines.push("MIME-Version: 1.0");
  emailLines.push("Content-Type: text/plain; charset=UTF-8");
  emailLines.push("Content-Transfer-Encoding: 7bit");
  emailLines.push("");
  emailLines.push(replyText);

  const emailRaw = emailLines.join("\r\n");
  const encodedRaw = Buffer.from(emailRaw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const requestBody = {
    raw: encodedRaw,
  };

  if (originalThreadId) {
    requestBody.threadId = originalThreadId;
  }

  try {
    const sendResponse = await gmail.users.messages.send({
      userId: "me",
      requestBody,
    });

    console.log(`Gmail reply sent successfully: id=${sendResponse.data?.id}`);
    return sendResponse.data;
  } catch (error) {
    console.error("Gmail send error:", error.message);

    const isScopeError =
      error.status === 403 ||
      error.code === 403 ||
      error.message?.includes("insufficient") ||
      error.message?.includes("scope") ||
      error.message?.includes("PERMISSION_DENIED");

    if (isScopeError) {
      const scopeError = new Error(
        "Gmail send permission is missing. Please reconnect your Gmail account to grant send access."
      );
      scopeError.statusCode = 403;
      throw scopeError;
    }

    if (error.status === 401 || error.code === 401) {
      const authError = new Error(
        "Gmail authentication has expired. Please reconnect your Gmail account."
      );
      authError.statusCode = 401;
      throw authError;
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Refine Support Reply with Gemini
|--------------------------------------------------------------------------
*/

export async function refineSupportReply({
  replyText,
  tone,
  subject,
  customerMessage,
  kbSnippet,
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  let toneInstruction = "Improve and polish this support reply for clarity and helpfulness.";
  if (tone === "formal") {
    toneInstruction = "Rewrite this customer support email to be highly professional, formal, respectful, and polished.";
  } else if (tone === "friendly") {
    toneInstruction = "Rewrite this customer support email to be warm, empathetic, approachable, friendly, and supportive.";
  } else if (tone === "shorten") {
    toneInstruction = "Shorten and condense this support email to be concise, clear, and direct without losing key solutions.";
  } else if (tone === "simplify") {
    toneInstruction = "Simplify this support email using plain, clear language and easy-to-follow steps.";
  } else if (tone === "include_kb" && kbSnippet) {
    toneInstruction = `Seamlessly incorporate the following verified knowledge base article snippet into the response:\n${kbSnippet}`;
  }

  const prompt = `
You are an expert customer support agent.
Customer Subject: ${subject || "Support Inquiry"}
Customer Message: ${customerMessage || "N/A"}
Current Draft Reply:
${replyText}

Instruction:
${toneInstruction}

Return ONLY the rewritten response text. Do not wrap in markdown quotes or code blocks.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text.trim();
}






