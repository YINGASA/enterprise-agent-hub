import { NextResponse } from "next/server";
import { asAgentMode, asAgentQuestion, runAgentApiPipeline } from "@/lib/agent/api";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { recordAgentError, recordAgentRun } from "@/lib/ops/storage";

export const runtime = "nodejs";

type AgentRequestBody = {
  question?: unknown;
  mode?: unknown;
  userDocuments?: unknown;
};

export async function POST(request: Request) {
  let body: AgentRequestBody = {};
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    body = {};
  }

  const question = asAgentQuestion(body.question);
  const requestedMode = asAgentMode(body.mode);

  if (requestedMode === "real") {
    const rateLimit = checkRealApiRateLimit(getClientIp(request));
    if (!rateLimit.allowed) {
      await recordAgentError({
        question,
        requestedMode,
        responseMode: "real_error_fallback",
        errorType: "rate_limited",
        httpStatus: 429,
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

  const userDocuments = Array.isArray(body.userDocuments)
    ? body.userDocuments.map(sanitizeImportedKnowledgeDocument).filter((item): item is NonNullable<ReturnType<typeof sanitizeImportedKnowledgeDocument>> => Boolean(item))
    : [];
  const response = await runAgentApiPipeline(question, requestedMode, userDocuments);
  await recordAgentRun(response);
  return NextResponse.json(response);
}
