import type { LlmClientConfig, LlmGenerateOptions, LlmGenerateResult, LlmMessage, LlmProvider } from "@/types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  model?: string;
};

function normalizeProvider(value: string | undefined): LlmProvider {
  if (value === "deepseek" || value === "openai-compatible" || value === "mock") {
    return value;
  }

  return "openai-compatible";
}

function joinChatCompletionUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

export function getLlmConfig(): LlmClientConfig {
  const apiKey = process.env.AI_API_KEY?.trim();
  const baseUrl = process.env.AI_BASE_URL?.trim() || "https://api.deepseek.com";
  const model = process.env.AI_MODEL?.trim() || "deepseek-v4-flash";
  const provider = normalizeProvider(process.env.AI_PROVIDER?.trim() || "deepseek");

  return {
    apiKey,
    baseUrl,
    model,
    provider,
    isConfigured: Boolean(apiKey),
  };
}

export function safeParseJson(text: string): { data: Record<string, unknown> | null; error?: string } {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed;

  try {
    const parsed: unknown = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown> };
    }
    return { data: null, error: "JSON root is not an object." };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown JSON parse error." };
  }
}

export async function callOpenAICompatibleChat(
  messages: LlmMessage[],
  options: LlmGenerateOptions = {},
): Promise<LlmGenerateResult> {
  const config = getLlmConfig();
  const startedAt = Date.now();

  if (!config.apiKey) {
    return {
      content: "",
      parsedJson: null,
      raw: null,
      model: config.model,
      provider: config.provider,
      mode: "real",
      durationMs: Date.now() - startedAt,
      error: "missing_api_key",
    };
  }

  try {
    const response = await fetch(joinChatCompletionUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1200,
        stream: false,
        ...(options.responseFormat === "json_object" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    const rawText = await response.text();
    let raw: unknown = rawText;
    try {
      raw = rawText ? JSON.parse(rawText) : null;
    } catch {
      raw = rawText;
    }

    if (!response.ok) {
      return {
        content: "",
        parsedJson: null,
        raw,
        model: config.model,
        provider: config.provider,
        mode: "real",
        durationMs: Date.now() - startedAt,
        error: `HTTP ${response.status}: ${rawText.slice(0, 300)}`,
      };
    }

    const data = raw as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return {
        content: "",
        parsedJson: null,
        raw,
        model: data.model ?? config.model,
        provider: config.provider,
        mode: "real",
        durationMs: Date.now() - startedAt,
        error: "Invalid chat completion response: missing choices[0].message.content.",
      };
    }

    const parsed = safeParseJson(content);

    return {
      content,
      parsedJson: parsed.data,
      raw,
      model: data.model ?? config.model,
      provider: config.provider,
      mode: "real",
      durationMs: Date.now() - startedAt,
      error: parsed.error,
    };
  } catch (error) {
    return {
      content: "",
      parsedJson: null,
      raw: null,
      model: config.model,
      provider: config.provider,
      mode: "real",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown network error.",
    };
  }
}
