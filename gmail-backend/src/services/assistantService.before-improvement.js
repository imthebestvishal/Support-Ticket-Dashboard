import { Message } from "../models/message.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

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
          maxOutputTokens: 1000,
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

  return text.trim();
}

export async function askAssistant(userId, question) {
  const messages = await Message.find({
    userId,
  })
    .sort({
      receivedAt: -1,
    })
    .limit(30)
    .lean();

  const ticketContext = messages.length
    ? messages
        .map((message, index) => {
          return `
Ticket ${index + 1}
ID: ${message._id}
From: ${message.sender || "Unknown"}
Subject: ${message.subject || "No subject"}
Category: ${message.category || "Other"}
Priority: ${message.priority || "Medium"}
Status: ${message.status || "Open"}
Sentiment: ${message.sentiment || "Neutral"}
Summary: ${message.summary || "No summary"}
Customer Email Body:
${message.body || "No body"}
Suggested Response:
${message.suggestedResponse || "No suggested response"}
`;
        })
        .join("\n-------------------------\n")
    : "No support tickets are currently available.";

  const prompt = `
You are an intelligent AI Support Assistant inside a customer-support dashboard.

Your job is to help the support agent understand and manage customer support tickets.

You have access to the support tickets stored in the database.

IMPORTANT RULES:

1. Answer using the ticket information provided below.
2. Do not invent tickets, customers, dates, statuses, or facts.
3. If the requested information is not available, clearly say that it is not available.
4. Give concise but useful answers.
5. If the user asks for a response to a customer, write a professional and polite customer-facing response.
6. If the user asks about urgent/high-priority tickets, identify them from the ticket data.
7. If the user asks for a summary, summarize the relevant tickets.
8. If the user asks about ticket counts, calculate them from the provided tickets.
9. Never expose the Gemini API key or other secrets.
10. You are assisting a support agent, not pretending to be the customer.

CURRENT SUPPORT TICKETS:

${ticketContext}

SUPPORT AGENT QUESTION:

${question}

Provide the best possible answer.
`;

  const answer = await askGemini(prompt);

  return {
    answer,
    ticketCount: messages.length,
  };
}
