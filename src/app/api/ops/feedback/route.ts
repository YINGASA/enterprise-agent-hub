import { NextResponse } from "next/server";
import { recordChatFeedback } from "@/lib/ops/storage";
import type { ChatAnswerFeedbackValue } from "@/types";

export const runtime = "nodejs";

type FeedbackBody = {
  question?: unknown;
  values?: unknown;
  reason?: unknown;
  responseMode?: unknown;
  scenario?: unknown;
  intent?: unknown;
  sourcesCount?: unknown;
};

const validFeedbackValues: ChatAnswerFeedbackValue[] = ["positive", "negative", "accurate", "inaccurate"];

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function POST(request: Request) {
  let body: FeedbackBody = {};
  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    body = {};
  }

  const values = Array.isArray(body.values)
    ? body.values.filter((item): item is ChatAnswerFeedbackValue => validFeedbackValues.includes(item as ChatAnswerFeedbackValue)).slice(0, 4)
    : [];

  if (!values.length) {
    return NextResponse.json({ ok: false, message: "缺少有效反馈标签。" }, { status: 400 });
  }

  await recordChatFeedback({
    question: stringValue(body.question),
    values,
    reason: stringValue(body.reason),
    responseMode: stringValue(body.responseMode, "unknown"),
    scenario: stringValue(body.scenario, "unknown"),
    intent: stringValue(body.intent, "unknown"),
    sourcesCount: numberValue(body.sourcesCount),
  });

  return NextResponse.json({ ok: true });
}
