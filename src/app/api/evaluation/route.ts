import { NextResponse } from "next/server";
import { evaluationCases } from "@/data/evaluation";
import { runEvaluationSuite } from "@/lib/evaluation";
import type { LlmMode } from "@/types";

export const runtime = "nodejs";

type EvaluationSuite = "quick" | "standard" | "full" | "custom";
type EvaluationRequestBody = { mode?: unknown; caseIds?: unknown; suite?: unknown; packId?: unknown; };

function asMode(value: unknown): LlmMode { return value === "real" ? "real" : "mock"; }
function asCaseIds(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function asSuite(value: unknown): EvaluationSuite { return value === "quick" || value === "standard" || value === "full" ? value : "full"; }
function suiteLimit(suite: EvaluationSuite) { if (suite === "quick") return 15; if (suite === "standard") return 30; if (suite === "full") return 50; return Number.POSITIVE_INFINITY; }
function asPackId(value: unknown) { return typeof value === "string" && value !== "all" ? value : undefined; }

export async function POST(request: Request) {
  let body: EvaluationRequestBody = {};
  try { body = (await request.json()) as EvaluationRequestBody; } catch { body = {}; }
  const mode = asMode(body.mode);
  const caseIds = asCaseIds(body.caseIds);
  const requestedSuite = caseIds.length > 0 ? "custom" : asSuite(body.suite);
  const packId = asPackId(body.packId);
  let selectedCases = caseIds.length > 0 ? evaluationCases.filter((caseItem) => caseIds.includes(caseItem.id)) : evaluationCases.slice(0, suiteLimit(requestedSuite));
  if (packId) selectedCases = selectedCases.filter((caseItem) => caseItem.packId === packId);
  const result = await runEvaluationSuite(selectedCases, mode, requestedSuite);
  return NextResponse.json(result);
}
