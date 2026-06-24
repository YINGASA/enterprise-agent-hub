import { jobDescriptions, sampleResume } from "@/data/mock";
import { runMockRagPipeline } from "@/lib/rag";
import { analyzeJD, createTicket, generateCustomerReply, queryOrder, queryProduct, searchPolicy } from "@/lib/tools";
import type {
  AgentIntent,
  AgentPipelineResult,
  AgentRoute,
  AgentScenario,
  AgentStep,
  AgentStructuredOutput,
  KnowledgeDocument,
  RagAnswer,
  ToolName,
  ToolRunResult,
} from "@/types";

type FinalAnswerParts = {
  finalAnswer: string;
  structuredOutput: AgentStructuredOutput;
};

type ParsedToolInput = {
  input: Record<string, unknown>;
  note?: string;
};

const demoOrderId = "EAH20260618008";
const demoProductId = "SKU-AGENT-PLUS";

function hasAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function uniqueTools(tools: ToolName[]) {
  return Array.from(new Set(tools));
}

function nowDuration(start: number) {
  return Math.max(1, Date.now() - start);
}

function makeStep(params: Omit<AgentStep, "durationMs"> & { startedAt: number }): AgentStep {
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    status: params.status,
    input: params.input,
    output: params.output,
    durationMs: nowDuration(params.startedAt),
  };
}

export function selectTools(route: AgentRoute, _question: string): ToolName[] {
  if (route.intent === "order_query") {
    return ["queryOrder"];
  }

  if (route.intent === "product_query") {
    return ["queryProduct"];
  }

  if (route.intent === "policy_check") {
    return ["queryOrder", "searchPolicy"];
  }

  if (route.intent === "jd_match") {
    return ["analyzeJD"];
  }

  if (route.intent === "ticket_create") {
    return ["createTicket"];
  }

  if (route.intent === "after_sale_reply") {
    return ["generateCustomerReply"];
  }

  return route.toolsNeeded;
}

export function routeUserQuestion(question: string): AgentRoute {
  const q = question.trim();

  if (!q) {
    return {
      scenario: "general",
      intent: "general_chat",
      needRag: false,
      toolsNeeded: [],
      confidence: 0.45,
      reason: "用户输入为空，进入通用兜底。",
    };
  }

  if (hasAny(q, ["创建工单", "转人工", "投诉", "优先级", "工单"])) {
    const scenario: AgentScenario = hasAny(q, ["售后", "订单", "退货", "客服", "客户"]) ? "ecommerce" : "enterprise";
    return {
      scenario,
      intent: "ticket_create",
      needRag: false,
      toolsNeeded: ["createTicket"],
      confidence: 0.88,
      reason: "命中工单、投诉或优先级关键词，需要创建跟进工单。",
    };
  }

  if (hasAny(q, ["商品", "库存", "尺码", "价格", "推荐码数", "码数"])) {
    const intent: AgentIntent = hasAny(q, ["怎么回复", "客户说", "回复"]) ? "after_sale_reply" : "product_query";
    return {
      scenario: "ecommerce",
      intent,
      needRag: intent === "after_sale_reply",
      toolsNeeded: selectToolsForIntent(intent),
      confidence: 0.86,
      reason: "命中商品、库存或尺码关键词，路由到电商商品/客服场景。",
    };
  }

  if (hasAny(q, ["订单", "退货", "退款", "售后", "签收", "拆封", "能不能退"])) {
    const intent: AgentIntent = hasAny(q, ["什么时候", "状态", "物流", "发货"]) ? "order_query" : "policy_check";
    return {
      scenario: "ecommerce",
      intent,
      needRag: intent === "policy_check",
      toolsNeeded: selectToolsForIntent(intent),
      confidence: 0.9,
      reason: "命中订单、退货或售后关键词，需要结合订单工具和售后规则判断。",
    };
  }

  if (hasAny(q, ["JD", "岗位", "简历", "匹配", "面试", "求职", "招聘"])) {
    return {
      scenario: "recruitment",
      intent: "jd_match",
      needRag: false,
      toolsNeeded: ["analyzeJD"],
      confidence: 0.86,
      reason: "命中岗位、简历或匹配关键词，路由到招聘求职场景。",
    };
  }

  if (hasAny(q, ["报销", "年假", "请假", "制度", "信息安全", "公司", "材料"])) {
    return {
      scenario: "enterprise",
      intent: "knowledge_qa",
      needRag: true,
      toolsNeeded: [],
      confidence: 0.84,
      reason: "命中企业制度或公司知识关键词，需要 RAG 检索知识库。",
    };
  }

  return {
    scenario: "general",
    intent: "general_chat",
    needRag: false,
    toolsNeeded: [],
    confidence: 0.5,
    reason: "未命中明确业务规则，进入通用兜底。",
  };
}

function selectToolsForIntent(intent: AgentIntent): ToolName[] {
  if (intent === "order_query") return ["queryOrder"];
  if (intent === "product_query") return ["queryProduct"];
  if (intent === "policy_check") return ["queryOrder", "searchPolicy"];
  if (intent === "jd_match") return ["analyzeJD"];
  if (intent === "ticket_create") return ["createTicket"];
  if (intent === "after_sale_reply") return ["generateCustomerReply"];
  return [];
}

function extractOrderId(question: string): ParsedToolInput {
  const explicit = question.match(/(?:订单|order)\s*([A-Za-z0-9-]+)/i)?.[1];
  if (explicit?.includes("EAH")) {
    return { input: { orderId: explicit } };
  }

  if (explicit) {
    return {
      input: { orderId: demoOrderId },
      note: `从问题中提取到订单号 ${explicit}，当前 mock 数据中映射为 demo 订单 ${demoOrderId}。`,
    };
  }

  return {
    input: { orderId: demoOrderId },
    note: `未提取到订单号，使用 fallback demo input: ${demoOrderId}。`,
  };
}

function extractProductId(question: string): ParsedToolInput {
  const explicit = question.match(/(?:商品|sku|product)\s*([A-Za-z0-9-]+)/i)?.[1];
  if (explicit?.startsWith("SKU-")) {
    return { input: { productId: explicit } };
  }

  if (explicit) {
    return {
      input: { productId: demoProductId },
      note: `从问题中提取到商品号 ${explicit}，当前 mock 数据中映射为 demo 商品 ${demoProductId}。`,
    };
  }

  return {
    input: { productId: demoProductId },
    note: `未提取到商品号，使用 fallback demo input: ${demoProductId}。`,
  };
}

function parseToolInput(tool: ToolName, question: string): ParsedToolInput {
  if (tool === "queryOrder") {
    return extractOrderId(question);
  }

  if (tool === "queryProduct") {
    return extractProductId(question);
  }

  if (tool === "searchPolicy") {
    const keyword = hasAny(question, ["退货", "退款", "签收", "拆封"]) ? "退货" : question;
    return { input: { keyword } };
  }

  if (tool === "createTicket") {
    return {
      input: {
        summary: question,
        priority: hasAny(question, ["高优先级", "紧急", "投诉"]) ? "high" : "medium",
      },
    };
  }

  if (tool === "analyzeJD") {
    return {
      input: {
        jdText: jobDescriptions[0]?.requirements.join(" ") ?? question,
        resumeText: `${sampleResume.summary} ${sampleResume.skills.join(" ")} ${sampleResume.projects.join(" ")}`,
      },
    };
  }

  const productInput = extractProductId(question);
  return {
    input: {
      type: hasAny(question, ["尺码", "码数"]) ? "size_advice" : hasAny(question, ["质量"]) ? "quality_issue" : "return",
      productId: String(productInput.input.productId ?? demoProductId),
      customerName: "客户",
    },
    note: productInput.note,
  };
}

function runTool(tool: ToolName, input: Record<string, unknown>): ToolRunResult {
  if (tool === "queryOrder") return queryOrder(String(input.orderId ?? ""));
  if (tool === "queryProduct") return queryProduct(String(input.productId ?? ""));
  if (tool === "searchPolicy") return searchPolicy(String(input.keyword ?? ""));
  if (tool === "createTicket") return createTicket(String(input.summary ?? ""), input.priority === "high" ? "high" : input.priority === "low" ? "low" : "medium");
  if (tool === "analyzeJD") return analyzeJD(String(input.jdText ?? ""), String(input.resumeText ?? ""));
  return generateCustomerReply({
    type: input.type === "size_advice" || input.type === "shipping_delay" || input.type === "quality_issue" || input.type === "return" ? input.type : "return",
    orderId: typeof input.orderId === "string" ? input.orderId : undefined,
    productId: typeof input.productId === "string" ? input.productId : undefined,
    customerName: typeof input.customerName === "string" ? input.customerName : undefined,
  });
}

function summarizeToolResult(result: ToolRunResult): string {
  if (result.status === "failed") {
    return `${result.tool} 调用失败：${result.error ?? "未知错误"}`;
  }

  return `${result.tool} 调用成功`;
}

export function generateMockAgentFinalAnswer(
  question: string,
  route: AgentRoute,
  ragAnswer: RagAnswer | null,
  toolResults: ToolRunResult[],
): FinalAnswerParts {
  const successfulTools = toolResults.filter((item) => item.status === "success").map((item) => item.tool);
  const evidence = [
    ...(ragAnswer?.retrievedChunks.slice(0, 2).map((item) => `${item.chunk.sourceTitle}: ${item.chunk.content}`) ?? []),
    ...toolResults.map(summarizeToolResult),
  ];
  const sources = ragAnswer?.sources.map((source) => source.title) ?? [];

  let finalAnswer = "当前问题没有命中明确业务流程。根据现有 mock-agent 规则，我还不能确定答案，需要补充资料或改写问题。";

  if (route.intent === "knowledge_qa") {
    finalAnswer = ragAnswer?.answer ?? "根据当前知识库资料，我还不能确定答案，需要补充相关企业制度文档。";
  } else if (route.intent === "policy_check") {
    finalAnswer = "该订单需要结合订单状态、签收时间、是否拆封以及售后规则判断。mock-agent 已调用订单查询和政策检索，请参考右侧工具结果与来源引用。";
  } else if (route.intent === "order_query") {
    finalAnswer = "已查询订单信息，请查看工具结果中的订单状态、商品和退货相关字段。";
  } else if (route.intent === "product_query") {
    finalAnswer = "已查询商品信息，请查看库存、价格、尺码建议和卖点字段。";
  } else if (route.intent === "after_sale_reply") {
    finalAnswer = "已根据售后场景生成 mock 客服回复，可结合 RAG 召回的售后规则进行人工确认。";
  } else if (route.intent === "jd_match") {
    finalAnswer = "已完成 JD 与 mock 简历的规则匹配分析，请查看 matchScore、匹配关键词和能力缺口。";
  } else if (route.intent === "ticket_create") {
    finalAnswer = "已模拟创建跟进工单，工单优先级和负责人由规则决定。";
  }

  const riskLevel: AgentStructuredOutput["riskLevel"] = route.confidence < 0.65 || toolResults.some((item) => item.status === "failed") ? "medium" : "low";
  const nextAction = route.intent === "general_chat" ? "建议补充业务背景或新增知识库资料" : "建议人工复核后用于业务回复或流程处理";

  return {
    finalAnswer,
    structuredOutput: {
      scenario: route.scenario,
      intent: route.intent,
      answer: finalAnswer,
      evidence,
      toolsUsed: uniqueTools(successfulTools),
      sources,
      confidence: route.confidence,
      riskLevel,
      nextAction,
    },
  };
}

export function runAgentPipeline(question: string, documents: KnowledgeDocument[]): AgentPipelineResult {
  const steps: AgentStep[] = [];
  const createdAt = new Date().toISOString();

  const routerStart = Date.now();
  const initialRoute = routeUserQuestion(question);
  const route: AgentRoute = {
    ...initialRoute,
    toolsNeeded: uniqueTools(selectTools(initialRoute, question)),
  };
  steps.push(
    makeStep({
      id: "step-router",
      name: "Agent Router 决策",
      type: "router",
      status: "success",
      input: { question },
      output: route,
      startedAt: routerStart,
    }),
  );

  let ragAnswer: RagAnswer | null = null;
  const ragStart = Date.now();
  if (route.needRag) {
    ragAnswer = runMockRagPipeline(question, documents);
    steps.push(
      makeStep({
        id: "step-rag",
        name: "RAG 知识库检索",
        type: "rag",
        status: ragAnswer.retrievedChunks.length > 0 ? "success" : "failed",
        input: { question, topK: 3 },
        output: { answer: ragAnswer.answer, retrievedChunks: ragAnswer.retrievedChunks, sources: ragAnswer.sources },
        startedAt: ragStart,
      }),
    );
  } else {
    steps.push(
      makeStep({
        id: "step-rag",
        name: "RAG 知识库检索",
        type: "rag",
        status: "skipped",
        input: { question },
        output: { reason: "当前 route 不需要 RAG。" },
        startedAt: ragStart,
      }),
    );
  }

  const toolResults: ToolRunResult[] = [];
  for (const tool of route.toolsNeeded) {
    const toolStart = Date.now();
    const parsed = parseToolInput(tool, question);
    const result = runTool(tool, parsed.input);
    toolResults.push(result);
    steps.push(
      makeStep({
        id: `step-tool-${tool}`,
        name: `工具调用：${tool}`,
        type: "tool",
        status: result.status,
        input: parsed.note ? { ...parsed.input, note: parsed.note } : parsed.input,
        output: result.error ? { error: result.error } : { result: result.data },
        startedAt: toolStart,
      }),
    );
  }

  if (route.toolsNeeded.length === 0) {
    const skippedStart = Date.now();
    steps.push(
      makeStep({
        id: "step-tool-skipped",
        name: "工具调用",
        type: "tool",
        status: "skipped",
        input: { question },
        output: { reason: "当前 route 不需要业务工具。" },
        startedAt: skippedStart,
      }),
    );
  }

  const responseStart = Date.now();
  const { finalAnswer, structuredOutput } = generateMockAgentFinalAnswer(question, route, ragAnswer, toolResults);
  steps.push(
    makeStep({
      id: "step-response",
      name: "生成最终回答",
      type: "response",
      status: "success",
      input: { route, ragUsed: Boolean(ragAnswer), toolsUsed: toolResults.map((item) => item.tool) },
      output: { finalAnswer, structuredOutput },
      startedAt: responseStart,
    }),
  );

  return {
    question,
    route,
    steps,
    ragAnswer,
    toolResults,
    finalAnswer,
    structuredOutput,
    createdAt,
    mode: "mock-agent",
  };
}
