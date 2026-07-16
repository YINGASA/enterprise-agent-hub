import { NextResponse } from "next/server";
import { runAgentApiPipeline } from "@/lib/agent/api";
import { encodeAgentStreamEvent, streamMockAnswer } from "@/lib/agent/streamProtocol";
import { sanitizeAgentStreamResult } from "@/lib/agent/streamSafety";
import { validateAgentRequest } from "@/lib/ops/agentRequest";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { createOpsAgentRunId, recordAgentAbortedRun, recordAgentError, recordAgentRun, sanitizeRequestAction } from "@/lib/ops/storage";
import type { AgentApiResponse, AgentStreamEvent, AgentStreamMetadata } from "@/types";

export const runtime = "nodejs";

const streamHeaders = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
};

function streamErrorResponse(event: AgentStreamEvent, status = 200) {
  return new Response(encodeAgentStreamEvent(event), { status, headers: streamHeaders });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const validated = validateAgentRequest(body);
  if ("status" in validated) return NextResponse.json({ error: "invalid_request", message: validated.message }, { status: validated.status });

  const { question, mode: requestedMode, userDocuments, contextCandidates, contextMeta, conversationSummary } = validated;
  const requestAction = sanitizeRequestAction(body["requestAction"]);
  const runId = createOpsAgentRunId();
  if (requestedMode === "real") {
    const rateLimit = checkRealApiRateLimit(getClientIp(request));
    if (!rateLimit.allowed) {
      await recordAgentError({
        runId,
        question,
        requestedMode,
        responseMode: "real_error_fallback",
        errorType: "rate_limited",
        httpStatus: 429,
        contextApplied: contextMeta.contextApplied,
        contextMessageCount: contextMeta.contextMessageCount,
        contextTruncated: contextMeta.contextTruncated,
        streamingRequested: true,
        requestAction,
      });
      return streamErrorResponse({ type: "run_error", code: "rate_limited", message: "请求过于频繁，请稍后再试。", retryable: true });
    }
  }

  const runController = new AbortController();
  let completionCommitted = false;
  const abortFromRequest = () => {
    if (!completionCommitted) runController.abort(request.signal.reason);
  };
  if (request.signal.aborted) abortFromRequest();
  else request.signal.addEventListener("abort", abortFromRequest, { once: true });
  let closed = false;
  let abortRecorded = false;
  const startedAt = Date.now();

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let deltaIndex = 0;
      let streamMetadata: Omit<AgentStreamMetadata, "streamingRequested"> = {
        streamingUsed: false,
        streamFallback: false,
        deltaCount: 0,
      };
      const emit = (event: AgentStreamEvent) => {
        if (closed || runController.signal.aborted) return false;
        try {
          controller.enqueue(encodeAgentStreamEvent(event));
          return true;
        } catch {
          closed = true;
          runController.abort();
          return false;
        }
      };
      const recordAbortOnce = async () => {
        if (abortRecorded) return;
        abortRecorded = true;
        await recordAgentAbortedRun({
          runId,
          question,
          requestedMode,
          responseMode: "aborted",
          durationMs: Date.now() - startedAt,
          contextApplied: contextMeta.contextApplied,
          contextMessageCount: contextMeta.contextMessageCount,
          contextTruncated: contextMeta.contextTruncated,
          streamingUsed: streamMetadata.streamingUsed || deltaIndex > 0,
          streamFallback: streamMetadata.streamFallback,
          requestAction,
        });
      };

      try {
        emit({
          type: "run_started",
          runId,
          requestedMode,
          responseMode: requestedMode,
          contextApplied: contextMeta.contextApplied,
          contextMessageCount: contextMeta.contextMessageCount,
          contextTruncated: contextMeta.contextTruncated,
        });
        emit({ type: "phase", phase: "understand" });

        const result = await runAgentApiPipeline(question, requestedMode, userDocuments, contextCandidates, contextMeta, {
          streaming: requestedMode === "real",
          signal: runController.signal,
          onPhase: (phase) => emit({ type: "phase", phase }),
          onAnswerDelta: (delta) => {
            if (!runController.signal.aborted && emit({ type: "answer_delta", delta, index: deltaIndex })) deltaIndex += 1;
          },
          onStreamMetadata: (metadata) => {
            streamMetadata = metadata;
          },
        }, conversationSummary);

        if (closed || runController.signal.aborted || request.signal.aborted) {
          await recordAbortOnce();
          return;
        }

        if (requestedMode === "mock") {
          await streamMockAnswer(
            result.finalAnswer,
            (delta, index) => {
              if (emit({ type: "answer_delta", delta, index })) deltaIndex = index + 1;
            },
            { signal: runController.signal, delayMs: 20 },
          );
          streamMetadata = { streamingUsed: true, streamFallback: false, deltaCount: deltaIndex };
        } else if (deltaIndex === 0 && result.finalAnswer) {
          emit({ type: "answer_delta", delta: result.finalAnswer, index: deltaIndex });
          deltaIndex += 1;
        }

        if (closed || runController.signal.aborted || request.signal.aborted) {
          await recordAbortOnce();
          return;
        }

        streamMetadata = { ...streamMetadata, deltaCount: deltaIndex };
        const resultWithStreamMetadata: AgentApiResponse = {
          ...result,
          runId,
          api: {
            ...result.api,
            streamingRequested: true,
            streamingUsed: streamMetadata.streamingUsed,
            streamFallback: streamMetadata.streamFallback,
            aborted: false,
            streamDeltaCount: deltaIndex,
            requestAction,
          },
        };
        if (!emit({ type: "phase", phase: "complete" })) {
          await recordAbortOnce();
          return;
        }
        const completedEmitted = emit({
          type: "answer_completed",
          result: sanitizeAgentStreamResult((({ conversationSummaryPatch: _conversationSummaryPatch, ...safeResult }) => safeResult)(resultWithStreamMetadata)),
          ...(resultWithStreamMetadata.conversationSummaryPatch ? { conversationSummaryPatch: resultWithStreamMetadata.conversationSummaryPatch } : {}),
          streamingRequested: true,
          streamingUsed: streamMetadata.streamingUsed || deltaIndex > 0,
          streamFallback: streamMetadata.streamFallback,
          deltaCount: deltaIndex,
        });
        if (!completedEmitted) {
          await recordAbortOnce();
          return;
        }
        completionCommitted = true;
        try {
          const { conversationSummaryPatch: _conversationSummaryPatch, ...opsResult } = resultWithStreamMetadata;
          await recordAgentRun(opsResult, {
            runId,
            streamingRequested: true,
            streamingUsed: streamMetadata.streamingUsed,
            streamFallback: streamMetadata.streamFallback,
            durationMs: Date.now() - startedAt,
            requestAction,
          });
        } finally {
          closed = true;
          controller.close();
        }
      } catch (error) {
        if (completionCommitted) return;
        if (runController.signal.aborted || request.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          await recordAbortOnce();
          if (!closed) {
            emit({ type: "run_aborted", message: "已停止生成。" });
            closed = true;
            controller.close();
          }
          return;
        }
        await recordAgentError({
          runId,
          question,
          requestedMode,
          responseMode: "stream_error",
          errorType: "stream_error",
          durationMs: Date.now() - startedAt,
          contextApplied: contextMeta.contextApplied,
          contextMessageCount: contextMeta.contextMessageCount,
          contextTruncated: contextMeta.contextTruncated,
          streamingRequested: true,
          streamingUsed: streamMetadata.streamingUsed || deltaIndex > 0,
          streamFallback: streamMetadata.streamFallback,
          requestAction,
        });
        if (!closed) {
          emit({ type: "run_error", code: "server_error", message: "生成过程中断，请重试。", retryable: true });
          closed = true;
          controller.close();
        }
      } finally {
        request.signal.removeEventListener("abort", abortFromRequest);
      }
    },
    async cancel() {
      if (!completionCommitted && !closed) runController.abort();
    },
  });

  return new Response(responseStream, { headers: streamHeaders });
}
