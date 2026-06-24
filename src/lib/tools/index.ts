import {
  afterSalePolicies,
  companyPolicies,
  jobDescriptions,
  orders,
  policyDocuments,
  products,
  sampleResume,
} from "@/data/mock";
import type { ToolName, ToolRunResult } from "@/types";

type Priority = "low" | "medium" | "high";

type PolicyMatch = {
  id: string;
  title: string;
  sourceType: "companyPolicy" | "policyDocument" | "afterSalePolicy";
  category: string;
  snippet: string;
  updatedAt: string;
};

type CustomerReplyContext = {
  type?: "return" | "size_advice" | "shipping_delay" | "quality_issue";
  orderId?: string;
  productId?: string;
  customerName?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function success<TData>(tool: ToolName, input: Record<string, unknown>, data: TData): ToolRunResult<TData> {
  return {
    status: "success",
    tool,
    input,
    data,
    executedAt: nowIso(),
  };
}

function failed(tool: ToolName, input: Record<string, unknown>, error: string): ToolRunResult {
  return {
    status: "failed",
    tool,
    input,
    error,
    executedAt: nowIso(),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string) {
  return value.toLowerCase();
}

function includesKeyword(source: string, keyword: string) {
  return normalize(source).includes(normalize(keyword));
}

function isPriority(value: string): value is Priority {
  return value === "low" || value === "medium" || value === "high";
}

export function queryOrder(orderId: string) {
  const input = { orderId };

  if (!orderId.trim()) {
    return failed("queryOrder", input, "缺少 orderId，无法查询订单。请输入有效订单 id。");
  }

  const order = orders.find((item) => item.id === orderId);
  if (!order) {
    return failed("queryOrder", input, `未找到订单 ${orderId}。`);
  }

  const product = products.find((item) => item.id === order.productId);

  return success("queryOrder", input, {
    orderId: order.id,
    user: order.user,
    status: order.status,
    product: product
      ? {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
        }
      : {
          id: order.productId,
          name: order.productName,
        },
    signedAt: order.signedAt,
    opened: order.opened,
    returnSupported: order.returnSupported,
    returnAdvice: order.returnSupported ? "当前订单满足基础退货条件，可继续核对签收时间与商品状态。" : "当前订单不满足无理由退货条件，建议转质量问题售后判断。",
  });
}

export function queryProduct(productId: string) {
  const input = { productId };

  if (!productId.trim()) {
    return failed("queryProduct", input, "缺少 productId，无法查询商品。请输入有效商品 id。");
  }

  const product = products.find((item) => item.id === productId);
  if (!product) {
    return failed("queryProduct", input, `未找到商品 ${productId}。`);
  }

  return success("queryProduct", input, {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    sizeAdvice: product.sizeAdvice,
    stock: product.stock,
    stockStatus: product.stock > 0 ? "in_stock" : "out_of_stock",
    sellingPoints: product.sellingPoints,
  });
}

export function searchPolicy(keyword: string) {
  const input = { keyword };
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return failed("searchPolicy", input, "缺少 keyword，无法检索政策。请输入制度、售后或流程关键词。");
  }

  const companyMatches: PolicyMatch[] = companyPolicies
    .filter((policy) => includesKeyword(`${policy.title} ${policy.summary} ${policy.rules.join(" ")}`, normalizedKeyword))
    .map((policy) => ({
      id: policy.id,
      title: policy.title,
      sourceType: "companyPolicy",
      category: policy.category,
      snippet: [policy.summary, ...policy.rules].join(" "),
      updatedAt: policy.updatedAt,
    }));

  const documentMatches: PolicyMatch[] = policyDocuments
    .filter((document) => includesKeyword(`${document.title} ${document.category} ${document.content}`, normalizedKeyword))
    .map((document) => ({
      id: document.id,
      title: document.title,
      sourceType: "policyDocument",
      category: document.category,
      snippet: document.content,
      updatedAt: document.updatedAt,
    }));

  const afterSaleMatches: PolicyMatch[] = afterSalePolicies
    .filter((policy) => includesKeyword(`${policy.title} ${policy.rules.join(" ")}`, normalizedKeyword))
    .map((policy) => ({
      id: policy.id,
      title: policy.title,
      sourceType: "afterSalePolicy",
      category: policy.category,
      snippet: policy.rules.join(" "),
      updatedAt: policy.updatedAt,
    }));

  const matches = [...companyMatches, ...documentMatches, ...afterSaleMatches];

  return success("searchPolicy", input, {
    keyword: normalizedKeyword,
    total: matches.length,
    matches,
    message: matches.length > 0 ? "已找到相关规则。" : "未命中相关规则，可尝试更换关键词。",
  });
}

export function createTicket(summary: string, priority: Priority = "medium") {
  const input = { summary, priority };

  if (!summary.trim()) {
    return failed("createTicket", input, "缺少 summary，无法创建工单。请提供问题摘要。");
  }

  if (!isPriority(priority)) {
    return failed("createTicket", input, "priority 仅支持 low、medium、high。");
  }

  const createdAt = nowIso();
  const ticketId = `TCK-${createdAt.slice(0, 10).replaceAll("-", "")}-${Math.floor(100 + Math.random() * 900)}`;

  return success("createTicket", input, {
    ticketId,
    summary,
    priority,
    status: "created",
    owner: priority === "high" ? "senior_support" : "support_queue",
    createdAt,
  });
}

export function analyzeJD(jdText: string, resumeText: string) {
  const input = { jdText, resumeText };

  if (!jdText.trim()) {
    return failed("analyzeJD", input, "缺少 jdText，无法进行 JD 匹配分析。");
  }

  if (!resumeText.trim()) {
    return failed("analyzeJD", input, "缺少 resumeText，无法进行 JD 匹配分析。");
  }

  const knownKeywords = Array.from(new Set(jobDescriptions.flatMap((job) => job.keywords)));
  const combinedResume = `${resumeText} ${sampleResume.summary} ${sampleResume.skills.join(" ")} ${sampleResume.projects.join(" ")}`;
  const jdKeywords = knownKeywords.filter((keyword) => includesKeyword(jdText, keyword));
  const matchedKeywords = jdKeywords.filter((keyword) => includesKeyword(combinedResume, keyword));
  const missingKeywords = jdKeywords.filter((keyword) => !matchedKeywords.includes(keyword));
  const baseScore = jdKeywords.length === 0 ? 55 : Math.round((matchedKeywords.length / jdKeywords.length) * 100);
  const matchScore = Math.min(96, Math.max(45, baseScore));

  return success("analyzeJD", input, {
    matchScore,
    matchedKeywords,
    gaps: missingKeywords.length > 0 ? missingKeywords : ["线上真实数据评测", "生产级监控与回滚策略"],
    strengths: ["具备 AI 应用产品化项目", "覆盖 RAG、Agent Router、Tool Calling 与结构化输出", "前端工程化和 B 端展示能力较完整"],
    suggestedKeywords: Array.from(new Set([...missingKeywords, "评测集", "失败案例分析", "工具调用协议"])),
  });
}

export function generateCustomerReply(context: CustomerReplyContext) {
  const input: Record<string, unknown> = { ...context };
  const customerName = context.customerName?.trim() || "您好";

  if (!context.type) {
    return failed("generateCustomerReply", input, "缺少 type，支持 return、size_advice、shipping_delay、quality_issue。");
  }

  if (context.type === "shipping_delay") {
    const orderResult = context.orderId ? queryOrder(context.orderId) : undefined;
    const orderData = orderResult?.data as { status?: string } | undefined;
    return success("generateCustomerReply", input, {
      reply: `${customerName}您好，很抱歉让您久等了。${context.orderId ? `订单 ${context.orderId}` : "您的订单"}当前状态为 ${orderData?.status ?? "处理中"}，我们会尽快安排发出，并持续跟进物流更新。`,
      replyType: "shipping_delay",
      tone: "friendly",
    });
  }

  if (context.type === "size_advice") {
    const product = context.productId ? products.find((item) => item.id === context.productId) : undefined;
    return success("generateCustomerReply", input, {
      reply: `${customerName}您好，${product ? `${product.name}的尺码建议是：${product.sizeAdvice}` : "建议您提供身高、体重和日常尺码，我们会帮您推荐合适尺码。"}`,
      replyType: "size_advice",
      tone: "helpful",
    });
  }

  if (context.type === "return") {
    return success("generateCustomerReply", input, {
      reply: `${customerName}您好，签收后 7 天内且商品不影响二次销售时，可申请 7 天无理由退货。若商品已拆封或属于特殊限制商品，我们会按售后规则进一步核实。`,
      replyType: "return",
      tone: "clear",
    });
  }

  if (context.type === "quality_issue") {
    return success("generateCustomerReply", input, {
      reply: `${customerName}您好，如果商品存在质量问题，请您上传照片或视频凭证。核实后我们会优先为您换货，缺货时可办理退款。`,
      replyType: "quality_issue",
      tone: "supportive",
    });
  }

  return failed("generateCustomerReply", input, "暂不支持该回复类型。");
}

export function runToolDemo(tool: ToolName, input: Record<string, unknown>): ToolRunResult {
  if (tool === "queryOrder") {
    return queryOrder(text(input.orderId));
  }

  if (tool === "queryProduct") {
    return queryProduct(text(input.productId));
  }

  if (tool === "searchPolicy") {
    return searchPolicy(text(input.keyword));
  }

  if (tool === "createTicket") {
    const priority = text(input.priority) || "medium";
    return createTicket(text(input.summary), isPriority(priority) ? priority : "medium");
  }

  if (tool === "analyzeJD") {
    return analyzeJD(text(input.jdText), text(input.resumeText));
  }

  return generateCustomerReply({
    type: text(input.type) as CustomerReplyContext["type"],
    orderId: text(input.orderId),
    productId: text(input.productId),
    customerName: text(input.customerName),
  });
}
