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

type ClarificationState = Pick<
  AgentStructuredOutput,
  "needsClarification" | "missingFields" | "clarificationQuestion" | "usedDemoData" | "dataBoundaryNote"
>;

const demoOrderId = "EAH20260618008";
const demoProductId = "SKU-AGENT-PLUS";

function hasAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function uniqueTools(tools: ToolName[]) {
  return Array.from(new Set(tools));
}

function getExplicitOrderId(question: string) {
  return question.match(/(?:\u8ba2\u5355|order)\s*([A-Za-z0-9-]+)/i)?.[1] ?? null;
}

function getExplicitProductId(question: string) {
  return question.match(/(?:\u5546\u54c1|sku|product)\s*([A-Za-z0-9-]+)/i)?.[1] ?? null;
}

function hasRefundIntent(question: string) {
  return hasAny(question, ["\u9000\u8d27", "\u9000\u6b3e", "\u552e\u540e", "\u600e\u4e48\u9000", "\u60f3\u9000", "\u4e0d\u559c\u6b22", "7\u5929\u65e0\u7406\u7531", "\u4e03\u5929\u65e0\u7406\u7531"]);
}

function buildClarificationState(route: AgentRoute, question: string): ClarificationState {
  if ((route.intent === "policy_check" || route.intent === "order_query") && hasRefundIntent(question) && !getExplicitOrderId(question)) {
    return {
      needsClarification: true,
      missingFields: ["orderId", "signedAt", "isOpened"],
      clarificationQuestion: "\u8bf7\u63d0\u4f9b\u8ba2\u5355\u53f7\u3001\u7b7e\u6536\u65f6\u95f4\u548c\u5546\u54c1\u662f\u5426\u62c6\u5c01\uff0c\u6211\u53ef\u4ee5\u7ee7\u7eed\u5e2e\u4f60\u5224\u65ad\u662f\u5426\u53ef\u9000\u3002",
      usedDemoData: false,
      dataBoundaryNote: "\u5f53\u524d\u672a\u83b7\u53d6\u5230\u8ba2\u5355\u53f7\u548c\u7b7e\u6536\u65f6\u95f4\uff0c\u56e0\u6b64\u53ea\u80fd\u63d0\u4f9b\u901a\u7528\u9000\u8d27\u6d41\u7a0b\uff0c\u4e0d\u80fd\u5224\u65ad\u8be5\u8ba2\u5355\u4e00\u5b9a\u53ef\u9000\u3002",
    };
  }

  if (route.intent === "product_query" && !getExplicitProductId(question)) {
    return {
      needsClarification: true,
      missingFields: ["productId", "productName"],
      clarificationQuestion: "\u8bf7\u63d0\u4f9b\u5546\u54c1\u7f16\u53f7\u6216\u5546\u54c1\u540d\u79f0\uff0c\u6211\u53ef\u4ee5\u7ee7\u7eed\u5e2e\u4f60\u67e5\u8be2\u5e93\u5b58\u3001\u5c3a\u7801\u5efa\u8bae\u6216\u4ef7\u683c\u4fe1\u606f\u3002",
      usedDemoData: false,
      dataBoundaryNote: "\u5f53\u524d\u672a\u83b7\u53d6\u5230\u5546\u54c1\u7f16\u53f7\u6216\u5546\u54c1\u540d\u79f0\uff0c\u56e0\u6b64\u4e0d\u80fd\u5224\u65ad\u5177\u4f53\u5546\u54c1\u5e93\u5b58\u6216\u5c3a\u7801\u5efa\u8bae\u3002",
    };
  }

  if (route.intent === "after_sale_reply" && hasRefundIntent(question) && !getExplicitOrderId(question)) {
    return {
      needsClarification: true,
      missingFields: ["orderId", "signedAt", "isOpened"],
      clarificationQuestion: "\u8bf7\u8865\u5145\u8ba2\u5355\u53f7\u3001\u7b7e\u6536\u65f6\u95f4\u548c\u5546\u54c1\u662f\u5426\u62c6\u5c01\uff1b\u5728\u6b64\u4e4b\u524d\u53ea\u80fd\u751f\u6210\u901a\u7528\u5ba2\u670d\u56de\u590d\u3002",
      usedDemoData: false,
      dataBoundaryNote: "\u5f53\u524d\u7f3a\u5c11\u8ba2\u5355\u72b6\u6001\u4fe1\u606f\uff0c\u53ea\u80fd\u63d0\u4f9b\u901a\u7528\u552e\u540e\u8bdd\u672f\uff0c\u4e0d\u80fd\u627f\u8bfa\u8be5\u8ba2\u5355\u4e00\u5b9a\u53ef\u9000\u3002",
    };
  }

  return { needsClarification: false, usedDemoData: false };
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

export function selectTools(route: AgentRoute, question: string): ToolName[] {
  const clarification = buildClarificationState(route, question);

  if (route.intent === "order_query") {
    return clarification.needsClarification ? [] : ["queryOrder"];
  }

  if (route.intent === "product_query") {
    return clarification.needsClarification ? [] : ["queryProduct"];
  }

  if (route.intent === "policy_check") {
    return clarification.needsClarification ? ["searchPolicy"] : ["queryOrder", "searchPolicy"];
  }

  if (route.intent === "jd_match") {
    return ["analyzeJD"];
  }

  if (route.intent === "ticket_create") {
    return ["createTicket"];
  }

  if (route.intent === "after_sale_reply") {
    return clarification.needsClarification ? [] : ["generateCustomerReply"];
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

  if (hasAny(q, ["Prompt", "提示词", "RAG", "检索质量", "Agent", "工具调用", "结构化输出", "JSON", "fallback", "API Key", "评测集", "可观测性", "日志", "Schema", "模型返回"]) && !hasAny(q, ["JD", "岗位", "岗", "简历", "匹配", "面试", "求职", "招聘", "实习生"])) {
    return {
      scenario: "general",
      intent: "knowledge_qa",
      needRag: true,
      toolsNeeded: [],
      confidence: 0.82,
      reason: "命中 AI 应用工程规范关键词，需要检索 ai-engineering 知识库包。",
    };
  }

  if (hasAny(q, ["客户数据", "信息安全", "脱敏", "权限", "合同", "采购", "项目立项", "SLA", "入职", "离职", "差旅", "加班", "调休", "P0 工单", "P1 工单", "P2 工单", "P3 工单", "必须响应", "多久响应"])) {
    return {
      scenario: "enterprise",
      intent: "knowledge_qa",
      needRag: true,
      toolsNeeded: [],
      confidence: 0.86,
      reason: "命中企业制度、流程或安全关键词，需要优先检索企业制度知识库。",
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

  if (hasAny(q, ["客服回复", "怎么回复", "回复里", "话术"])) {
    return {
      scenario: "ecommerce",
      intent: "after_sale_reply",
      needRag: true,
      toolsNeeded: ["generateCustomerReply"],
      confidence: 0.87,
      reason: "命中客服回复或话术关键词，需要结合售后规则生成回复。",
    };
  }

  if (hasAny(q, ["质量问题", "售后流程", "举证", "凭证"])) {
    return {
      scenario: "ecommerce",
      intent: "policy_check",
      needRag: true,
      toolsNeeded: ["queryOrder", "searchPolicy"],
      confidence: 0.88,
      reason: "命中质量问题或售后流程关键词，需要结合订单和售后政策判断。",
    };
  }

  if (hasAny(q, ["商品", "库存", "尺码", "价格", "推荐码数", "码数", "缺货", "换货"])) {
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

  if (hasAny(q, ["订单", "退货", "退款", "售后", "签收", "拆封", "能不能退", "物流", "七天", "7 天", "7天", "质量问题", "客服", "客户"])) {
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

  if (hasAny(q, ["JD", "岗位", "简历", "匹配", "面试", "求职", "招聘", "实习生", "大模型", "核心要求", "项目关键词"])) {
    return {
      scenario: "recruitment",
      intent: "jd_match",
      needRag: false,
      toolsNeeded: ["analyzeJD"],
      confidence: 0.86,
      reason: "命中岗位、简历或匹配关键词，路由到招聘求职场景。",
    };
  }

  if (hasAny(q, ["报销", "年假", "请假", "制度", "信息安全", "公司", "材料", "差旅", "合同", "采购", "项目立项", "SLA", "入职", "离职", "客户数据", "审批"])) {
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

function inferRagPackId(question: string, route: AgentRoute) {
  if (hasAny(question, ["Prompt", "提示词", "RAG", "检索质量", "Agent", "工具调用", "结构化输出", "JSON", "fallback", "API Key", "评测集", "可观测性", "日志", "Schema", "模型返回"])) {
    return "ai-engineering" as const;
  }

  if (route.scenario === "enterprise") return "enterprise-policy" as const;
  if (route.scenario === "ecommerce") return "ecommerce-support" as const;
  if (route.scenario === "recruitment") return "recruitment-career" as const;
  return undefined;
}

function extractOrderId(question: string): ParsedToolInput {
  const explicit = getExplicitOrderId(question);
  if (explicit?.includes("EAH")) {
    return { input: { orderId: explicit } };
  }

  if (explicit) {
    return {
      input: { orderId: demoOrderId },
      note: `\u7528\u6237\u63d0\u4f9b\u4e86\u8ba2\u5355\u53f7 ${explicit}\uff0c\u5f53\u524d mock \u6570\u636e\u6620\u5c04\u4e3a\u6f14\u793a\u8ba2\u5355 ${demoOrderId}\u3002`,
    };
  }

  return {
    input: {},
    note: "\u7f3a\u5c11\u8ba2\u5355\u53f7\uff0c\u5df2\u8df3\u8fc7\u8ba2\u5355\u67e5\u8be2\u5de5\u5177\uff0c\u907f\u514d\u628a demo \u8ba2\u5355\u5f53\u4f5c\u771f\u5b9e\u4e1a\u52a1\u4e8b\u5b9e\u3002",
  };
}

function extractProductId(question: string): ParsedToolInput {
  const explicit = getExplicitProductId(question);
  if (explicit?.startsWith("SKU-")) {
    return { input: { productId: explicit } };
  }

  if (explicit) {
    return {
      input: { productId: demoProductId },
      note: `\u7528\u6237\u63d0\u4f9b\u4e86\u5546\u54c1\u53f7 ${explicit}\uff0c\u5f53\u524d mock \u6570\u636e\u6620\u5c04\u4e3a\u6f14\u793a\u5546\u54c1 ${demoProductId}\u3002`,
    };
  }

  return {
    input: {},
    note: "\u7f3a\u5c11\u5546\u54c1\u7f16\u53f7\u6216\u5546\u54c1\u540d\u79f0\uff0c\u5df2\u8df3\u8fc7\u5546\u54c1\u67e5\u8be2\u5de5\u5177\uff0c\u907f\u514d\u628a demo \u5546\u54c1\u5f53\u4f5c\u771f\u5b9e\u4e1a\u52a1\u4e8b\u5b9e\u3002",
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
    const keyword = hasRefundIntent(question) ? "\u9000\u8d27 \u9000\u6b3e \u552e\u540e 7\u5929\u65e0\u7406\u7531 \u7b7e\u6536 \u62c6\u5c01" : question;
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
      type: hasAny(question, ["\u5c3a\u7801", "\u7801\u6570"]) ? "size_advice" : hasAny(question, ["\u8d28\u91cf"]) ? "quality_issue" : "return",
      productId: typeof productInput.input.productId === "string" ? productInput.input.productId : undefined,
      customerName: "\u5ba2\u6237",
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
  const clarification = buildClarificationState(route, question);

  let finalAnswer = "当前问题没有命中明确业务流程。根据现有 mock-agent 规则，我还不能确定答案，需要补充资料或改写问题。";

  if (clarification.needsClarification) {
    if (route.intent === "product_query") {
      finalAnswer = "\u6211\u73b0\u5728\u8fd8\u4e0d\u80fd\u67e5\u8be2\u5177\u4f53\u5546\u54c1\u5e93\u5b58\u6216\u5c3a\u7801\u5efa\u8bae\uff0c\u56e0\u4e3a\u95ee\u9898\u91cc\u6ca1\u6709\u5546\u54c1\u7f16\u53f7\u6216\u5546\u54c1\u540d\u79f0\u3002\u8bf7\u8865\u5145\u5546\u54c1\u7f16\u53f7\u6216\u540d\u79f0\u540e\uff0c\u6211\u53ef\u4ee5\u7ee7\u7eed\u67e5\u8be2\u3002\u5f53\u524d\u53ea\u80fd\u7ed9\u51fa\u901a\u7528\u5efa\u8bae\uff1a\u5148\u786e\u8ba4\u5546\u54c1\u6b3e\u5f0f\u3001\u89c4\u683c\u3001\u989c\u8272\u548c\u5c3a\u7801\uff0c\u518d\u6838\u5bf9\u5e93\u5b58\u72b6\u6001\u3002";
    } else if (route.intent === "after_sale_reply") {
      finalAnswer = "\u53ef\u4ee5\u5148\u7ed9\u5ba2\u6237\u4e00\u6bb5\u901a\u7528\u56de\u590d\uff0c\u4f46\u73b0\u5728\u7f3a\u5c11\u8ba2\u5355\u53f7\u3001\u7b7e\u6536\u65f6\u95f4\u548c\u5546\u54c1\u662f\u5426\u62c6\u5c01\uff0c\u4e0d\u80fd\u627f\u8bfa\u4e00\u5b9a\u53ef\u9000\u3002\u5efa\u8bae\u56de\u590d\uff1a\u6211\u4eec\u53ef\u4ee5\u5148\u5e2e\u60a8\u6838\u5bf9\u552e\u540e\u89c4\u5219\uff0c\u8bf7\u63d0\u4f9b\u8ba2\u5355\u53f7\u3001\u7b7e\u6536\u65f6\u95f4\u4ee5\u53ca\u5546\u54c1\u662f\u5426\u5df2\u62c6\u5c01\uff1b\u5982\u679c\u7b26\u5408 7 \u5929\u65e0\u7406\u7531\u6216\u8d28\u91cf\u95ee\u9898\u89c4\u5219\uff0c\u53ef\u5728\u8ba2\u5355\u8be6\u60c5\u4e2d\u7533\u8bf7\u552e\u540e/\u9000\u6b3e\u3002";
    } else {
      finalAnswer = "\u5982\u679c\u662f\u56e0\u4e3a\u4e0d\u559c\u6b22\u60f3\u9000\u6b3e\uff0c\u901a\u5e38\u9700\u8981\u5148\u786e\u8ba4\u662f\u5426\u7b26\u5408 7 \u5929\u65e0\u7406\u7531\u9000\u8d27\u89c4\u5219\u3002\u5f53\u524d\u4f60\u6ca1\u6709\u63d0\u4f9b\u8ba2\u5355\u53f7\u3001\u7b7e\u6536\u65f6\u95f4\u548c\u5546\u54c1\u662f\u5426\u62c6\u5c01\uff0c\u6240\u4ee5\u6211\u4e0d\u80fd\u76f4\u63a5\u5224\u65ad\u8be5\u8ba2\u5355\u4e00\u5b9a\u53ef\u9000\u3002\u4e00\u822c\u6d41\u7a0b\u662f\uff1a\u8fdb\u5165\u8ba2\u5355\u8be6\u60c5\uff0c\u9009\u62e9\u7533\u8bf7\u552e\u540e/\u9000\u6b3e\uff0c\u586b\u5199\u9000\u8d27\u539f\u56e0\uff0c\u7b49\u5f85\u5546\u5bb6\u5ba1\u6838\uff0c\u901a\u8fc7\u540e\u6309\u8981\u6c42\u5bc4\u56de\u5546\u54c1\u3002\u8bf7\u8865\u5145\u8ba2\u5355\u53f7\u548c\u5546\u54c1\u72b6\u6001\uff0c\u6211\u53ef\u4ee5\u7ee7\u7eed\u5e2e\u4f60\u5224\u65ad\u3002";
    }
  } else if (route.intent === "knowledge_qa") {
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
    finalAnswer = "已完成 JD 与 mock 简历的规则匹配分析，请查看 matchScore、匹配关键词、能力缺口和面试问题建议。大模型应用开发相关岗位会重点关注 RAG、Agent、Tool Calling、API 调用和项目经验。";
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
      nextAction: clarification.needsClarification ? clarification.clarificationQuestion ?? nextAction : nextAction,
      needsClarification: clarification.needsClarification,
      missingFields: clarification.missingFields,
      clarificationQuestion: clarification.clarificationQuestion,
      usedDemoData: clarification.usedDemoData,
      dataBoundaryNote: clarification.dataBoundaryNote,
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
    const ragQuestion = route.intent === "policy_check" ? `${question} 退货 售后 签收 拆封 7天无理由 质量问题` : question;
    ragAnswer = runMockRagPipeline(ragQuestion, documents, { topK: 4, packId: inferRagPackId(question, route), scenario: route.scenario });
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
