import { NextResponse } from "next/server";
import { evaluationCases } from "@/data/evaluation";
import { runEvaluationSuite } from "@/lib/evaluation";
import { isOpsTokenConfigured, validateOpsToken } from "@/lib/ops/auth";
import { realApiLimits } from "@/lib/ops/securityLimits";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { recordEvaluationRun } from "@/lib/ops/storage";
import type { LlmMode } from "@/types";

export const runtime = "nodejs";

type EvaluationSuite = "quick" | "standard" | "full" | "custom";
type EvaluationRequestBody = { mode?: unknown; caseIds?: unknown; suite?: unknown; packId?: unknown };

function parseMode(value: unknown): LlmMode | null {
  return value === "mock" || value === "real" ? value : null;
}

function asCaseIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length <= 120) : [];
}

function asSuite(value: unknown): EvaluationSuite | null {
  return value === "quick" || value === "standard" || value === "full" ? value : null;
}

function suiteLimit(suite: EvaluationSuite) {
  if (suite === "quick") return 15;
  if (suite === "standard") return 30;
  return Number.POSITIVE_INFINITY;
}

function asPackId(value: unknown) {
  return typeof value === "string" && value !== "all" && value.length <= 80 ? value : undefined;
}

function rateLimitedResponse(rateLimit: ReturnType<typeof checkRealApiRateLimit>) {
  return NextResponse.json(
    {
      error: "rate_limited",
      errorType: "rate_limited",
      message: "真实模型评测请求过于频繁，请稍后再试。",
      limit: rateLimit.limit,
      resetAt: new Date(rateLimit.resetAt).toISOString(),
    },
    { status: 429 },
  );
}

export async function POST(request: Request) {
  let body: EvaluationRequestBody;
  try {
    body = (await request.json()) as EvaluationRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const mode = parseMode(body.mode);
  if (!mode) return NextResponse.json({ error: "invalid_mode", message: "评测模式不合法。" }, { status: 400 });

  const caseIds = asCaseIds(body.caseIds);
  const suite = caseIds.length > 0 ? "custom" : asSuite(body.suite);
  if (!suite) return NextResponse.json({ error: "invalid_suite", message: "测试集规模不合法。" }, { status: 400 });

  const packId = asPackId(body.packId);
  let selectedCases = caseIds.length > 0
    ? evaluationCases.filter((caseItem) => caseIds.includes(caseItem.id))
    : evaluationCases.slice(0, suiteLimit(suite));
  if (packId) selectedCases = selectedCases.filter((caseItem) => caseItem.packId === packId);

  if (mode === "real") {
    if (!isOpsTokenConfigured()) {
      return NextResponse.json({ error: "ops_token_not_configured", message: "真实模型评测未开放。" }, { status: 503 });
    }
    if (!validateOpsToken(request)) {
      return NextResponse.json({ error: "unauthorized", message: "真实模型评测需要运维授权。" }, { status: 401 });
    }
    if (caseIds.length > realApiLimits.evaluationMaxCases) {
      return NextResponse.json({ error: "real_evaluation_case_limit", message: `真实模型评测最多支持 ${realApiLimits.evaluationMaxCases} 条用例。` }, { status: 400 });
    }

    const requestedCount = caseIds.length > 0 ? selectedCases.length : realApiLimits.evaluationDefaultCases;
    selectedCases = selectedCases.slice(0, Math.min(requestedCount, realApiLimits.evaluationMaxCases));
    const rateLimit = checkRealApiRateLimit(getClientIp(request), Math.max(1, selectedCases.length));
    if (!rateLimit.allowed) return rateLimitedResponse(rateLimit);
  }

  const result = await runEvaluationSuite(selectedCases, mode, suite);
  await recordEvaluationRun(result);
  return NextResponse.json(result);
}
