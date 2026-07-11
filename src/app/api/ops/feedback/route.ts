import { NextResponse } from "next/server";
import { checkFeedbackRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import { recordChatFeedback, validateFeedbackRun } from "@/lib/ops/storage";
import type { ChatAnswerFeedbackValue } from "@/types";

export const runtime = "nodejs";

type FeedbackBody = {
  runId?: unknown;
  values?: unknown;
  reason?: unknown;
};

const validFeedbackValues: ChatAnswerFeedbackValue[] = ["positive", "negative", "accurate", "inaccurate"];
const maxReasonLength = 500;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let body: FeedbackBody;
  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ ok: false, message: "请求体不是合法 JSON。" }, { status: 400 });
  }

  const runId = stringValue(body.runId);
  if (!runId || runId.length > 80) return NextResponse.json({ ok: false, message: "运行标识无效或已过期。" }, { status: 400 });
  const values = Array.isArray(body.values)
    ? [...new Set(body.values.filter((item): item is ChatAnswerFeedbackValue => validFeedbackValues.includes(item as ChatAnswerFeedbackValue)))].slice(0, 4)
    : [];
  if (!values.length) return NextResponse.json({ ok: false, message: "缺少有效反馈标签。" }, { status: 400 });

  const reason = stringValue(body.reason);
  if (reason.length > maxReasonLength) return NextResponse.json({ ok: false, message: "反馈说明过长。" }, { status: 413 });

  const rateLimit = checkFeedbackRateLimit(getClientIp(request));
  if (!rateLimit.allowed) return NextResponse.json({ ok: false, errorType: "rate_limited", message: "反馈提交过于频繁，请稍后再试。" }, { status: 429 });

  const validation = await validateFeedbackRun(runId, values);
  if (!validation.ok) {
    const status = validation.reason === "duplicate" ? 409 : 400;
    const message = validation.reason === "duplicate" ? "本次运行的同类反馈已提交。" : "运行标识无效或已过期。";
    return NextResponse.json({ ok: false, error: validation.reason, message }, { status });
  }

  await recordChatFeedback({ run: validation.run, values, reason });
  return NextResponse.json({ ok: true });
}
