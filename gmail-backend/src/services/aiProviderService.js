const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
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

export async function readProviderError(response) {
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

export function groqConfig() {
  const token = process.env.GROQ_API_KEY || "";

  return {
    token,
    configured: !isPlaceholderToken(token),
    model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    baseUrl: cleanBaseUrl(process.env.GROQ_BASE_URL, DEFAULT_GROQ_BASE_URL),
  };
}

export function openRouterConfig() {
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

function providerStatus(config) {
  return {
    configured: config.configured,
    model: config.model,
    baseUrl: config.baseUrl,
    tokenPresent: Boolean(config.token),
    tokenLength: config.token.length,
  };
}

export function getAIProviderStatus() {
  const groq = groqConfig();
  const openRouter = openRouterConfig();

  return {
    groq: providerStatus(groq),
    openRouter: providerStatus(openRouter),
  };
}

async function callOpenAICompatible({
  providerName,
  source,
  config,
  messages,
  temperature = 0.2,
  maxTokens,
  json = false,
}) {
  if (!config.configured) {
    const error = new Error(`${providerName} API key is missing or still a placeholder.`);
    error.code = `${source.toUpperCase()}_NOT_CONFIGURED`;
    throw error;
  }

  const headers = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (source === "openrouter") {
    headers["HTTP-Referer"] = process.env.FRONTEND_URL || "http://localhost:5173";
    headers["X-Title"] = "SentiMail";
  }

  const body = {
    model: config.model,
    messages,
    temperature,
  };

  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  if (json) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await readProviderError(response);
    throw new Error(
      `${providerName} rejected the request. Check API key and model "${config.model}". HTTP ${response.status}; details: ${details}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${providerName} returned no assistant text.`);
  }

  return {
    text: text.trim(),
    source,
    provider: providerName,
    model: config.model,
  };
}

export async function callGroqText(messages, options = {}) {
  return callOpenAICompatible({
    providerName: "Groq",
    source: "groq",
    config: groqConfig(),
    messages,
    ...options,
  });
}

export async function callOpenRouterText(messages, options = {}) {
  return callOpenAICompatible({
    providerName: "OpenRouter",
    source: "openrouter",
    config: openRouterConfig(),
    messages,
    ...options,
  });
}

function extractJsonObject(text = "") {
  const clean = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    if (start !== -1 && end > start) {
      return JSON.parse(clean.slice(start, end + 1));
    }

    throw new Error("Provider returned invalid JSON.");
  }
}

export async function callProviderStackText(messages, options = {}) {
  const errors = [];

  try {
    return await callGroqText(messages, options);
  } catch (error) {
    errors.push(error.message);
    console.warn("Groq unavailable; trying OpenRouter fallback.", error.message);
  }

  try {
    const result = await callOpenRouterText(messages, options);

    return {
      ...result,
      providerError: errors[0] || "",
    };
  } catch (error) {
    errors.push(error.message);
    console.warn("OpenRouter unavailable.", error.message);
  }

  const fallbackError = new Error(errors.join(" | ") || "AI providers unavailable.");
  fallbackError.providerError = errors.join(" | ");
  throw fallbackError;
}

export async function callProviderStackJson(messages, options = {}) {
  const errors = [];

  try {
    const result = await callGroqText(messages, {
      ...options,
      json: true,
    });

    return {
      ...result,
      json: extractJsonObject(result.text),
    };
  } catch (error) {
    errors.push(error.message);
    console.warn("Groq JSON unavailable; trying OpenRouter fallback.", error.message);
  }

  try {
    const result = await callOpenRouterText(messages, {
      ...options,
      json: true,
    });

    return {
      ...result,
      providerError: errors[0] || "",
      json: extractJsonObject(result.text),
    };
  } catch (error) {
    errors.push(error.message);
    console.warn("OpenRouter JSON unavailable.", error.message);
  }

  const fallbackError = new Error(errors.join(" | ") || "AI JSON providers unavailable.");
  fallbackError.providerError = errors.join(" | ");
  throw fallbackError;
}

export async function probeGroq() {
  try {
    const result = await callGroqText(
      [
        {
          role: "user",
          content: "Say ok.",
        },
      ],
      {
        temperature: 0,
        maxTokens: 8,
      }
    );

    return {
      ok: true,
      provider: result.provider,
      source: result.source,
      model: result.model,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Groq",
      error: error.message,
    };
  }
}
