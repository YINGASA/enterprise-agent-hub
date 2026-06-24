import { NextResponse } from "next/server";
import { documents } from "@/data/mock";
import { runAgentPipeline } from "@/lib/agent";
import { callOpenAICompatibleChat, getLlmConfig } from "@/lib/llm";
import type { AgentApiMetadata, AgentApiResponse, AgentStep, AgentStructuredOutput, LlmMessage, LlmMode, ToolName } from "@/types";

export const runtime = "nodejs";

type AgentRequestBody = {
  question?: unknown;
  mode?: unknown;
};

function asMode(value: unknown): LlmMode {
  return value === "real" ? "real" : "mock";
}

function asQuestion(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "公司报销需要什么材料？";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toolArray(value: unknown): ToolName[] {
  const names: ToolName[] = ["queryOrder", "queryProduct", "searchPolicy", "createTicket", "analyzeJD", "generateCustomerReply"];
  return stringArray(value).filter((item): item is ToolName => names.includes(item as ToolName));
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStructuredOutput(value: Record<string, unknown>, fallback: AgentStructuredOutput): AgentStructuredOutput {
  return {
    scenario: value.scenario === "enterprise" || value.scenario === "ecommerce" || value.scenario === "recruitment" || value.scenario === "general" ? value.scenario : fallback.scenario,
    intent:
      value.intent === "knowledge_qa" ||
      value.intent === "policy_check" ||
      value.intent === "order_query" ||
      value.intent === "product_query" ||
      value.intent === "after_sale_reply" ||
      value.intent === "jd_match" ||
      value.intent === "ticket_create" ||
      value.intent === "general_chat"
        ? value.intent
        : fallback.intent,
    answer: typeof value.answer === "string" ? value.answer : fallback.answer,
    evidence: stringArray(value.evidence),
    toolsUsed: toolArray(value.toolsUsed),
    sources: stringArray(value.sources),
    confidence: numberValue(value.confidence, fallback.confidence),
    riskLevel: value.riskLevel === "low" || value.riskLevel === "medium" || value.riskLevel === "high" ? value.riskLevel : fallback.riskLevel,
    nextAction: typeof value.nextAction === "string" ? value.nextAction : fallback.nextAction,
  };
}

function makeLlmStep(status: AgentStep["status"], durationMs: number, input: Record<string, unknown>, output: Record<string, unknown>): AgentStep {
  return {
    id: "step-llm",
    name: "LLM structured generation",
    type: "response",
    status,
    input,
    output,
    durationMs: Math.max(1, durationMs),
  };
}

function buildMessages(question: string, pipeline: ReturnType<typeof runAgentPipeline>): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是 Enterprise Agent Hub 的企业 Agent。请严格基于 Router、RAG、工具调用结果回答。必须只输出 JSON 对象，字段包括 scenario, intent, answer, evidence, toolsUsed, sources, confidence, riskLevel, nextAction。不要输出 Markdown。",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          question,
          route: pipeline.route,
          rag: pipeline.ragAnswer
            ? {
                answer: pipeline.ragAnswer.answer,
                sources: pipeline.ragAnswer.sources,
                retrievedChunks: pipeline.ragAnswer.retrievedChunks.map((item) => ({
                  score: item.score,
                  matchedKeywords: item.matchedKeywords,
                  content: item.chunk.content,
                  sourceTitle: item.chunk.sourceTitle,
                })),
              }
            : null,
          toolResults: pipeline.toolResults,
          fallbackStructuredOutput: pipeline.structuredOutput,
        },
        null,
        2,
      ),
    },
  ];
}

function buildApiMetadata(base: Omit<AgentApiMetadata, "requestUrl" | "hasApiKey" | "maskedApiKey" | "apiKeyLength" | "hasProxy" | "proxyType" | "maskedProxyUrl" | "timeoutMs">): AgentApiMetadata {
  const config = getLlmConfig();
  return {
    ...base,
    requestUrl: config.requestUrl,
    hasApiKey: config.hasApiKey,
    maskedApiKey: config.maskedApiKey,
    apiKeyLength: config.apiKeyLength,
    hasProxy: config.hasProxy,
    proxyType: config.proxyType,
    maskedProxyUrl: config.maskedProxyUrl,
    timeoutMs: config.timeoutMs,
  };
}

export async function POST(request: Request) {
  let body: AgentRequestBody = {};
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    body = {};
  }

  const question = asQuestion(body.question);
  const requestedMode = asMode(body.mode);
  const pipeline = runAgentPipeline(question, documents);
  const config = getLlmConfig();

  if (requestedMode === "mock") {
    const response: AgentApiResponse = {
      ...pipeline,
      api: buildApiMetadata({
        requestedMode,
        responseMode: "mock",
        provider: "mock",
        model: "mock-agent",
      }),
    };
    return NextResponse.json(response);
  }

  const firstMissing = config.missing[0];
  if (firstMissing) {
    const response: AgentApiResponse = {
      ...pipeline,
      api: buildApiMetadata({
        requestedMode,
        responseMode: "fallback",
        provider: config.provider,
        model: config.model,
        fallbackReason: firstMissing,
        errorType: firstMissing,
        llmError: firstMissing,
      }),
    };
    return NextResponse.json(response);
  }

  const llmResult = await callOpenAICompatibleChat(buildMessages(question, pipeline), {
    temperature: 0.2,
    maxTokens: 800,
    responseFormat: "json_object",
  });

  if (llmResult.parsedJson) {
    const structuredOutput = normalizeStructuredOutput(llmResult.parsedJson, pipeline.structuredOutput);
    const response: AgentApiResponse = {
      ...pipeline,
      finalAnswer: structuredOutput.answer,
      structuredOutput,
      steps: [
        ...pipeline.steps,
        makeLlmStep(
          "success",
          llmResult.durationMs,
          { provider: llmResult.provider, model: llmResult.model, requestUrl: llmResult.requestUrl, hasProxy: llmResult.hasProxy, proxyType: llmResult.proxyType, maskedProxyUrl: llmResult.maskedProxyUrl, timeoutMs: llmResult.timeoutMs },
          { content: llmResult.content, parsedJson: llmResult.parsedJson, httpStatus: llmResult.httpStatus },
        ),
      ],
      api: buildApiMetadata({
        requestedMode,
        responseMode: "real",
        provider: llmResult.provider,
        model: llmResult.model,
        errorType: llmResult.errorType,
        llmDurationMs: llmResult.durationMs,
        llmError: llmResult.errorMessage,
      }),
    };
    return NextResponse.json(response);
  }

  const fallbackReason = llmResult.errorType ?? "llm_error";
  const response: AgentApiResponse = {
    ...pipeline,
    steps: [
      ...pipeline.steps,
      makeLlmStep(
        "failed",
        llmResult.durationMs,
        { provider: llmResult.provider, model: llmResult.model, requestUrl: llmResult.requestUrl, hasProxy: llmResult.hasProxy, proxyType: llmResult.proxyType, maskedProxyUrl: llmResult.maskedProxyUrl, timeoutMs: llmResult.timeoutMs },
        {
          errorType: llmResult.errorType,
          errorName: llmResult.errorName,
          errorMessage: llmResult.errorMessage,
          causeMessage: llmResult.causeMessage,
          causeCode: llmResult.causeCode,
          httpStatus: llmResult.httpStatus,
          statusText: llmResult.statusText,
          responseBodyPreview: llmResult.responseBodyPreview,
          content: llmResult.content,
        },
      ),
    ],
    api: buildApiMetadata({
      requestedMode,
      responseMode: "fallback",
      provider: llmResult.provider,
      model: llmResult.model,
      fallbackReason,
      errorType: llmResult.errorType,
      llmDurationMs: llmResult.durationMs,
      llmError: llmResult.errorMessage ?? llmResult.error ?? "LLM did not return parseable JSON.",
    }),
  };
  return NextResponse.json(response);
}
