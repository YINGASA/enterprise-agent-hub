import { NextResponse } from "next/server";
import { callOpenAICompatibleChat, getLlmConfig } from "@/lib/llm";
import type { LlmErrorType, LlmMessage } from "@/types";

export const runtime = "nodejs";

function configErrorReason(missing: Array<"missing_api_key" | "missing_base_url" | "missing_model">): LlmErrorType | undefined {
  return missing[0];
}

function friendlyMessage(params: { configured: boolean; healthy: boolean; statusCode?: number; errorType?: LlmErrorType }) {
  if (!params.configured) {
    return "Real API 当前未配置，请先在服务端环境变量中配置模型服务。";
  }

  if (params.healthy) {
    return "Real API 连接正常。";
  }

  if (params.statusCode === 403) {
    return "Real API 连接失败：模型服务拒绝请求，请检查部署环境变量、模型名称、Key 权限或账户额度。";
  }

  if (params.errorType === "network_error") {
    return "Real API 连接失败：当前网络无法连接模型服务，请检查运行环境网络访问能力。";
  }

  if (params.errorType === "http_error") {
    return "Real API 连接失败：模型服务返回错误，请检查服务配置、模型权限或账户状态。";
  }

  return "Real API 连接失败，请检查模型服务配置。";
}

export async function GET() {
  const config = getLlmConfig();
  const startedAt = Date.now();

  if (!config.isConfigured) {
    const errorType = configErrorReason(config.missing);
    return NextResponse.json({
      configured: false,
      healthy: false,
      durationMs: 0,
      errorType,
      message: friendlyMessage({ configured: false, healthy: false, errorType }),
    });
  }

  const messages: LlmMessage[] = [
    { role: "system", content: "You are a health check. Return only JSON." },
    { role: "user", content: '{"ok":true,"message":"pong"}' },
  ];

  try {
    const result = await callOpenAICompatibleChat(messages, {
      temperature: 0,
      maxTokens: 64,
      responseFormat: "json_object",
    });
    const healthy = !result.errorType && Boolean(result.parsedJson);

    return NextResponse.json({
      configured: true,
      healthy,
      durationMs: result.durationMs,
      statusCode: result.httpStatus,
      errorType: result.errorType,
      message: friendlyMessage({ configured: true, healthy, statusCode: result.httpStatus, errorType: result.errorType }),
    });
  } catch {
    const errorType: LlmErrorType = "network_error";
    return NextResponse.json({
      configured: true,
      healthy: false,
      durationMs: Date.now() - startedAt,
      errorType,
      message: friendlyMessage({ configured: true, healthy: false, errorType }),
    });
  }
}
