import { NextResponse } from "next/server";
import { asAgentMode, asAgentQuestion, runAgentApiPipeline } from "@/lib/agent/api";

export const runtime = "nodejs";

type AgentRequestBody = {
  question?: unknown;
  mode?: unknown;
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
  const response = await runAgentApiPipeline(question, requestedMode);
  return NextResponse.json(response);
}