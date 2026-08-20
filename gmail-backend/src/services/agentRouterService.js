const DEFAULT_AGENT_ROUTER_MODEL = "gpt-5.5";
const DEFAULT_AGENT_ROUTER_BASE_URL = "https://co.agentrouter.org/v1";
const LAST_PROVIDER_STATUS = {
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

function getAgentRouterBaseUrl() {
  const configuredBaseUrl = (
    process.env.AGENT_ROUTER_BASE_URL ||
    DEFAULT_AGENT_ROUTER_BASE_URL
  ).replace(/\/+$/, "");

  if (configuredBaseUrl === "https://agentrouter.org/v1") {
    return DEFAULT_AGENT_ROUTER_BASE_URL;
  }

  return configuredBaseUrl;
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

  return {
    configured: Boolean(isAgentRouterConfigured()),
    model: getAgentRouterModel(),
    baseUrl: getAgentRouterBaseUrl(),
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    lastProviderStatus: {
      ...LAST_PROVIDER_STATUS,
    },
  };
}

function rememberProviderStatus({ response, error = "" }) {
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

  const response = await fetch(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SupportHub/1.0",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "SupportHub",
      },
      body: JSON.stringify({
        model,
        messages,
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
    const providerDetails = `HTTP ${response.status}; content-type: ${
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

    if (
      response.status === 405 ||
      contentType.includes("text/html")
    ) {
      throw new Error(
        `AgentRouter rejected the request. Check the token, model "${model}", and base URL "${baseUrl}". ${providerDetails}`
      );
    }

    throw new Error(
      `AgentRouter API error. ${providerDetails}`
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const errorText = cleanErrorText(await response.text(), contentType);
    const providerDetails = `HTTP ${response.status}; content-type: ${
      contentType || "unknown"
    }; details: ${errorText}`;

    rememberProviderStatus({
      response,
      error: providerDetails,
    });

    throw new Error(
      `AgentRouter returned a non-JSON response. Check the token, model "${model}", and base URL "${baseUrl}". ${providerDetails}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("AgentRouter returned an empty response");
  }

  rememberProviderStatus({
    response,
  });

  return text;
}

export async function askAgentRouter(options) {
  return requestAgentRouter(options);
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
