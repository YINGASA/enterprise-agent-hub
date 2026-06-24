import { NextResponse } from "next/server";
import { callOpenAICompatibleChat, getLlmConfig } from "@/lib/llm";
import type { LlmErrorType, LlmMessage } from "@/types";

function configErrorReason(missing: Array<"missing_api_key" | "missing_base_url" | "missing_model">): LlmErrorType | undefined {
  return missing[0];
}

export async function GET() {
  const config = getLlmConfig();
  const baseDiagnostics = {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    normalizedBaseUrl: config.normalizedBaseUrl,
    requestUrl: config.requestUrl,
    hasApiKey: config.hasApiKey,
    maskedApiKey: config.maskedApiKey,
    apiKeyLength: config.apiKeyLength,
  };

  if (!config.isConfigured) {
    return NextResponse.json({
      ok: false,
      stage: "config",
      reason: configErrorReason(config.missing),
      durationMs: 0,
      ...baseDiagnostics,
    });
  }

  const messages: LlmMessage[] = [
    { role: "system", content: "You are a health check." },
    { role: "user", content: 'Return JSON: {"ok":true,"message":"pong"}' },
  ];

  try {
    const result = await callOpenAICompatibleChat(messages, {
      temperature: 0,
      maxTokens: 64,
      responseFormat: "json_object",
    });

    return NextResponse.json({
      ok: !result.errorType && Boolean(result.parsedJson),
      stage: result.errorType ? result.errorType : "success",
      ...baseDiagnostics,
      durationMs: result.durationMs,
      httpStatus: result.httpStatus,
      statusText: result.statusText,
      rawContent: result.content.slice(0, 500),
      responseBodyPreview: result.responseBodyPreview,
      parsedJson: result.parsedJson,
      errorType: result.errorType,
      errorName: result.errorName,
      errorMessage: result.errorMessage,
      causeMessage: result.causeMessage,
      causeCode: result.causeCode,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "route_error",
      ...baseDiagnostics,
      durationMs: 0,
      errorType: "network_error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown health route error.",
    });
  }
}
