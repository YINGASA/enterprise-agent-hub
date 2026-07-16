import type { AgentStreamEvent, ConversationSummaryPatch, ConversationSummaryState } from "@/types";
import { sanitizeConversationSummaryPatch, sanitizeConversationSummaryState } from "@/lib/conversation/context-summary";

const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

export function isConversationSummaryPatch(value: unknown): value is ConversationSummaryPatch {
  return sanitizeConversationSummaryPatch(value) !== undefined;
}

export function isAgentStreamEvent(value: unknown): value is AgentStreamEvent {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type !== "answer_completed" && value.conversationSummaryPatch !== undefined) return false;
  if (value.type === "run_started") {
    return typeof value.runId === "string" && (value.requestedMode === "mock" || value.requestedMode === "real") &&
      (value.responseMode === "mock" || value.responseMode === "real") &&
      typeof value.contextApplied === "boolean" && isNonNegativeInteger(value.contextMessageCount) && typeof value.contextTruncated === "boolean";
  }
  if (value.type === "phase") return value.phase === "understand" || value.phase === "retrieve" || value.phase === "tool" || value.phase === "generate" || value.phase === "complete";
  if (value.type === "answer_delta") return typeof value.delta === "string" && value.delta.length > 0 && isNonNegativeInteger(value.index);
  if (value.type === "answer_completed") {
    return isRecord(value.result) && value.result.conversationSummaryPatch === undefined && typeof value.result.runId === "string" && value.result.runId.length > 0 &&
      typeof value.result.finalAnswer === "string" && isRecord(value.result.api) &&
      value.streamingRequested === true && typeof value.streamingUsed === "boolean" &&
      typeof value.streamFallback === "boolean" && isNonNegativeInteger(value.deltaCount) &&
      (value.conversationSummaryPatch === undefined || isConversationSummaryPatch(value.conversationSummaryPatch));
  }
  if (value.type === "run_error") {
    return (value.code === "invalid_stream" || value.code === "network_error" || value.code === "rate_limited" || value.code === "server_error" || value.code === "timeout_error") &&
      typeof value.message === "string" && typeof value.retryable === "boolean";
  }
  return value.type === "run_aborted" && typeof value.message === "string";
}

export function encodeAgentStreamEvent(event: AgentStreamEvent) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export function createNdjsonEventParser(
  onEvent: (event: AgentStreamEvent) => void,
  onInvalid?: (line: string) => void,
) {
  let buffer = "";

  const parseLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isAgentStreamEvent(parsed)) onEvent(parsed);
      else onInvalid?.(trimmed);
    } catch {
      onInvalid?.(trimmed);
    }
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(parseLine);
    },
    finish() {
      parseLine(buffer);
      buffer = "";
    },
  };
}

export async function parseAgentStreamResponse(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal,
) {
  if (!response.ok) throw new Error(`Agent stream request failed with HTTP ${response.status}.`);
  if (!response.body) throw new Error("Agent stream response body is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let invalidEventCount = 0;
  const parser = createNdjsonEventParser(onEvent, () => {
    invalidEventCount += 1;
  });

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.finish();
  } finally {
    reader.releaseLock();
  }

  if (invalidEventCount > 0) throw new Error("Agent stream contained an invalid event.");
}

export function splitMockAnswer(answer: string) {
  const characters = Array.from(answer);
  if (characters.length === 0) return [];
  const desiredChunks = Math.max(3, Math.min(10, characters.length >= 96 ? 6 : Math.ceil(characters.length / 24)));
  const chunkSize = Math.max(1, Math.ceil(characters.length / desiredChunks));
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += chunkSize) chunks.push(characters.slice(index, index + chunkSize).join(""));
  return chunks;
}

function waitForDelay(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function streamMockAnswer(
  answer: string,
  onDelta: (delta: string, index: number) => void,
  options: { signal?: AbortSignal; delayMs?: number } = {},
) {
  const chunks = splitMockAnswer(answer);
  for (let index = 0; index < chunks.length; index += 1) {
    await waitForDelay(options.delayMs ?? 20, options.signal);
    if (options.signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    onDelta(chunks[index], index);
  }
  return chunks.length;
}
