const AGENT_ROUTER_TOKEN = process.env.AGENT_ROUTER_TOKEN;
const AGENT_ROUTER_MODEL =
  process.env.AGENT_ROUTER_MODEL || "gpt-5";
const AGENT_ROUTER_BASE_URL =
  process.env.AGENT_ROUTER_BASE_URL ||
  "https://agentrouter.org/v1";

function cleanErrorText(text) {
  if (!text) {
    return "";
  }

  if (text.trim().startsWith("<")) {
    const blockMessage = text.match(/"block_message":"([^"]+)"/);

    if (blockMessage?.[1]) {
      return blockMessage[1];
    }

    return "AgentRouter returned an HTML error page instead of JSON.";
  }

  try {
    const data = JSON.parse(text);
    return (
      data?.error?.message ||
      data?.message ||
      text
    );
  } catch {
    return text;
  }
}

export function isAgentRouterConfigured() {
  return (
    AGENT_ROUTER_TOKEN &&
    !AGENT_ROUTER_TOKEN.startsWith("your-") &&
    AGENT_ROUTER_TOKEN.length > 25
  );
}

export function getAgentRouterModel() {
  return AGENT_ROUTER_MODEL;
}

export async function askAgentRouter({
  messages,
  temperature = 0.2,
  maxTokens = 1200,
  json = false,
}) {
  if (!isAgentRouterConfigured()) {
    throw new Error("AGENT_ROUTER_TOKEN is not configured");
  }

  const response = await fetch(
    `${AGENT_ROUTER_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AGENT_ROUTER_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SupportHub/1.0",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "SupportHub",
      },
      body: JSON.stringify({
        model: AGENT_ROUTER_MODEL,
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
    const errorText = cleanErrorText(await response.text());

    if (response.status === 429) {
      throw new Error(
        "AgentRouter rate limit was reached. Please try again later or switch models."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "AgentRouter token is invalid or does not have permission to use this model."
      );
    }

    if (response.status === 405) {
      throw new Error(
        `AgentRouter rejected the request. Check that AGENT_ROUTER_BASE_URL is https://agentrouter.org/v1 and that your token/model are enabled. Details: ${errorText}`
      );
    }

    throw new Error(
      `AgentRouter API error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("AgentRouter returned an empty response");
  }

  return text;
}
