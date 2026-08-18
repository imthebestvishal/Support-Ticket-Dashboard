const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1";

export function isOpenRouterConfigured() {
  return (
    OPENROUTER_API_KEY &&
    !OPENROUTER_API_KEY.startsWith("your-") &&
    OPENROUTER_API_KEY.length > 25
  );
}

export function getOpenRouterModel() {
  return OPENROUTER_MODEL;
}

export async function askOpenRouter({
  messages,
  temperature = 0.2,
  maxTokens = 1200,
  json = false,
}) {
  if (!isOpenRouterConfigured()) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(
    `${OPENROUTER_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL || "http://localhost:5173",
        "X-Title": "SupportHub",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
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
    const errorText = await response.text();

    if (response.status === 429) {
      throw new Error(
        "OpenRouter free model rate limit was reached. Please try again later or switch models."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "OpenRouter API key is invalid or does not have permission to use this model."
      );
    }

    throw new Error(
      `OpenRouter API error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("OpenRouter returned an empty response");
  }

  return text;
}
