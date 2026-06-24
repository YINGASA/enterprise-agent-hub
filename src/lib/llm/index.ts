import type { LlmClientConfig, LlmErrorType, LlmGenerateOptions, LlmGenerateResult, LlmMessage, LlmProvider } from "@/types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  model?: string;
};

type ErrorWithCause = Error & {
  cause?: {
    message?: string;
    code?: string;
  };
};

const defaultBaseUrl = "https://api.deepseek.com";
const defaultModel = "deepseek-v4-flash";

function normalizeProvider(value: string | undefined): LlmProvider {
  if (value === "deepseek" || value === "openai-compatible" || value === "mock") {
    return value;
  }

  return "openai-compatible";
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function getChatCompletionsUrl(baseUrl: string) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (normalizedBaseUrl.endsWith("/chat/completions")) {
    return normalizedBaseUrl;
  }
  return `${normalizedBaseUrl}/chat/completions`;
}

export function maskApiKey(apiKey: string | undefined) {
  if (!apiKey) {
    return "missing";
  }

  if (apiKey.length <= 7) {
    return `${apiKey.slice(0, 1)}****${apiKey.slice(-1)}`;
  }

  return `${apiKey.slice(0, 3)}****${apiKey.slice(-4)}`;
}

export function getLlmConfig(): LlmClientConfig {
  const apiKey = process.env.AI_API_KEY?.trim();
  const rawBaseUrl = process.env.AI_BASE_URL?.trim() || defaultBaseUrl;
  const model = process.env.AI_MODEL?.trim() || defaultModel;
  const provider = normalizeProvider(process.env.AI_PROVIDER?.trim() || "deepseek");
  const normalizedBaseUrl = normalizeBaseUrl(rawBaseUrl);
  const requestUrl = getChatCompletionsUrl(normalizedBaseUrl);
  const missing: LlmClientConfig["missing"] = [];

  if (!apiKey) missing.push("missing_api_key");
  if (!normalizedBaseUrl) missing.push("missing_base_url");
  if (!model) missing.push("missing_model");

  return {
    apiKey,
    hasApiKey: Boolean(apiKey),
    maskedApiKey: maskApiKey(apiKey),
    apiKeyLength: apiKey?.length ?? 0,
    baseUrl: rawBaseUrl,
    normalizedBaseUrl,
    requestUrl,
    model,
    provider,
    isConfigured: missing.length === 0,
    missing,
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

function failedResult(params: {
  config: LlmClientConfig;
  startedAt: number;
  errorType: LlmErrorType;
  errorMessage: string;
  raw?: unknown;
  httpStatus?: number;
  statusText?: string;
  responseBodyPreview?: string;
  errorName?: string;
  causeMessage?: string;
  causeCode?: string;
}): LlmGenerateResult {
  return {
    content: "",
    parsedJson: null,
    raw: params.raw ?? null,
    model: params.config.model,
    provider: params.config.provider,
    mode: "real",
    durationMs: Date.now() - params.startedAt,
    requestUrl: params.config.requestUrl,
    httpStatus: params.httpStatus,
    statusText: params.statusText,
    responseBodyPreview: params.responseBodyPreview,
    errorType: params.errorType,
    errorName: params.errorName,
    errorMessage: params.errorMessage,
    causeMessage: params.causeMessage,
    causeCode: params.causeCode,
    error: params.errorMessage,
  };
}

export async function callOpenAICompatibleChat(
  messages: LlmMessage[],
  options: LlmGenerateOptions = {},
): Promise<LlmGenerateResult> {
  const config = getLlmConfig();
  const startedAt = Date.now();
  const firstMissing = config.missing[0];

  if (firstMissing) {
    return failedResult({
      config,
      startedAt,
      errorType: firstMissing,
      errorMessage: firstMissing,
    });
  }

  try {
    const response = await fetch(config.requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 800,
        stream: false,
      }),
    });

    const rawText = await response.text();
    const responseBodyPreview = rawText.slice(0, 500);
    let raw: unknown = rawText;
    try {
      raw = rawText ? JSON.parse(rawText) : null;
    } catch {
      raw = rawText;
    }

    if (!response.ok) {
      return failedResult({
        config,
        startedAt,
        errorType: "http_error",
        errorMessage: `HTTP ${response.status} ${response.statusText}`,
        raw,
        httpStatus: response.status,
        statusText: response.statusText,
        responseBodyPreview,
      });
    }

    const data = raw as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return failedResult({
        config,
        startedAt,
        errorType: "invalid_response_shape",
        errorMessage: "Invalid chat completion response: missing choices[0].message.content.",
        raw,
        httpStatus: response.status,
        statusText: response.statusText,
        responseBodyPreview,
      });
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
      requestUrl: config.requestUrl,
      httpStatus: response.status,
      statusText: response.statusText,
      responseBodyPreview,
      errorType: parsed.error ? "json_parse_error" : undefined,
      errorMessage: parsed.error,
      error: parsed.error,
    };
  } catch (error) {
    const typedError = error instanceof Error ? (error as ErrorWithCause) : null;
    return failedResult({
      config,
      startedAt,
      errorType: "network_error",
      errorName: typedError?.name ?? "UnknownError",
      errorMessage: typedError?.message ?? "Unknown network error.",
      causeMessage: typedError?.cause?.message,
      causeCode: typedError?.cause?.code,
    });
  }
}
