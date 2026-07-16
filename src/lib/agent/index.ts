import { runMockRagPipeline } from "@/lib/rag";
import { createTicket, generateCustomerReply, queryOrder, queryProduct, searchPolicy } from "@/lib/tools";
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

function normalizedQuestionLength(question: string) {
  return question.replace(/[\s，。！？、,.!?]/g, "").length;
}

function isShortAmbiguousExpenseQuestion(question: string) {
  return hasAny(question, ["报销"]) && normalizedQuestionLength(question) <= 6 && !hasAny(question, ["差旅", "交通", "餐饮", "客户拜访", "项目", "发票", "票据", "付款凭证", "材料", "出差", "住宿", "机票", "打车"]);
}

function isShortAmbiguousLeaveQuestion(question: string) {
  return hasAny(question, ["请假", "休假"]) && normalizedQuestionLength(question) <= 6 && !hasAny(question, ["年假", "病假", "事假", "调休", "婚假", "产假", "几天", "日期", "提前"]);
}

function isShortAmbiguousApplicationQuestion(question: string) {
  return hasAny(question, ["怎么申请", "我要申请", "想申请"]) && normalizedQuestionLength(question) <= 8 && !hasAny(question, ["电脑", "VPN", "权限", "账号", "软件", "采购", "合同", "项目"]);
}

export function buildClarificationState(route: AgentRoute, question: string): ClarificationState {
  if (route.scenario === "enterprise" && route.intent === "knowledge_qa") {
    if (isShortAmbiguousExpenseQuestion(question)) {
      return {
        needsClarification: true,
        missingFields: ["expenseType"],
        clarificationQuestion: "你想报销哪类费用？例如差旅、交通、餐饮、客户拜访或项目费用。",
        usedDemoData: false,
        dataBoundaryNote: "当前问题只说明了报销意图，还不能判断适用的材料清单和审批流程。",
      };
    }

    if (isShortAmbiguousLeaveQuestion(question)) {
      return {
        needsClarification: true,
        missingFields: ["leaveType", "dateRange"],
        clarificationQuestion: "你想申请哪类假期？请补充假期类型、预计日期和天数。",
        usedDemoData: false,
        dataBoundaryNote: "当前问题只说明了请假意图，还不能判断提前申请时间、审批人和材料要求。",
      };
    }

    if (isShortAmbiguousApplicationQuestion(question)) {
      return {
        needsClarification: true,
        missingFields: ["applicationType"],
        clarificationQuestion: "你想申请什么事项？例如电脑、VPN、账号权限、软件授权或采购。",
        usedDemoData: false,
        dataBoundaryNote: "当前问题缺少申请事项，无法直接匹配具体流程。",
      };
    }
  }

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

  if (route.scenario === "recruitment" || route.intent === "jd_match") {
    return [];
  }

  if (route.intent === "order_query") {
    return clarification.needsClarification ? [] : ["queryOrder"];
  }

  if (route.intent === "product_query") {
    return clarification.needsClarification ? [] : ["queryProduct"];
  }

  if (route.intent === "policy_check") {
    return clarification.needsClarification ? ["searchPolicy"] : ["queryOrder", "searchPolicy"];
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
  if (!q) return { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.45, reason: "\u7528\u6237\u8f93\u5165\u4e3a\u7a7a\uff0c\u8fdb\u5165\u901a\u7528\u515c\u5e95\u3002" };

  const engineeringKeywords = ["Real API", "\u90e8\u7f72\u68c0\u67e5", "sourceType", "scoreReason", "Top sources", "\u7528\u6237\u6587\u6863", "\u9ed8\u8ba4\u77e5\u8bc6\u5e93", "\u6765\u6e90", "Prompt", "\u63d0\u793a\u8bcd", "RAG", "\u68c0\u7d22\u8d28\u91cf", "Agent", "\u5de5\u5177\u8c03\u7528", "\u7ed3\u6784\u5316\u8f93\u51fa", "JSON", "fallback", "API Key", "\u8bc4\u6d4b\u96c6", "\u53ef\u89c2\u6d4b\u6027", "\u65e5\u5fd7", "Schema", "\u6a21\u578b\u8fd4\u56de", "\u6a21\u578b\u8f93\u51fa", "\u89e3\u6790\u5931\u8d25", "\u4f4e\u7f6e\u4fe1", "\u53ec\u56de", "\u547d\u4e2d\u7387", "\u6765\u6e90\u5f15\u7528", "\u5411\u91cf\u5e93", "Embedding", "Evaluation", "\u6d4b\u8bd5\u96c6", "\u8bc4\u6d4b\u6307\u6807"];
  const recruitmentKeywords = ["JD", "\u5c97\u4f4d", "\u5c97", "\u7b80\u5386", "\u5339\u914d", "\u9762\u8bd5", "\u6c42\u804c", "\u62db\u8058", "\u5b9e\u4e60\u751f", "\u5019\u9009\u4eba", "AI \u4ea7\u54c1\u7ecf\u7406"];

  if (hasAny(q, engineeringKeywords) && !hasAny(q, recruitmentKeywords)) return { scenario: "ai_engineering", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.86, reason: "\u547d\u4e2d AI \u5de5\u7a0b\u89c4\u8303\u5173\u952e\u8bcd\uff0c\u4f18\u5148\u68c0\u7d22 ai-engineering \u77e5\u8bc6\u5e93\u5305\u3002" };
  if (hasAny(q, ["\u5ba2\u6237\u6570\u636e", "\u4fe1\u606f\u5b89\u5168", "\u8131\u654f", "\u6743\u9650", "VPN", "\u7535\u8111", "\u7535\u8111\u7533\u8bf7", "\u8d26\u53f7\u6743\u9650", "\u8f6f\u4ef6\u6388\u6743", "\u8fdc\u7a0b\u529e\u516c", "\u5165\u804c\u8bbe\u5907", "\u5408\u540c", "\u91c7\u8d2d", "\u9879\u76ee\u7acb\u9879", "SLA", "\u5165\u804c", "\u79bb\u804c", "\u5dee\u65c5", "\u52a0\u73ed", "\u8c03\u4f11", "P0 \u5de5\u5355", "P1 \u5de5\u5355", "P2 \u5de5\u5355", "P3 \u5de5\u5355", "\u5fc5\u987b\u54cd\u5e94", "\u591a\u4e45\u54cd\u5e94"])) return { scenario: "enterprise", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.86, reason: "\u547d\u4e2d\u4f01\u4e1a\u5236\u5ea6\u3001IT \u884c\u653f\u6216\u5b89\u5168\u6743\u9650\u5173\u952e\u8bcd\uff0c\u68c0\u7d22\u4f01\u4e1a\u77e5\u8bc6\u5e93\u3002" };
  if (hasAny(q, ["\u521b\u5efa\u5de5\u5355", "\u8f6c\u4eba\u5de5", "\u6295\u8bc9", "\u4f18\u5148\u7ea7", "\u5de5\u5355"])) { const scenario: AgentScenario = hasAny(q, ["\u552e\u540e", "\u8ba2\u5355", "\u9000\u8d27", "\u5ba2\u670d", "\u5ba2\u6237"]) ? "ecommerce" : "enterprise"; return { scenario, intent: "ticket_create", needRag: false, toolsNeeded: ["createTicket"], confidence: 0.88, reason: "\u547d\u4e2d\u5de5\u5355\u3001\u6295\u8bc9\u6216\u4f18\u5148\u7ea7\u5173\u952e\u8bcd\uff0c\u9700\u8981\u521b\u5efa\u8ddf\u8fdb\u5de5\u5355\u3002" }; }
  if (hasAny(q, ["\u5ba2\u670d\u56de\u590d", "\u600e\u4e48\u56de\u590d", "\u56de\u590d\u91cc", "\u8bdd\u672f"])) return { scenario: "ecommerce", intent: "after_sale_reply", needRag: true, toolsNeeded: ["generateCustomerReply"], confidence: 0.87, reason: "\u547d\u4e2d\u5ba2\u670d\u56de\u590d\u6216\u8bdd\u672f\u5173\u952e\u8bcd\uff0c\u9700\u8981\u7ed3\u5408\u552e\u540e\u89c4\u5219\u751f\u6210\u56de\u590d\u3002" };
  if (hasAny(q, ["\u8d28\u91cf\u95ee\u9898", "\u552e\u540e\u6d41\u7a0b", "\u4e3e\u8bc1", "\u51ed\u8bc1", "\u53d1\u9519", "\u53d1\u9519\u8d27", "\u6f0f\u53d1", "\u4f18\u60e0\u5238", "\u8865\u53d1", "\u4f1a\u5458\u6743\u76ca", "\u7269\u6d41\u5f02\u5e38"])) return { scenario: "ecommerce", intent: "policy_check", needRag: true, toolsNeeded: ["searchPolicy"], confidence: 0.88, reason: "\u547d\u4e2d\u552e\u540e\u653f\u7b56\u6216\u8fb9\u754c\u95ee\u9898\uff0c\u9700\u8981\u68c0\u7d22\u552e\u540e\u89c4\u5219\u3002" };
  if (hasAny(q, ["\u5546\u54c1", "\u5e93\u5b58", "\u5c3a\u7801", "\u4ef7\u683c", "\u63a8\u8350\u7801\u6570", "\u7801\u6570", "\u7f3a\u8d27", "\u6362\u8d27"])) { const intent: AgentIntent = hasAny(q, ["\u600e\u4e48\u56de\u590d", "\u5ba2\u6237\u8bf4", "\u56de\u590d"]) ? "after_sale_reply" : "product_query"; return { scenario: "ecommerce", intent, needRag: intent === "after_sale_reply", toolsNeeded: intent === "after_sale_reply" ? ["generateCustomerReply"] : ["queryProduct"], confidence: 0.86, reason: "\u547d\u4e2d\u5546\u54c1\u3001\u5e93\u5b58\u6216\u5c3a\u7801\u5173\u952e\u8bcd\uff0c\u8def\u7531\u5230\u7535\u5546\u5546\u54c1\u67e5\u8be2\u573a\u666f\u3002" }; }
  if (hasAny(q, ["\u8ba2\u5355", "\u9000\u8d27", "\u9000\u6b3e", "\u552e\u540e", "\u7b7e\u6536", "\u62c6\u5c01", "\u80fd\u4e0d\u80fd\u9000", "\u60f3\u9000", "\u4e0d\u559c\u6b22", "\u4e1c\u897f", "\u7269\u6d41", "\u4e03\u5929", "7 \u5929", "7\u5929", "\u8d28\u91cf\u95ee\u9898", "\u5ba2\u670d", "\u5ba2\u6237"])) { const intent: AgentIntent = hasAny(q, ["\u4ec0\u4e48\u65f6\u5019", "\u72b6\u6001", "\u7269\u6d41", "\u53d1\u8d27"]) ? "order_query" : "policy_check"; return { scenario: "ecommerce", intent, needRag: intent === "policy_check", toolsNeeded: intent === "order_query" ? ["queryOrder"] : ["queryOrder", "searchPolicy"], confidence: 0.9, reason: "\u547d\u4e2d\u8ba2\u5355\u3001\u9000\u8d27\u6216\u552e\u540e\u5173\u952e\u8bcd\uff0c\u9700\u8981\u7ed3\u5408\u8ba2\u5355\u5de5\u5177\u548c\u552e\u540e\u89c4\u5219\u5224\u65ad\u3002" }; }
  if (hasAny(q, recruitmentKeywords)) return { scenario: "general", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.58, reason: "\u8be5\u95ee\u9898\u5c5e\u4e8e\u5df2\u4e0b\u7ebf\u7684\u62db\u8058\u6c42\u804c\u4ea7\u54c1\u573a\u666f\uff0c\u4ec5\u4f5c\u901a\u7528\u77e5\u8bc6\u95ee\u7b54\u5e76\u68c0\u7d22\u7528\u6237\u81ea\u5b9a\u4e49\u6587\u6863\uff0c\u4e0d\u8c03\u7528\u62db\u8058\u4e13\u5c5e\u5de5\u5177\u3002" };
  if (hasAny(q, ["\u62a5\u9500", "\u5e74\u5047", "\u8bf7\u5047", "\u5236\u5ea6", "\u4fe1\u606f\u5b89\u5168", "\u516c\u53f8", "\u6750\u6599", "\u5dee\u65c5", "\u5408\u540c", "\u91c7\u8d2d", "\u9879\u76ee\u7acb\u9879", "SLA", "\u5165\u804c", "\u79bb\u804c", "\u5ba2\u6237\u6570\u636e", "\u5ba1\u6279"])) return { scenario: "enterprise", intent: "knowledge_qa", needRag: true, toolsNeeded: [], confidence: 0.84, reason: "\u547d\u4e2d\u516c\u53f8\u5236\u5ea6\u6216\u4f01\u4e1a\u6d41\u7a0b\u5173\u952e\u8bcd\uff0c\u9700\u8981 RAG \u68c0\u7d22\u3002" };
  return { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.42, reason: "\u672a\u547d\u4e2d\u5df2\u77e5\u4e1a\u52a1\u573a\u666f\uff0c\u8fdb\u5165\u901a\u7528\u515c\u5e95\u3002" };
}

function inferRagPackId(question: string, route: AgentRoute) {
  if (hasAny(question, ["Prompt", "\u63d0\u793a\u8bcd", "RAG", "\u68c0\u7d22\u8d28\u91cf", "Agent", "\u5de5\u5177\u8c03\u7528", "\u7ed3\u6784\u5316\u8f93\u51fa", "JSON", "fallback", "API Key", "\u8bc4\u6d4b\u96c6", "\u53ef\u89c2\u6d4b\u6027", "\u65e5\u5fd7", "Schema", "\u6a21\u578b\u8fd4\u56de", "\u6a21\u578b\u8f93\u51fa", "\u89e3\u6790\u5931\u8d25", "\u4f4e\u7f6e\u4fe1", "\u53ec\u56de", "\u547d\u4e2d\u7387", "\u6765\u6e90\u5f15\u7528", "\u5411\u91cf\u5e93", "Embedding", "Evaluation", "\u6d4b\u8bd5\u96c6", "\u8bc4\u6d4b\u6307\u6807", "sourceType", "scoreReason", "Top sources", "\u7528\u6237\u6587\u6863", "\u9ed8\u8ba4\u77e5\u8bc6\u5e93", "\u6765\u6e90", "Real API"])) return "ai-engineering" as const;
  if (route.scenario === "enterprise") return "enterprise-policy" as const;
  if (route.scenario === "ecommerce") return "ecommerce-support" as const;
  if (route.scenario === "ai_engineering") return "ai-engineering" as const;
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
    if (clarification.missingFields?.includes("expenseType")) {
      finalAnswer = "可以，我先确认一下报销类型。你想报销哪类费用？例如差旅、交通、餐饮、客户拜访或项目费用。不同费用对应的材料和审批链路会不一样，补充类型后我可以按对应制度帮你列出材料清单和注意事项。";
    } else if (clarification.missingFields?.includes("leaveType")) {
      finalAnswer = "可以，我需要先确认请假类型。请补充你要申请的是年假、病假、事假还是调休，以及预计日期和天数。确认后我可以帮你判断需要提前多久申请、是否需要证明材料，以及应走哪条审批流程。";
    } else if (clarification.missingFields?.includes("applicationType")) {
      finalAnswer = "可以，我需要先确认你要申请的事项。请说明是电脑、VPN、账号权限、软件授权、采购还是其他流程；确认后我可以按对应制度给出申请路径、审批人和材料要求。";
    } else if (route.intent === "product_query") {
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
  const retrievalClarification = buildClarificationState(route, question);
  const shouldSkipRagForClarification = route.scenario === "enterprise" && route.intent === "knowledge_qa" && Boolean(retrievalClarification.needsClarification);
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
  if (route.needRag && !shouldSkipRagForClarification) {
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
        output: { reason: shouldSkipRagForClarification ? "当前问题信息不足，先澄清报销、请假或申请类型，避免强行召回低相关来源。" : "当前 route 不需要 RAG。" },
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
