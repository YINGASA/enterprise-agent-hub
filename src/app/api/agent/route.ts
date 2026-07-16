import { NextResponse } from "next/server";
import { runAgentApiPipeline } from "@/lib/agent/api";
import { validateAgentRequest } from "@/lib/ops/agentRequest";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { recordAgentError, recordAgentRun, sanitizeRequestAction } from "@/lib/ops/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const validated = validateAgentRequest(body);
  if ("status" in validated) {
    return NextResponse.json({ error: "invalid_request", message: validated.message }, { status: validated.status });
  }

  const { question, mode: requestedMode, userDocuments, contextCandidates, contextMeta, conversationSummary } = validated;
  const requestAction = sanitizeRequestAction(body["requestAction"]);
  if (requestedMode === "real") {
    const rateLimit = checkRealApiRateLimit(getClientIp(request));
    if (!rateLimit.allowed) {
      await recordAgentError({
        question,
        requestedMode,
        responseMode: "real_error_fallback",
        errorType: "rate_limited",
        httpStatus: 429,
        contextApplied: contextMeta.contextApplied,
        contextMessageCount: contextMeta.contextMessageCount,
        contextTruncated: contextMeta.contextTruncated,
        requestAction,
      });
      return NextResponse.json(
        {
          error: "rate_limited",
          errorType: "rate_limited",
          responseMode: "real_error_fallback",
          message: "请求过于频繁，请稍后再试。你仍可以切换到开发模拟模式进行离线验证。",
          limit: rateLimit.limit,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { status: 429 },
      );
    }
  }

  const response = await runAgentApiPipeline(question, requestedMode, userDocuments, contextCandidates, contextMeta, undefined, conversationSummary);
  const responseWithAction = { ...response, api: { ...response.api, requestAction } };
  const { conversationSummaryPatch: _conversationSummaryPatch, ...opsResponse } = responseWithAction;
  const runId = await recordAgentRun(opsResponse, { requestAction });
  return NextResponse.json({ ...responseWithAction, runId });
}
