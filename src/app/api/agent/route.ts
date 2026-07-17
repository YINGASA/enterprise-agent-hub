import { NextResponse } from "next/server";
import { runAgentApiPipeline } from "@/lib/agent/api";
import { validateAgentRequest } from "@/lib/ops/agentRequest";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { recordAgentError, recordAgentRun, sanitizeRequestAction } from "@/lib/ops/storage";
import { resolveAgentKnowledge } from "@/lib/server-storage/agentKnowledge";
import { toStorageErrorResponse } from "@/lib/server-storage/errors";
import { requireSameOrigin } from "@/lib/server-storage/request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
  } catch (error) {
    const safeError = toStorageErrorResponse(error);
    return NextResponse.json(safeError.body, { status: safeError.status, headers: { "cache-control": "no-store" } });
  }

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

  let knowledge: Awaited<ReturnType<typeof resolveAgentKnowledge>>;
  try {
    knowledge = await resolveAgentKnowledge(request, userDocuments);
  } catch (error) {
    const safeError = toStorageErrorResponse(error);
    return NextResponse.json(safeError.body, { status: safeError.status, headers: { "cache-control": "no-store" } });
  }
  const response = await runAgentApiPipeline(question, requestedMode, knowledge.documents, contextCandidates, contextMeta, undefined, conversationSummary, knowledge.chunks);
  const responseWithAction = { ...response, api: { ...response.api, requestAction } };
  const { conversationSummaryPatch: _conversationSummaryPatch, ...opsResponse } = responseWithAction;
  const runId = await recordAgentRun(opsResponse, { requestAction });
  const result = NextResponse.json({ ...responseWithAction, runId });
  if (knowledge.setCookie) result.headers.append("Set-Cookie", knowledge.setCookie);
  return result;
}
