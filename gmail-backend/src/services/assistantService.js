const DEFAULT_AGENT_ROUTER_BASE_URL = "https://agentrouter.org/v1";
const DEFAULT_AGENT_ROUTER_MODEL = "gpt-5.5";
const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

function cleanBaseUrl(value, fallback) {
  const raw = String(value || "").trim();

  if (!raw) {
    return fallback;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`.replace(/\/+$/, "");
  }

  return raw.replace(/\/+$/, "");
}

function isPlaceholderToken(value = "") {
  const token = String(value || "").trim().toLowerCase();

  return (
    !token ||
    token.includes("your-") ||
    token.includes("xxxx") ||
    token === "placeholder"
  );
}

async function readProviderError(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  const trimmed = body.replace(/\s+/g, " ").trim().slice(0, 500);

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body);
      return (
        parsed?.error?.message ||
        parsed?.message ||
        parsed?.msg ||
        trimmed ||
        `HTTP ${response.status}`
      );
    } catch {
      return trimmed || `HTTP ${response.status}`;
    }
  }

  if (contentType.includes("text/html")) {
    return `HTTP ${response.status}; provider returned HTML instead of JSON`;
  }

  return trimmed || `HTTP ${response.status}`;
}

function assistantSystemPrompt() {
  return `You are an AI support assistant for a customer support dashboard.

Help the support agent with ticket summaries, reply suggestions,
troubleshooting steps, customer support workflows, and concise decisions.
Answer directly and professionally.`;
}

function localFallbackAnswer(question = "") {
  const lower = question.toLowerCase();

  if (lower.includes("ticket") || lower.includes("email")) {
    return "I can help with ticket summaries, reply drafts, priority review, and follow-up planning. The external AI provider is unavailable right now, so this is a local fallback answer.";
  }

  if (lower.includes("calendar") || lower.includes("deadline")) {
    return "Calendar actions need a detected date or deadline and a connected Google account with Calendar permission. The external AI provider is unavailable right now, so this is a local fallback answer.";
  }

  return "The external AI provider is unavailable right now, so I am using a local fallback. Please try again after checking the provider configuration.";
}

function agentRouterConfig() {
  const token = process.env.AGENT_ROUTER_TOKEN || "";

  return {
    token,
    configured: !isPlaceholderToken(token),
    model: process.env.AGENT_ROUTER_MODEL || DEFAULT_AGENT_ROUTER_MODEL,
    baseUrl: cleanBaseUrl(
      process.env.AGENT_ROUTER_BASE_URL,
      DEFAULT_AGENT_ROUTER_BASE_URL
    ),
    wireApi: (process.env.AGENT_ROUTER_WIRE_API || "responses").toLowerCase(),
  };
}

function openRouterConfig() {
  const token = process.env.OPENROUTER_API_KEY || "";

  return {
    token,
    configured: !isPlaceholderToken(token),
    model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
    baseUrl: cleanBaseUrl(
      process.env.OPENROUTER_BASE_URL,
      DEFAULT_OPENROUTER_BASE_URL
    ),
  };
}

async function callAgentRouter(question) {
  const config = agentRouterConfig();

  if (!config.configured) {
    const error = new Error("AgentRouter token is missing or still a placeholder.");
    error.code = "AGENT_ROUTER_NOT_CONFIGURED";
    throw error;
  }

  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const url =
    config.wireApi === "chat"
      ? `${config.baseUrl}/chat/completions`
      : `${config.baseUrl}/responses`;

  const body =
    config.wireApi === "chat"
      ? {
          model: config.model,
          messages: [
            {
              role: "system",
              content: assistantSystemPrompt(),
            },
            {
              role: "user",
              content: question,
            },
          ],
          temperature: 0.2,
        }
      : {
          model: config.model,
          input: [
            {
              role: "system",
              content: assistantSystemPrompt(),
            },
            {
              role: "user",
              content: question,
            },
          ],
          temperature: 0.2,
        };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await readProviderError(response);
    throw new Error(
      `AgentRouter rejected the request. Check token, model "${config.model}", base URL "${config.baseUrl}", and wire API "${config.wireApi}". HTTP ${response.status}; details: ${details}`
    );
  }

  const data = await response.json();
  const answer =
    data?.output_text ||
    data?.choices?.[0]?.message?.content ||
    data?.output?.[0]?.content?.[0]?.text ||
    data?.content?.[0]?.text;

  if (!answer) {
    throw new Error("AgentRouter returned no assistant text.");
  }

  return {
    answer,
    source: "agentrouter",
    provider: "AgentRouter",
    model: config.model,
  };
}

async function callOpenRouter(question) {
  const config = openRouterConfig();

  if (!config.configured) {
    const error = new Error("OpenRouter token is missing or still a placeholder.");
    error.code = "OPENROUTER_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
      "X-Title": "Support Ticket Dashboard",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: assistantSystemPrompt(),
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const details = await readProviderError(response);
    throw new Error(
      `OpenRouter rejected the request. Check token/model "${config.model}". HTTP ${response.status}; details: ${details}`
    );
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content;

  if (!answer) {
    throw new Error("OpenRouter returned no assistant text.");
  }

  return {
    answer,
    source: "openrouter",
    provider: "OpenRouter",
    model: config.model,
  };
}

export function getAssistantStatus() {
  const agentRouter = agentRouterConfig();
  const openRouter = openRouterConfig();

  return {
    agentRouter: {
      configured: agentRouter.configured,
      model: agentRouter.model,
      baseUrl: agentRouter.baseUrl,
      wireApi: agentRouter.wireApi,
      tokenPresent: Boolean(agentRouter.token),
      tokenLength: agentRouter.token.length,
    },
    openRouter: {
      configured: openRouter.configured,
      model: openRouter.model,
      baseUrl: openRouter.baseUrl,
      tokenPresent: Boolean(openRouter.token),
      tokenLength: openRouter.token.length,
    },
  };
}

export async function askAssistant(question) {
  const errors = [];

  try {
    return await callAgentRouter(question);
  } catch (error) {
    errors.push(error.message);
    console.warn("AgentRouter unavailable; trying OpenRouter fallback.", error.message);
  }

  try {
    const result = await callOpenRouter(question);

    return {
      ...result,
      providerError: errors[0] || "",
    };
  } catch (error) {
    errors.push(error.message);
    console.warn("OpenRouter unavailable; using local fallback.", error.message);
  }

  return {
    answer: localFallbackAnswer(question),
    source: "fallback",
    provider: "Local fallback",
    model: "local",
    providerError: errors.join(" | "),
  };
}
