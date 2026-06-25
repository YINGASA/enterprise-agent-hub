import { NextResponse } from "next/server";
import { evaluationCases } from "@/data/evaluation";
import { runEvaluationSuite } from "@/lib/evaluation";
import type { LlmMode } from "@/types";

export const runtime = "nodejs";

type EvaluationRequestBody = {
  mode?: unknown;
  caseIds?: unknown;
};

function asMode(value: unknown): LlmMode {
  return value === "real" ? "real" : "mock";
}

function asCaseIds(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  let body: EvaluationRequestBody = {};
  try {
    body = (await request.json()) as EvaluationRequestBody;
  } catch {
    body = {};
  }

  const mode = asMode(body.mode);
  const caseIds = asCaseIds(body.caseIds);
  const selectedCases = caseIds.length > 0 ? evaluationCases.filter((caseItem) => caseIds.includes(caseItem.id)) : evaluationCases;
  const result = await runEvaluationSuite(selectedCases, mode);
  return NextResponse.json(result);
}