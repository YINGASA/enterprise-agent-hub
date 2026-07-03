import { documents } from "@/data/mock";
import { runAgentPipeline } from "@/lib/agent";
import { callOpenAICompatibleChat, getLlmConfig } from "@/lib/llm";
import type { AgentApiMetadata, AgentApiResponse, AgentStep, AgentStructuredOutput, ImportedKnowledgeDocument, LlmGenerateResult, LlmMessage, LlmMode, ToolName } from "@/types";

const validTools: ToolName[] = ["queryOrder", "queryProduct", "searchPolicy", "createTicket", "analyzeJD", "generateCustomerReply"];

export function asAgentMode(value: unknown): LlmMode {
  return value === "real" ? "real" : "mock";
}

export function asAgentQuestion(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "公司报销需要什么材料？";
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function stringArray(value: unknown, maxItems = 20): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, maxItems) : [];
}

function toolArray(value: unknown): ToolName[] {
  return stringArray(value).filter((item): item is ToolName => validTools.includes(item as ToolName));
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampConfidence(value: unknown, fallback: number) {
  return Math.max(0, Math.min(1, numberValue(value, fallback)));
}

function normalizeStructuredOutput(value: Record<string, unknown>, fallback: AgentStructuredOutput): AgentStructuredOutput {
  return {
    scenario: value.scenario === "enterprise" || value.scenario === "ecommerce" || value.scenario === "recruitment" || value.scenario === "ai_engineering" || value.scenario === "general" ? value.scenario : fallback.scenario,
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
    answer: truncate(typeof value.answer === "string" ? value.answer : fallback.answer, 200),
    evidence: stringArray(value.evidence, 5).map((item) => truncate(item, 120)),
    toolsUsed: toolArray(value.toolsUsed),
    sources: stringArray(value.sources, 5).map((item) => truncate(item, 80)),
    confidence: clampConfidence(value.confidence, fallback.confidence),
    riskLevel: value.riskLevel === "low" || value.riskLevel === "medium" || value.riskLevel === "high" ? value.riskLevel : fallback.riskLevel,
    nextAction: truncate(typeof value.nextAction === "string" ? value.nextAction : fallback.nextAction, 80),
    needsClarification: fallback.needsClarification ? (typeof value.needsClarification === "boolean" ? value.needsClarification : true) : false,
    missingFields: fallback.needsClarification ? (stringArray(value.missingFields, 8).length ? stringArray(value.missingFields, 8) : fallback.missingFields) : undefined,
    clarificationQuestion: fallback.needsClarification ? (typeof value.clarificationQuestion === "string" ? truncate(value.clarificationQuestion, 160) : fallback.clarificationQuestion) : undefined,
    usedDemoData: typeof value.usedDemoData === "boolean" ? value.usedDemoData : fallback.usedDemoData,
    dataBoundaryNote: fallback.needsClarification ? (typeof value.dataBoundaryNote === "string" ? truncate(value.dataBoundaryNote, 180) : fallback.dataBoundaryNote) : fallback.dataBoundaryNote,
  };
}

function buildTextFallbackStructuredOutput(text: string, fallback: AgentStructuredOutput): AgentStructuredOutput {
  return {
    ...fallback,
    answer: truncate(text.trim() || fallback.answer, 200),
    evidence: fallback.evidence.slice(0, 5),
    sources: fallback.sources.slice(0, 5),
    nextAction: "真实模型已返回文本，但结构化 JSON 解析失败，当前使用文本兜底。",
  };
}

function makeStep(params: {
  id: string;
  name: string;
  status: AgentStep["status"];
  durationMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}): AgentStep {
  return {
    id: params.id,
    name: params.name,
    type: "response",
    status: params.status,
    input: params.input,
    output: params.output,
    durationMs: Math.max(1, params.durationMs),
  };
}

function llmStepInput(result: LlmGenerateResult) {
  return {
    provider: result.provider,
    model: result.model,
    requestUrl: result.requestUrl,
    hasProxy: result.hasProxy,
    proxyType: result.proxyType,
    maskedProxyUrl: result.maskedProxyUrl,
    timeoutMs: result.timeoutMs,
  };
}

function buildMessages(question: string, pipeline: ReturnType<typeof runAgentPipeline>): LlmMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是 Enterprise Agent Hub 的企业 Agent。",
        "必须严格基于 Router、RAG、工具调用结果回答。",
        "只返回一个合法 JSON 对象，不要返回 Markdown，不要返回解释文字，不要使用 ```json 代码块。",
        "字段必须完整：scenario, intent, answer, evidence, toolsUsed, sources, confidence, riskLevel, nextAction。",
        "evidence、toolsUsed、sources 必须是字符串数组；confidence 必须是 0 到 1 的数字；riskLevel 只能是 low、medium 或 high。",
        "answer 控制在 200 字以内；evidence 最多 5 条；sources 最多 5 条；nextAction 控制在 80 字以内。",
        "If fallbackStructuredOutput.needsClarification is true, ask for missing information and never invent order/product facts.",
        "For clarification cases, preserve needsClarification, missingFields, clarificationQuestion, usedDemoData, and dataBoundaryNote in JSON.",
        "Do not say a specific order is refundable unless queryOrder returned an order from an explicit user-provided order id.",
        "If rag.retrievalConfidence is low or rag.lowConfidenceRetrieval is true, state that the knowledge base evidence is insufficient; do not invent sources or treat weak chunks as strong evidence.",
      ].join("\n"),
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
          clarificationPolicy: pipeline.structuredOutput.needsClarification
            ? "Missing key business parameters: clarify first, do not use or invent demo order/product facts, and do not make a deterministic refund judgment."
            : "If any tool input is marked as demo data, explicitly state that demo data does not represent a real order.",
        },
        null,
        2,
      ),
    },
  ];
}

function buildRepairMessages(rawContent: string, fallback: AgentStructuredOutput): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是 JSON 修复器。把用户提供的模型输出转换成一个合法 JSON 对象。不要改变语义。只返回 JSON，不要 Markdown，不要解释。字段必须是 scenario, intent, answer, evidence, toolsUsed, sources, confidence, riskLevel, nextAction。",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          rawContent: rawContent.slice(0, 3000),
          fallbackSchemaExample: fallback,
          constraints: {
            answerMaxChars: 200,
            maxEvidence: 5,
            maxSources: 5,
            nextActionMaxChars: 80,
            riskLevel: ["low", "medium", "high"],
          },
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

export async function runAgentApiPipeline(question: string, requestedMode: LlmMode, userDocuments: ImportedKnowledgeDocument[] = []): Promise<AgentApiResponse> {
  const pipelineDocuments = [...documents, ...userDocuments];
  const pipeline = runAgentPipeline(question, pipelineDocuments);
  const config = getLlmConfig();

  if (requestedMode === "mock") {
    return {
      ...pipeline,
      api: buildApiMetadata({
        requestedMode,
        responseMode: "mock",
        provider: "mock",
        model: "mock-agent",
      }),
    };
  }

  const firstMissing = config.missing[0];
  if (firstMissing) {
    return {
      ...pipeline,
      api: buildApiMetadata({
        requestedMode,
        responseMode: "real_error_fallback",
        provider: config.provider,
        model: config.model,
        fallbackReason: firstMissing,
        errorType: firstMissing,
        llmError: "Real API 未配置，当前展示的是系统兜底回答。",
      }),
    };
  }

  const llmResult = await callOpenAICompatibleChat(buildMessages(question, pipeline), {
    temperature: 0.1,
    maxTokens: 1200,
    responseFormat: "json_object",
  });

  if (llmResult.parsedJson) {
    const structuredOutput = normalizeStructuredOutput(llmResult.parsedJson, pipeline.structuredOutput);
    return {
      ...pipeline,
      finalAnswer: structuredOutput.answer,
      structuredOutput,
      steps: [
        ...pipeline.steps,
        makeStep({
          id: "step-llm",
          name: "LLM structured generation",
          status: "success",
          durationMs: llmResult.durationMs,
          input: llmStepInput(llmResult),
          output: { content: llmResult.content, parsedJson: llmResult.parsedJson, httpStatus: llmResult.httpStatus },
        }),
      ],
      api: buildApiMetadata({
        requestedMode,
        responseMode: "real",
        provider: llmResult.provider,
        model: llmResult.model,
        llmDurationMs: llmResult.durationMs,
      }),
    };
  }

  if (llmResult.errorType === "json_parse_error" && llmResult.content) {
    const repairResult = await callOpenAICompatibleChat(buildRepairMessages(llmResult.content, pipeline.structuredOutput), {
      temperature: 0,
      maxTokens: 1000,
      responseFormat: "json_object",
    });

    if (repairResult.parsedJson) {
      const structuredOutput = normalizeStructuredOutput(repairResult.parsedJson, pipeline.structuredOutput);
      return {
        ...pipeline,
        finalAnswer: structuredOutput.answer,
        structuredOutput,
        steps: [
          ...pipeline.steps,
          makeStep({
            id: "step-llm",
            name: "LLM structured generation",
            status: "success",
            durationMs: llmResult.durationMs,
            input: llmStepInput(llmResult),
            output: { content: llmResult.content, parseWarning: llmResult.parseError ?? llmResult.errorMessage, rawContentPreview: llmResult.rawContentPreview },
          }),
          makeStep({
            id: "step-llm-json-repair",
            name: "LLM JSON repair",
            status: "success",
            durationMs: repairResult.durationMs,
            input: llmStepInput(repairResult),
            output: { parsedJson: repairResult.parsedJson, content: repairResult.content },
          }),
        ],
        api: buildApiMetadata({
          requestedMode,
          responseMode: "real_repaired",
          provider: repairResult.provider,
          model: repairResult.model,
          errorType: "json_parse_error",
          llmDurationMs: llmResult.durationMs + repairResult.durationMs,
          parseError: llmResult.parseError ?? llmResult.errorMessage,
          rawContentPreview: llmResult.rawContentPreview,
        }),
      };
    }

    const structuredOutput = buildTextFallbackStructuredOutput(llmResult.content, pipeline.structuredOutput);
    return {
      ...pipeline,
      finalAnswer: llmResult.content,
      structuredOutput,
      steps: [
        ...pipeline.steps,
        makeStep({
          id: "step-llm",
          name: "LLM text generation",
          status: "success",
          durationMs: llmResult.durationMs,
          input: llmStepInput(llmResult),
          output: { content: llmResult.content, parseWarning: llmResult.parseError ?? llmResult.errorMessage, rawContentPreview: llmResult.rawContentPreview },
        }),
        makeStep({
          id: "step-llm-json-repair",
          name: "LLM JSON repair",
          status: "failed",
          durationMs: repairResult.durationMs,
          input: llmStepInput(repairResult),
          output: { errorType: repairResult.errorType, parseError: repairResult.parseError ?? repairResult.errorMessage, rawContentPreview: repairResult.rawContentPreview },
        }),
      ],
      api: buildApiMetadata({
        requestedMode,
        responseMode: "real_text_fallback",
        provider: llmResult.provider,
        model: llmResult.model,
        errorType: "json_parse_error",
        llmDurationMs: llmResult.durationMs + repairResult.durationMs,
        llmError: "真实模型已返回文本，但结构化 JSON 解析失败，当前使用文本兜底。",
        parseError: llmResult.parseError ?? llmResult.errorMessage,
        rawContentPreview: llmResult.rawContentPreview,
      }),
    };
  }

  const fallbackReason = llmResult.errorType ?? "llm_error";
  return {
    ...pipeline,
    steps: [
      ...pipeline.steps,
      makeStep({
        id: "step-llm",
        name: "LLM structured generation",
        status: "failed",
        durationMs: llmResult.durationMs,
        input: llmStepInput(llmResult),
        output: {
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
      }),
    ],
    api: buildApiMetadata({
      requestedMode,
      responseMode: "real_error_fallback",
      provider: llmResult.provider,
      model: llmResult.model,
      fallbackReason,
      errorType: llmResult.errorType,
      httpStatus: llmResult.httpStatus,
      statusText: llmResult.statusText,
      llmDurationMs: llmResult.durationMs,
      llmError: llmResult.httpStatus === 403
        ? "Real API 请求失败：模型服务拒绝请求，请检查部署环境变量、模型名称、Key 权限或账户额度。"
        : llmResult.errorMessage ?? llmResult.error ?? "Real API 请求失败，当前展示的是系统兜底回答。",
      parseError: llmResult.parseError,
      rawContentPreview: llmResult.rawContentPreview,
    }),
  };
}
