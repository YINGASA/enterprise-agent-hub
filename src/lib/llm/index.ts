import { createOpenAiSseParser, extractJsonStringValuePrefix } from "@/lib/llm/sse";
import type { LlmClientConfig, LlmErrorType, LlmGenerateOptions, LlmGenerateResult, LlmMessage, LlmProvider, LlmProxyType, LlmStreamResult } from "@/types";

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

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: unknown;
};

const defaultBaseUrl = "https://api.deepseek.com";
const defaultModel = "deepseek-v4-flash";
const defaultTimeoutMs = 10000;

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

export function maskProxyUrl(proxyUrl: string | undefined) {
  if (!proxyUrl) {
    return "none";
  }

  try {
    const url = new URL(proxyUrl);
    if (url.username || url.password) {
      const username = url.username ? `${url.username}:****@` : "****@";
      return `${url.protocol}//${username}${url.host}`;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return "configured_invalid_url";
  }
}

function readProxyConfig(): { proxyUrl?: string; proxyType: LlmProxyType } {
  const candidates: Array<{ type: LlmProxyType; value?: string }> = [
    { type: "HTTPS_PROXY", value: process.env.HTTPS_PROXY?.trim() },
    { type: "HTTP_PROXY", value: process.env.HTTP_PROXY?.trim() },
    { type: "ALL_PROXY", value: process.env.ALL_PROXY?.trim() },
  ];

  const selected = candidates.find((item) => item.value);
  return selected?.value ? { proxyUrl: selected.value, proxyType: selected.type } : { proxyType: "none" };
}

function parseTimeoutMs(value: string | undefined) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  return defaultTimeoutMs;
}

async function createProxyAgent(proxyUrl: string | undefined) {
  if (!proxyUrl) return undefined;

  const { ProxyAgent } = await import("undici");
  return new ProxyAgent(proxyUrl);
}

export function getLlmConfig(): LlmClientConfig {
  const apiKey = process.env.AI_API_KEY?.trim();
  const rawBaseUrl = process.env.AI_BASE_URL?.trim() || defaultBaseUrl;
  const model = process.env.AI_MODEL?.trim() || defaultModel;
  const provider = normalizeProvider(process.env.AI_PROVIDER?.trim() || "deepseek");
  const normalizedBaseUrl = normalizeBaseUrl(rawBaseUrl);
  const requestUrl = getChatCompletionsUrl(normalizedBaseUrl);
  const { proxyUrl, proxyType } = readProxyConfig();
  const timeoutMs = parseTimeoutMs(process.env.AI_REQUEST_TIMEOUT_MS?.trim());
  const missing: LlmClientConfig["missing"] = [];

  if (!apiKey) missing.push("missing_api_key");
  if (!normalizedBaseUrl) missing.push("missing_base_url");
  if (!model) missing.push("missing_model");

  return {
    apiKey,
    hasApiKey: Boolean(apiKey),
    maskedApiKey: maskApiKey(apiKey),
    apiKeyLength: apiKey?.length ?? 0,
    hasProxy: Boolean(proxyUrl),
    proxyType,
    maskedProxyUrl: maskProxyUrl(proxyUrl),
    timeoutMs,
    baseUrl: rawBaseUrl,
    normalizedBaseUrl,
    requestUrl,
    model,
    provider,
    isConfigured: missing.length === 0,
    missing,
  };
}

function findFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  return null;
}

export function safeParseJson(text: string): { data: Record<string, unknown> | null; error?: string; rawContentPreview: string; candidate?: string } {
  const trimmed = text.trim();
  const rawContentPreview = trimmed.slice(0, 500);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [trimmed, fenced, findFirstJsonObject(fenced ?? trimmed)].filter((item): item is string => Boolean(item));
  let lastError = "No JSON object found.";

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { data: parsed as Record<string, unknown>, rawContentPreview, candidate };
      }
      lastError = "JSON root is not an object.";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown JSON parse error.";
    }
  }

  return { data: null, error: lastError, rawContentPreview, candidate: candidates.at(-1) };
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
  rawContentPreview?: string;
  parseError?: string;
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
    hasProxy: params.config.hasProxy,
    proxyType: params.config.proxyType,
    maskedProxyUrl: params.config.maskedProxyUrl,
    timeoutMs: params.config.timeoutMs,
    httpStatus: params.httpStatus,
    statusText: params.statusText,
    responseBodyPreview: params.responseBodyPreview,
    rawContentPreview: params.responseBodyPreview,
    parseError: params.errorType === "json_parse_error" ? params.errorMessage : undefined,
    errorType: params.errorType,
    errorName: params.errorName,
    errorMessage: params.errorMessage,
    causeMessage: params.causeMessage,
    causeCode: params.causeCode,
    error: params.errorMessage,
  };
}

function buildRequestBody(messages: LlmMessage[], options: LlmGenerateOptions, includeResponseFormat: boolean, stream = false) {
  return {
    model: getLlmConfig().model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 800,
    stream,
    ...(includeResponseFormat && options.responseFormat === "json_object" ? { response_format: { type: "json_object" } } : {}),
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

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  async function send(includeResponseFormat: boolean) {
    const proxyAgent = await createProxyAgent(config.hasProxy ? process.env[config.proxyType] : undefined);
    const body = buildRequestBody(messages, options, includeResponseFormat);
    const requestInit: FetchInitWithDispatcher = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
    };

    if (proxyAgent) {
      const { fetch: undiciFetch } = await import("undici");
      return undiciFetch(config.requestUrl, requestInit as Parameters<typeof undiciFetch>[1]);
    }

    return fetch(config.requestUrl, requestInit);
  }

  try {
    let response = await send(options.responseFormat === "json_object");
    let rawText = await response.text();
    let responseBodyPreview = rawText.slice(0, 500);
    let raw: unknown = rawText;
    try {
      raw = rawText ? JSON.parse(rawText) : null;
    } catch {
      raw = rawText;
    }

    if (!response.ok && options.responseFormat === "json_object") {
      const preview = responseBodyPreview.toLowerCase();
      const maybeUnsupportedResponseFormat = response.status === 400 && preview.includes("response_format");
      if (maybeUnsupportedResponseFormat) {
        response = await send(false);
        rawText = await response.text();
        responseBodyPreview = rawText.slice(0, 500);
        try {
          raw = rawText ? JSON.parse(rawText) : null;
        } catch {
          raw = rawText;
        }
      }
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
      hasProxy: config.hasProxy,
      proxyType: config.proxyType,
      maskedProxyUrl: config.maskedProxyUrl,
      timeoutMs: config.timeoutMs,
      httpStatus: response.status,
      statusText: response.statusText,
      responseBodyPreview,
      rawContentPreview: parsed.rawContentPreview,
      parseError: parsed.error,
      errorType: parsed.error ? "json_parse_error" : undefined,
      errorMessage: parsed.error,
      error: parsed.error,
    };
  } catch (error) {
    const typedError = error instanceof Error ? (error as ErrorWithCause) : null;
    const isTimeout = controller.signal.aborted || typedError?.name === "AbortError";
    return failedResult({
      config,
      startedAt,
      errorType: isTimeout ? "timeout_error" : "network_error",
      errorName: typedError?.name ?? "UnknownError",
      errorMessage: isTimeout ? `Request timed out after ${config.timeoutMs}ms.` : typedError?.message ?? "Unknown network error.",
      causeMessage: typedError?.cause?.message,
      causeCode: typedError?.cause?.code,
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function streamResultFromComplete(result: LlmGenerateResult, streamFallback: boolean, deltaCount: number): LlmStreamResult {
  return { ...result, streamingUsed: false, streamFallback, deltaCount };
}

function isStreamUnsupported(response: { status: number }, preview: string) {
  if (![400, 404, 405, 415, 422, 501].includes(response.status)) return false;
  const normalized = preview.toLowerCase();
  return normalized.includes("stream") && (normalized.includes("unsupported") || normalized.includes("not support") || normalized.includes("unknown") || normalized.includes("invalid"));
}

/**
 * Calls an OpenAI-compatible SSE endpoint without exposing raw upstream events.
 * Structured JSON is buffered for final validation; only the decoded `answer`
 * string is released incrementally.
 */
export async function streamOpenAICompatibleChat(
  messages: LlmMessage[],
  options: LlmGenerateOptions = {},
  onAnswerDelta: (delta: string) => void = () => undefined,
): Promise<LlmStreamResult> {
  const config = getLlmConfig();
  const startedAt = Date.now();
  const firstMissing = config.missing[0];
  if (firstMissing) return streamResultFromComplete(failedResult({ config, startedAt, errorType: firstMissing, errorMessage: firstMissing }), true, 0);

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);

  async function send(includeResponseFormat: boolean) {
    const proxyAgent = await createProxyAgent(config.hasProxy ? process.env[config.proxyType] : undefined);
    const requestInit: FetchInitWithDispatcher = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(buildRequestBody(messages, options, includeResponseFormat, true)),
      signal: controller.signal,
      ...(proxyAgent ? { dispatcher: proxyAgent } : {}),
    };
    if (proxyAgent) {
      const { fetch: undiciFetch } = await import("undici");
      return undiciFetch(config.requestUrl, requestInit as Parameters<typeof undiciFetch>[1]);
    }
    return fetch(config.requestUrl, requestInit);
  }

  let emittedAnswer = "";
  let deltaCount = 0;
  const emitAnswer = (answer: string) => {
    if (!answer.startsWith(emittedAnswer)) return;
    const delta = answer.slice(emittedAnswer.length);
    if (!delta) return;
    emittedAnswer = answer;
    deltaCount += 1;
    onAnswerDelta(delta);
  };
  const fallbackToComplete = async () => {
    const result = await callOpenAICompatibleChat(messages, options);
    const answer = result.parsedJson && typeof result.parsedJson.answer === "string" ? result.parsedJson.answer : "";
    emitAnswer(answer);
    return streamResultFromComplete(result, true, deltaCount);
  };

  try {
    let response = await send(options.responseFormat === "json_object");
    if (!response.ok && options.responseFormat === "json_object") {
      const preview = (await response.text()).slice(0, 500);
      if (response.status === 400 && preview.toLowerCase().includes("response_format")) response = await send(false);
      else if (isStreamUnsupported(response, preview)) return await fallbackToComplete();
      else return { ...failedResult({ config, startedAt, errorType: "http_error", errorMessage: `HTTP ${response.status} ${response.statusText}`, httpStatus: response.status, statusText: response.statusText, responseBodyPreview: preview }), streamingUsed: false, streamFallback: false, deltaCount };
    }

    if (!response.ok) {
      const preview = (await response.text()).slice(0, 500);
      if (isStreamUnsupported(response, preview)) return await fallbackToComplete();
      return { ...failedResult({ config, startedAt, errorType: "http_error", errorMessage: `HTTP ${response.status} ${response.statusText}`, httpStatus: response.status, statusText: response.statusText, responseBodyPreview: preview }), streamingUsed: false, streamFallback: false, deltaCount };
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/event-stream")) {
      const rawText = await response.text();
      try {
        const raw = JSON.parse(rawText) as ChatCompletionResponse;
        const content = raw.choices?.[0]?.message?.content;
        if (typeof content === "string" && content) {
          const parsed = safeParseJson(content);
          const answer = parsed.data && typeof parsed.data.answer === "string" ? parsed.data.answer : "";
          emitAnswer(answer);
          return {
            content,
            parsedJson: parsed.data,
            raw: null,
            model: raw.model ?? config.model,
            provider: config.provider,
            mode: "real",
            durationMs: Date.now() - startedAt,
            requestUrl: config.requestUrl,
            hasProxy: config.hasProxy,
            proxyType: config.proxyType,
            maskedProxyUrl: config.maskedProxyUrl,
            timeoutMs: config.timeoutMs,
            httpStatus: response.status,
            statusText: response.statusText,
            rawContentPreview: parsed.rawContentPreview,
            parseError: parsed.error,
            errorType: parsed.error ? "json_parse_error" : undefined,
            errorMessage: parsed.error,
            error: parsed.error,
            streamingUsed: false,
            streamFallback: true,
            deltaCount,
          };
        }
      } catch {
        // Fall through to the existing complete-response implementation.
      }
      return await fallbackToComplete();
    }

    if (!response.body) return await fallbackToComplete();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let content = "";
    let sawDone = false;
    const parser = createOpenAiSseParser((event) => {
      if (event.type === "done") {
        sawDone = true;
        return;
      }
      content += event.content;
      emitAnswer(extractJsonStringValuePrefix(content, "answer"));
    });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.push(decoder.decode());
      parser.finish();
    } finally {
      reader.releaseLock();
    }
    if (!content && !sawDone) return await fallbackToComplete();

    const parsed = safeParseJson(content);
    if (parsed.data && typeof parsed.data.answer === "string") emitAnswer(parsed.data.answer);
    return {
      content,
      parsedJson: parsed.data,
      raw: null,
      model: config.model,
      provider: config.provider,
      mode: "real",
      durationMs: Date.now() - startedAt,
      requestUrl: config.requestUrl,
      hasProxy: config.hasProxy,
      proxyType: config.proxyType,
      maskedProxyUrl: config.maskedProxyUrl,
      timeoutMs: config.timeoutMs,
      httpStatus: response.status,
      statusText: response.statusText,
      rawContentPreview: parsed.rawContentPreview,
      parseError: parsed.error,
      errorType: parsed.error ? "json_parse_error" : undefined,
      errorMessage: parsed.error,
      error: parsed.error,
      streamingUsed: true,
      streamFallback: false,
      deltaCount,
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const typedError = error instanceof Error ? (error as ErrorWithCause) : null;
    return {
      ...failedResult({
        config,
        startedAt,
        errorType: timedOut ? "timeout_error" : "network_error",
        errorName: typedError?.name ?? "UnknownError",
        errorMessage: timedOut ? `Request timed out after ${config.timeoutMs}ms.` : typedError?.message ?? "Unknown network error.",
        causeMessage: typedError?.cause?.message,
        causeCode: typedError?.cause?.code,
      }),
      streamingUsed: deltaCount > 0,
      streamFallback: false,
      deltaCount,
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
