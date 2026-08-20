const DEFAULT_AGENT_ROUTER_MODEL = "gpt-5.5";
const DEFAULT_AGENT_ROUTER_BASE_URL = "https://agentrouter.org/v1";
const AGENT_ROUTER_CHAT_BASE_URL = "https://co.agentrouter.org/v1";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const LAST_PROVIDER_STATUS = {
  provider: "",
  model: "",
  httpStatus: null,
  contentType: "",
  error: "",
  checkedAt: "",
};

function isPlaceholderToken(token) {
  return (
    !token ||
    token.startsWith("your-") ||
    token.includes("replace") ||
    token.includes("<") ||
    token.length <= 25
  );
}

function cleanHtmlText(text) {
  const blockMessage = text.match(/"block_message":"([^"]+)"/);

  if (blockMessage?.[1]) {
    return blockMessage[1];
  }

  const title = text.match(/<title[^>]*>(.*?)<\/title>/is);

  if (title?.[1]) {
    return title[1].replace(/\s+/g, " ").trim();
  }

  return "AgentRouter returned an HTML page instead of JSON.";
}

function truncateErrorText(text) {
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function cleanErrorText(text, contentType = "") {
  if (!text) {
    return "";
  }

  if (
    contentType.includes("text/html") ||
    text.trim().startsWith("<")
  ) {
    return cleanHtmlText(text);
  }

  try {
    const data = JSON.parse(text);
    return (
      data?.error?.message ||
      data?.message ||
      text
    );
  } catch {
    return truncateErrorText(text);
  }
}

function getAgentRouterToken() {
  return process.env.AGENT_ROUTER_TOKEN || "";
}

function getOpenRouterToken() {
  return process.env.OPENROUTER_API_KEY || "";
}

function getOpenRouterModel() {
  const configuredModel =
    process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

  return configuredModel === "openrouter/free"
    ? DEFAULT_OPENROUTER_MODEL
    : configuredModel;
}

function getAgentRouterBaseUrl() {
  const rawBaseUrl = (
    process.env.AGENT_ROUTER_BASE_URL ||
    DEFAULT_AGENT_ROUTER_BASE_URL
  ).trim();
  const configuredBaseUrl = rawBaseUrl
    .replace(/^\/\//, "https://")
    .replace(/\/+$/, "");

  if (
    configuredBaseUrl === "http://agentrouter.org/v1" ||
    configuredBaseUrl === "agentrouter.org/v1"
  ) {
    return DEFAULT_AGENT_ROUTER_BASE_URL;
  }

  if (configuredBaseUrl === "co.agentrouter.org/v1") {
    return AGENT_ROUTER_CHAT_BASE_URL;
  }

  if (!/^https?:\/\//i.test(configuredBaseUrl)) {
    return `https://${configuredBaseUrl}`;
  }

  return configuredBaseUrl;
}

function getAgentRouterWireApi() {
  const value = (
    process.env.AGENT_ROUTER_WIRE_API || "auto"
  ).toLowerCase();

  return ["auto", "responses", "chat"].includes(value)
    ? value
    : "auto";
}

function toResponseInput(messages) {
  return messages.map((message) => ({
    role: message.role === "system" ? "developer" : message.role,
    content: [
      {
        type: "input_text",
        text: message.content || "",
      },
    ],
  }));
}

function toChatMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content || "",
  }));
}

function extractResponseText(data) {
  if (data?.output_text?.trim()) {
    return data.output_text.trim();
  }

  const parts = data?.output
    ?.flatMap((item) => item?.content || [])
    ?.map((content) => content?.text || "")
    ?.filter(Boolean);

  return parts?.join("\n").trim() || "";
}

function extractChatText(data) {
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

export function isAgentRouterConfigured() {
  return !isPlaceholderToken(getAgentRouterToken());
}

export function getAgentRouterModel() {
  const configuredModel = (
    process.env.AGENT_ROUTER_MODEL ||
    DEFAULT_AGENT_ROUTER_MODEL
  );

  if (configuredModel === "agentrouter/gpt-5") {
    return DEFAULT_AGENT_ROUTER_MODEL;
  }

  return configuredModel;
}

export function getAgentRouterStatus() {
  const token = getAgentRouterToken();
  const openRouterToken = getOpenRouterToken();

  return {
    configured: Boolean(isAgentRouterConfigured()),
    model: getAgentRouterModel(),
    baseUrl: getAgentRouterBaseUrl(),
    wireApi: getAgentRouterWireApi(),
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    openRouterConfigured: !isPlaceholderToken(openRouterToken),
    openRouterModel: getOpenRouterModel(),
    lastProviderStatus: {
      ...LAST_PROVIDER_STATUS,
    },
  };
}

function buildRequests({
  baseUrl,
  model,
  messages,
  temperature,
  maxTokens,
  json,
}) {
  const responseRequest = {
    wireApi: "responses",
    url: `${baseUrl}/responses`,
    body: {
      model,
      input: toResponseInput(messages),
      temperature,
      max_output_tokens: maxTokens,
      ...(json
        ? {
            text: {
              format: {
                type: "json_object",
              },
            },
          }
        : {}),
    },
    extractText: extractResponseText,
  };
  const chatBaseUrl =
    baseUrl === DEFAULT_AGENT_ROUTER_BASE_URL
      ? AGENT_ROUTER_CHAT_BASE_URL
      : baseUrl;
  const chatRequest = {
    wireApi: "chat",
    url: `${chatBaseUrl}/chat/completions`,
    body: {
      model,
      messages: toChatMessages(messages),
      temperature,
      max_tokens: maxTokens,
      ...(json
        ? {
            response_format: {
              type: "json_object",
            },
          }
        : {}),
    },
    extractText: extractChatText,
  };
  const wireApi = getAgentRouterWireApi();

  if (wireApi === "responses") {
    return [responseRequest, chatRequest];
  }

  if (wireApi === "chat") {
    return [chatRequest, responseRequest];
  }

  return baseUrl === AGENT_ROUTER_CHAT_BASE_URL
    ? [chatRequest, responseRequest]
    : [responseRequest, chatRequest];
}

function rememberProviderStatus({
  response,
  error = "",
  provider = "agentrouter",
  model = "",
}) {
  LAST_PROVIDER_STATUS.provider = provider;
  LAST_PROVIDER_STATUS.model = model;
  LAST_PROVIDER_STATUS.httpStatus = response?.status || null;
  LAST_PROVIDER_STATUS.contentType =
    response?.headers?.get("content-type") || "";
  LAST_PROVIDER_STATUS.error = error;
  LAST_PROVIDER_STATUS.checkedAt = new Date().toISOString();
}

async function requestAgentRouter({
  messages,
  temperature = 0.2,
  maxTokens = 1200,
  json = false,
}) {
  if (!isAgentRouterConfigured()) {
    throw new Error("AGENT_ROUTER_TOKEN is not configured");
  }

  const token = getAgentRouterToken();
  const model = getAgentRouterModel();
  const baseUrl = getAgentRouterBaseUrl();
  const requests = buildRequests({
    baseUrl,
    model,
    messages,
    temperature,
    maxTokens,
    json,
  });
  const errors = [];

  for (const request of requests) {
    const response = await fetch(request.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SupportHub/1.0",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "SupportHub",
      },
      body: JSON.stringify(request.body),
    });

    if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const errorText = cleanErrorText(await response.text(), contentType);
    const providerDetails = `${request.wireApi} ${request.url} returned HTTP ${response.status}; content-type: ${
      contentType || "unknown"
    }; details: ${errorText}`;

    rememberProviderStatus({
      response,
      error: providerDetails,
    });

    if (response.status === 429) {
      throw new Error(
        "AgentRouter rate limit was reached. Please try again later or switch models."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `AgentRouter token is invalid or does not have permission to use model "${model}". ${providerDetails}`
      );
    }

    errors.push(providerDetails);

    if (
      response.status === 405 ||
      contentType.includes("text/html")
    ) {
      continue;
    }

    continue;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const errorText = cleanErrorText(await response.text(), contentType);
    const providerDetails = `${request.wireApi} ${request.url} returned HTTP ${response.status}; content-type: ${
      contentType || "unknown"
    }; details: ${errorText}`;

    rememberProviderStatus({
      response,
      error: providerDetails,
    });

    errors.push(providerDetails);
    continue;
  }

  const data = await response.json();
  const text = request.extractText(data);

  if (!text) {
    const providerDetails = `${request.wireApi} ${request.url} returned an empty response`;

    rememberProviderStatus({
      response,
      error: providerDetails,
    });
    errors.push(providerDetails);
    continue;
  }

  rememberProviderStatus({
    response,
  });

  return text;
  }

  throw new Error(
    `AgentRouter rejected all supported request formats for model "${model}". ${errors.join(" | ")}`
  );
}

export async function askAgentRouter(options) {
  try {
    return await requestAgentRouter(options);
  } catch (error) {
    if (!isPlaceholderToken(getOpenRouterToken())) {
      console.warn(
        "AgentRouter unavailable; trying OpenRouter fallback.",
        error.message
      );

      return requestOpenRouter(options);
    }

    throw error;
  }
}

async function requestOpenRouter({
  messages,
  temperature = 0.2,
  maxTokens = 1200,
  json = false,
}) {
  const token = getOpenRouterToken();
  const model = getOpenRouterModel();
  const response = await fetch(
    `${OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "SupportHub",
      },
      body: JSON.stringify({
        model,
        messages: toChatMessages(messages),
        temperature,
        max_tokens: maxTokens,
        ...(json
          ? {
              response_format: {
                type: "json_object",
              },
            }
          : {}),
      }),
    }
  );

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const errorText = cleanErrorText(await response.text(), contentType);
    const providerDetails = `OpenRouter ${OPENROUTER_BASE_URL}/chat/completions returned HTTP ${response.status}; content-type: ${
      contentType || "unknown"
    }; details: ${errorText}`;

    rememberProviderStatus({
      response,
      error: providerDetails,
      provider: "openrouter",
      model,
    });

    throw new Error(providerDetails);
  }

  const data = await response.json();
  const text = extractChatText(data);

  if (!text) {
    rememberProviderStatus({
      response,
      error: "OpenRouter returned an empty response",
      provider: "openrouter",
      model,
    });

    throw new Error("OpenRouter returned an empty response");
  }

  rememberProviderStatus({
    response,
    provider: "openrouter",
    model,
  });

  return text;
}

export async function probeAgentRouter() {
  try {
    const text = await requestAgentRouter({
      messages: [
        {
          role: "user",
          content: "Say ok.",
        },
      ],
      temperature: 0,
      maxTokens: 8,
    });

    return {
      ok: true,
      model: getAgentRouterModel(),
      baseUrl: getAgentRouterBaseUrl(),
      sample: text.slice(0, 40),
      providerStatus: getAgentRouterStatus().lastProviderStatus,
    };
  } catch (error) {
    return {
      ok: false,
      model: getAgentRouterModel(),
      baseUrl: getAgentRouterBaseUrl(),
      error:
        error instanceof Error
          ? error.message
          : "AgentRouter probe failed",
      providerStatus: getAgentRouterStatus().lastProviderStatus,
    };
  }
}
