import { NextResponse } from "next/server";
import { asAgentMode, asAgentQuestion, runAgentApiPipeline } from "@/lib/agent/api";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";

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
  const userDocuments = Array.isArray(body.userDocuments)
    ? body.userDocuments.map(sanitizeImportedKnowledgeDocument).filter((item): item is NonNullable<ReturnType<typeof sanitizeImportedKnowledgeDocument>> => Boolean(item))
    : [];
  const response = await runAgentApiPipeline(question, requestedMode, userDocuments);
  return NextResponse.json(response);
}