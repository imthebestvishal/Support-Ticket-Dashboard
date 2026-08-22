import {
  callProviderStackText,
  getAIProviderStatus,
  probeGroq,
} from "./aiProviderService.js";

function assistantSystemPrompt() {
  return `You are an AI support assistant for SentiMail, a customer email and support ticket dashboard.

Help the support agent with ticket summaries, reply suggestions,
troubleshooting steps, customer support workflows, Gmail analysis,
calendar follow-up planning, and concise decisions.
Answer directly and professionally.`;
}

function localFallbackAnswer(question = "") {
  const lower = question.toLowerCase();

  if (lower.includes("ticket") || lower.includes("email")) {
    return "I can help with ticket summaries, reply drafts, priority review, and follow-up planning. The external AI providers are unavailable right now, so this is a local fallback answer.";
  }

  if (lower.includes("calendar") || lower.includes("deadline")) {
    return "Calendar actions need a detected date or deadline and a connected Google account with Calendar permission. The external AI providers are unavailable right now, so this is a local fallback answer.";
  }

  return "The external AI providers are unavailable right now, so I am using a local fallback. Please try again after checking the Groq and OpenRouter configuration.";
}

export async function getAssistantStatus({ probe = false } = {}) {
  const status = getAIProviderStatus();

  if (!probe) {
    return status;
  }

  return {
    ...status,
    probe: await probeGroq(),
  };
}

export async function askAssistant(question) {
  try {
    const result = await callProviderStackText(
      [
        {
          role: "system",
          content: assistantSystemPrompt(),
        },
        {
          role: "user",
          content: question,
        },
      ],
      {
        temperature: 0.2,
      }
    );

    return {
      answer: result.text,
      source: result.source,
      provider: result.provider,
      model: result.model,
      providerError: result.providerError || "",
    };
  } catch (error) {
    return {
      answer: localFallbackAnswer(question),
      source: "fallback",
      provider: "Local fallback",
      model: "local",
      providerError: error.providerError || error.message,
    };
  }
}
