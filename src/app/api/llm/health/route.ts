import { NextResponse } from "next/server";
import { callOpenAICompatibleChat, getLlmConfig } from "@/lib/llm";
import { realApiLimits } from "@/lib/ops/securityLimits";
import { checkRealApiRateLimit, getClientIp } from "@/lib/ops/rateLimit";
import type { LlmErrorType, LlmMessage } from "@/types";

export const runtime = "nodejs";

type HealthPayload = {
  configured: boolean;
  healthy: boolean;
  durationMs: number;
  statusCode?: number;
  errorType?: LlmErrorType | "rate_limited";
  message: string;
};

let cachedHealth: { expiresAt: number; payload: HealthPayload } | null = null;

function configErrorReason(missing: Array<"missing_api_key" | "missing_base_url" | "missing_model">): LlmErrorType | undefined {
  return missing[0];
}

function friendlyMessage(params: { configured: boolean; healthy: boolean; statusCode?: number; errorType?: LlmErrorType | "rate_limited" }) {
  if (!params.configured) return "Real API 当前未配置，请先在服务端环境变量中配置模型服务。";
  if (params.healthy) return "Real API 连接正常。";
  if (params.errorType === "rate_limited") return "连接检查过于频繁，请稍后再试。";
  if (params.statusCode === 403) return "Real API 连接失败：模型服务拒绝请求，请检查服务端配置和账户权限。";
  if (params.errorType === "timeout_error") return "Real API 连接失败：请求模型服务超时。";
  if (params.errorType === "network_error") return "Real API 连接失败：当前运行环境无法连接模型服务。";
  return "Real API 连接失败，请检查模型服务状态。";
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed", message: "请使用 POST 执行连接检查；公开状态请访问 /api/llm/status。" }, { status: 405 });
}

export async function POST(request: Request) {
  const config = getLlmConfig();
  if (!config.isConfigured) {
    const errorType = configErrorReason(config.missing);
    return NextResponse.json({ configured: false, healthy: false, durationMs: 0, errorType, message: friendlyMessage({ configured: false, healthy: false, errorType }) } satisfies HealthPayload);
  }

  const now = Date.now();
  if (cachedHealth && cachedHealth.expiresAt > now) return NextResponse.json({ ...cachedHealth.payload, cached: true });

  const rateLimit = checkRealApiRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    const payload: HealthPayload = {
      configured: true,
      healthy: false,
      durationMs: 0,
      errorType: "rate_limited",
      message: friendlyMessage({ configured: true, healthy: false, errorType: "rate_limited" }),
    };
    return NextResponse.json(payload, { status: 429 });
  }

  const startedAt = Date.now();
  const messages: LlmMessage[] = [
    { role: "system", content: "You are a health check. Return only JSON." },
    { role: "user", content: '{"ok":true,"message":"pong"}' },
  ];

  try {
    const result = await callOpenAICompatibleChat(messages, { temperature: 0, maxTokens: 64, responseFormat: "json_object" });
    const healthy = !result.errorType && Boolean(result.parsedJson);
    const payload: HealthPayload = {
      configured: true,
      healthy,
      durationMs: result.durationMs,
      statusCode: result.httpStatus,
      errorType: result.errorType,
      message: friendlyMessage({ configured: true, healthy, statusCode: result.httpStatus, errorType: result.errorType }),
    };
    cachedHealth = { expiresAt: Date.now() + realApiLimits.healthCacheMs, payload };
    return NextResponse.json(payload);
  } catch {
    const payload: HealthPayload = {
      configured: true,
      healthy: false,
      durationMs: Date.now() - startedAt,
      errorType: "network_error",
      message: friendlyMessage({ configured: true, healthy: false, errorType: "network_error" }),
    };
    cachedHealth = { expiresAt: Date.now() + realApiLimits.healthCacheMs, payload };
    return NextResponse.json(payload);
  }
}
