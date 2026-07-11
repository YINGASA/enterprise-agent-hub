"use client";

import { useMemo, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { ChatRunHistoryPanel } from "@/components/ChatRunHistoryPanel";
import { SourceList } from "@/components/SourceList";
import { AgentFeedbackPanel } from "@/components/agent-workspace/AgentFeedbackPanel";
import { useAgentWorkspace } from "@/components/agent-workspace/useAgentWorkspace";
import type { AgentApiResponse, ChatAnswerFeedbackValue, KnowledgeSourceType, LlmMode, ToolName } from "@/types";

const exampleGroups = [
  { title: "企业制度", defaultOpen: true, questions: ["我出差回来想报销，应该准备哪些材料？", "年假连续休 6 天需要提前多久申请？", "客户数据要外发给供应商，需要注意什么？", "采购一个 SaaS 工具要走什么流程？", "合同盖章前需要哪些审批？", "P1 工单多久必须响应？"] },
  { title: "电商客服", defaultOpen: true, questions: ["订单10001能不能退？", "客户买的衣服已经拆封了还能退吗？", "用户说尺码不合适但超过 7 天了，客服应该怎么回复？", "物流 48 小时没更新要怎么处理？", "商品P001还有库存吗？", "客户投诉要求主管介入，应该怎么升级？"] },
  { title: "招聘求职", defaultOpen: false, questions: ["这个 AI 应用开发工程师 JD 和我的简历匹配吗？", "这个项目如果面试 AI 应用开发岗，最应该讲哪些技术点？", "我的简历还缺哪些 AI 项目关键词？", "RAG 知识库开发实习生会问什么？", "前端 AI 应用开发实习生看重哪些能力？", "如何把这个项目包装成一页简历 bullet？"] },
  { title: "AI 工程规范", defaultOpen: false, questions: ["如果模型返回的 JSON 不合法，系统应该怎么处理？", "RAG 检索质量应该怎么评测？", "Agent 工具调用要注意哪些参数和幂等问题？", "API Key 为什么不能暴露在前端？", "fallback 机制在 AI 应用里有什么价值？", "Agent Trace 应该展示哪些可观测性字段？"] },
  { title: "兜底测试", defaultOpen: false, questions: ["火星基地怎么申请？", "今天北京天气怎么样？", "推荐一家附近好吃的火锅店。", "帮我写一首关于海边的诗。", "股票明天会涨吗？", "这份知识库里有没有宇宙移民政策？"] },
];

const fallbackQuestion = exampleGroups[0].questions[0];

function responseModeLabel(mode: AgentApiResponse["api"]["responseMode"] | LlmMode) {
  const labels: Record<string, string> = { mock: "开发模拟模式", real: "真实模型生成", real_repaired: "真实模型生成 · JSON 修复", real_text_fallback: "真实模型生成 · 文本兜底", real_error_fallback: "Real API 失败，已使用兜底回答", fallback: "兜底模式" };
  return labels[mode] ?? mode;
}
function scenarioLabel(scenario?: string) {
  const labels: Record<string, string> = { enterprise: "企业知识库", ecommerce: "电商售后", recruitment: "招聘求职", "ai-engineering": "AI 工程规范", ai_engineering: "AI 工程规范", general: "通用兜底" };
  return scenario ? labels[scenario] ?? scenario : "未识别";
}
function intentLabel(intent?: string) {
  const labels: Record<string, string> = { knowledge_qa: "知识库问答", policy_check: "规则判断", order_query: "订单查询", product_query: "商品查询", after_sale_reply: "售后回复", jd_match: "JD 匹配", ticket_create: "工单创建", general_chat: "通用对话" };
  return intent ? labels[intent] ?? intent : "未识别";
}
function riskLabel(risk?: string) {
  const labels: Record<string, string> = { low: "低风险", medium: "中风险", high: "高风险" };
  return risk ? labels[risk] ?? risk : "未评估";
}
function toolLabel(tool: ToolName) {
  const labels: Record<ToolName, string> = { queryOrder: "订单查询", queryProduct: "商品查询", searchPolicy: "规则检索", createTicket: "工单创建", analyzeJD: "JD 匹配分析", generateCustomerReply: "客服回复生成" };
  return labels[tool] ?? tool;
}
function fieldLabel(field: string) {
  const labels: Record<string, string> = { orderId: "订单号", productId: "商品编号", productName: "商品名称", signedAt: "签收时间", isOpened: "是否拆封", returnReason: "退货原因", priority: "优先级", expenseType: "报销类型", leaveType: "假期类型", dateRange: "请假日期", applicationType: "申请事项" };
  return labels[field] ?? field;
}
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function sourceTypeLabel(sourceType?: KnowledgeSourceType) {
  const labels: Record<KnowledgeSourceType, string> = {
    default: "\u9ed8\u8ba4\u77e5\u8bc6\u5e93",
    user_upload: "\u7528\u6237\u4e0a\u4f20",
    user_paste: "\u7528\u6237\u7c98\u8d34",
  };
  return sourceType ? labels[sourceType] ?? sourceType : "\u9ed8\u8ba4\u77e5\u8bc6\u5e93";
}
function packLabel(packId?: string) {
  const labels: Record<string, string> = { "enterprise-policy": "企业 IT / 行政制度知识库", "ecommerce-support": "电商客服售后知识库", "recruitment-career": "招聘求职匹配知识库", "ai-engineering": "AI 工程规范知识库" };
  return packId ? labels[packId] ?? packId : "无";
}
function retrievalConfidenceLabel(confidence?: string) {
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return confidence ? labels[confidence] ?? confidence : "无";
}
function retrieverModeLabel(mode?: string) {
  const labels: Record<string, string> = { hybrid: "Hybrid 检索", mock_embedding: "Mock Embedding 检索", auto: "自动检索策略" };
  return mode ? labels[mode] ?? mode : "Hybrid 检索";
}
function yesNo(value: boolean) { return value ? "\u662f" : "\u5426"; }
function modeButtonClass(active: boolean) { return "min-h-10 rounded-md px-3 py-2 text-center text-sm font-semibold transition " + (active ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/70 hover:text-ink-900"); }
function exampleButtonClass(active: boolean) { return "rounded-md border px-3 py-2 text-left text-xs leading-5 transition " + (active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-ink-600 hover:bg-brand-50"); }
function formatTools(tools: ToolName[]) { return tools.length ? tools.map(toolLabel).join(" + ") : "未调用工具"; }
function toolStatusLabel(status?: string) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  return status ?? "未知";
}
function toolBusinessSummary(tool: AgentApiResponse["toolResults"][number]) {
  const input = tool.input ?? {};
  const data = tool.data as Record<string, unknown> | undefined;
  if (tool.tool === "queryOrder") return `查询订单 ${String(input.orderId ?? data?.orderId ?? "未提供")} 的状态、商品和售后条件。`;
  if (tool.tool === "queryProduct") return `查询商品 ${String(input.productId ?? data?.id ?? "未提供")} 的库存、尺码和卖点。`;
  if (tool.tool === "searchPolicy") return `检索关键词「${String(input.keyword ?? data?.keyword ?? "业务规则")}」相关的制度或售后规则。`;
  if (tool.tool === "createTicket") return `创建业务跟进工单，优先级为 ${String(input.priority ?? "medium")}。`;
  if (tool.tool === "analyzeJD") return "分析岗位 JD 与候选人经历的匹配度、优势和能力缺口。";
  if (tool.tool === "generateCustomerReply") return "根据售后上下文生成客服回复话术。";
  return "执行业务工具并返回结构化结果。";
}
function runtimeStatusClass(responseMode?: AgentApiResponse["api"]["responseMode"] | LlmMode) {
  if (responseMode === "real_error_fallback") return "bg-rose-50 text-rose-700 ring-rose-100";
  if (responseMode === "real" || responseMode === "real_repaired") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (responseMode === "mock") return "bg-slate-100 text-ink-700 ring-slate-200";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

export function AgentWorkspace() {
  const workspace = useAgentWorkspace(fallbackQuestion);
  const {
    question, setQuestion, mode, setMode, result, llmStatus, llmStatusError, healthResult,
    isLoading, isCheckingHealth, clientError, feedbackValues, feedbackReason, setFeedbackReason,
    feedbackMessage, realApiUnavailable, runAgent, checkHealth, toggleFeedback, saveFeedback,
  } = workspace;
  const [examplesPanelOpen, setExamplesPanelOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(exampleGroups.filter((group) => group.defaultOpen).map((group) => group.title));
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const selectedExample = useMemo(() => exampleGroups.flatMap((group) => group.questions).find((item) => item === question), [question]);
  const topTools = result?.toolResults.slice(0, 3) ?? [];
  const retrievedChunks = result?.ragAnswer?.retrievedChunks ?? [];
  const ragScores = retrievedChunks.map((item) => item.score);
  const maxRagScore = ragScores.length ? Math.max(...ragScores) : 0;
  const averageRagScore = ragScores.length ? Math.round(ragScores.reduce((sum, score) => sum + score, 0) / ragScores.length) : 0;
  const retrievalMetadata = result?.ragAnswer?.retrievalMetadata;
  const retrievalConfidence = result?.ragAnswer?.retrievalConfidence ?? retrievalMetadata?.retrievalConfidence;
  const expandedTerms = retrievalMetadata?.query.expandedKeywords.slice(0, 8) ?? [];
  const lowConfidenceRag = Boolean(result?.ragAnswer?.lowConfidenceRetrieval);
  const allSources = result?.ragAnswer?.sources ?? [];
  const sourceThreshold = maxRagScore >= 10 ? Math.max(8, Math.round(maxRagScore * 0.6)) : Number.POSITIVE_INFINITY;
  const reliableSources = lowConfidenceRag ? [] : allSources.filter((source) => (source.score ?? 0) >= sourceThreshold).slice(0, 4);
  const reliableDocumentIds = new Set(reliableSources.map((source) => source.documentId));
  const reliableChunks = retrievedChunks.filter((item) => reliableDocumentIds.has(item.chunk.documentId));
  const hitPacks = useMemo(() => unique(reliableChunks.map((item) => item.chunk.packId ?? "")), [reliableChunks]);
  const topSources = reliableSources.slice(0, 3);
  const defaultHitCount = unique(reliableChunks.filter((item) => (item.chunk.sourceType ?? "default") === "default").map((item) => item.chunk.documentId)).length;
  const userHitCount = unique(reliableChunks.filter((item) => item.chunk.sourceType === "user_upload" || item.chunk.sourceType === "user_paste").map((item) => item.chunk.documentId)).length;
  const topSourceTypes = unique(reliableChunks.slice(0, 5).map((item) => sourceTypeLabel(item.chunk.sourceType)));
  const scoreReasons = unique(reliableChunks.flatMap((item) => item.scoreReason ?? []).slice(0, 6));
  const noReliableRag = Boolean(result && (!result.ragAnswer || reliableSources.length === 0 || lowConfidenceRag));
  const retrieverMode = retrievalMetadata?.retrieverMode;
  const rerankEnabled = Boolean(retrievalMetadata?.rerankReason || retrievedChunks.some((item) => item.embeddingScore || item.scoreBreakdown?.embeddingScore));
  const embeddingScores = retrievedChunks.map((item) => item.embeddingScore ?? item.scoreBreakdown?.embeddingScore).filter((value): value is number => typeof value === "number");
  const maxEmbeddingScore = embeddingScores.length ? Math.max(...embeddingScores) : 0;
  const realErrorFallback = result?.api.responseMode === "real_error_fallback";
  const usedFallback = result ? result.api.responseMode === "fallback" || result.api.responseMode === "real_text_fallback" || result.api.responseMode === "real_error_fallback" || result.route.intent === "general_chat" : false;
  const loadingMessage = mode === "real" ? "正在执行 Router / RAG / Tools / LLM" : "正在执行开发模拟 Agent Pipeline";
  const missingFields = result?.structuredOutput.missingFields ?? [];
  const needsClarification = Boolean(result?.structuredOutput.needsClarification);
  const runButtonDisabled = isLoading || realApiUnavailable;
  const activeRuntimeLabel = mode === "real" ? "真实模型生成" : "开发模拟模式";
  const llmStatusText = llmStatus
    ? !llmStatus.configured
      ? "Real API：未配置"
      : healthResult?.healthy
        ? "Real API：连接正常"
        : healthResult && healthResult.healthy === false
          ? "Real API：连接失败"
          : "Real API：已配置，待验证"
    : llmStatusError || "正在检查 Real API 状态...";
  const generationSteps = [
    { label: "理解问题", active: isLoading || Boolean(result), detail: result ? `${scenarioLabel(result.route.scenario)} / ${intentLabel(result.route.intent)}` : "识别业务场景与任务意图" },
    { label: "检索依据", active: isLoading || Boolean(result), detail: result ? `${reliableSources.length} 条高相关来源` : "检索默认知识库与用户文档" },
    { label: "调用工具", active: isLoading || Boolean(result), detail: result ? formatTools(result.structuredOutput.toolsUsed) : "按需查询订单、商品或规则" },
    { label: "生成回答", active: isLoading || Boolean(result), detail: result ? responseModeLabel(result.api.responseMode) : activeRuntimeLabel },
  ];

  function toggleGroup(title: string) { setOpenGroups((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]); }
  function toggleMore(title: string) { setExpandedGroups((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]); }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 overflow-x-hidden">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="font-semibold text-ink-900">自由提问区</h2>
            <p className="mt-1 rounded-md bg-brand-50 p-3 text-sm leading-6 text-brand-700">你可以自由输入问题，不限于示例；系统会先执行 Agent Router、RAG 检索和业务工具，再优先使用真实模型生成回答。未配置模型服务时会自动使用开发模拟模式。</p>
          </div>
          <div className={healthResult?.healthy ? "rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-800" : llmStatus?.configured ? "rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800" : "rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-700"}>
            <p className="mt-1 break-words">{llmStatus?.configured ? "当前默认使用真实模型生成。系统会把高相关知识库来源、工具结果和边界信息传入模型，用于生成更接近真实业务助手的回答。" : "当前未配置模型服务，已使用开发模拟模式。该模式可离线验证 Agent Router、Hybrid RAG、Tool Calling、评测面板与 Trace 导出等核心能力。"}</p>
            <p className="mt-1 break-words">{llmStatusText}</p>
            <p className="mt-1 break-words">当前运行模式：{activeRuntimeLabel}</p>
            {realApiUnavailable ? <p className="mt-1 break-words">当前未启用 Real API，请使用开发模拟模式，或在部署环境配置模型服务后再切换。</p> : null}
          </div>
          <details data-testid="agent-mode-options" className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink-700">高级选项：运行模式</summary>
            <div className="mt-3 grid max-w-md grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
              {(["real", "mock"] as LlmMode[]).map((item) => <button key={item} type="button" data-testid={`agent-mode-${item}`} onClick={() => setMode(item)} disabled={item === "real" && llmStatus?.configured === false} className={modeButtonClass(mode === item)}><span className="block truncate">{item === "real" ? "真实模型生成" : "开发模拟模式"}</span></button>)}
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-500">开发模拟模式用于离线演示、回归测试和故障兜底；真实模型生成是配置模型服务后的默认产品路径。</p>
          </details>
          <textarea data-testid="agent-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button data-testid="agent-run" type="button" onClick={() => { setExamplesPanelOpen(false); void runAgent(); }} disabled={runButtonDisabled} className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white">{isLoading ? loadingMessage + "..." : realApiUnavailable ? "真实模型未配置，请切换开发模拟" : "生成回答"}</button>
            <button type="button" onClick={() => void checkHealth()} disabled={isCheckingHealth} className="min-h-10 rounded-md border border-brand-200 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-ink-500">{isCheckingHealth ? "检查中..." : "检查 LLM 连接"}</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {generationSteps.map((step) => (
              <div key={step.label} className={"rounded-md border p-3 text-sm " + (step.active ? "border-brand-100 bg-brand-50 text-brand-800" : "border-slate-200 bg-slate-50 text-ink-500")}>
                <div className="flex items-center gap-2">
                  <span className={"h-2.5 w-2.5 rounded-full " + (isLoading && step.active ? "animate-pulse bg-brand-600" : step.active ? "bg-brand-500" : "bg-slate-300")} />
                  <span className="font-semibold">{step.label}</span>
                </div>
                <p className="mt-1 break-words text-xs leading-5">{step.detail}</p>
              </div>
            ))}
          </div>
          {isLoading ? <p className="rounded-md bg-slate-50 p-3 text-sm text-ink-600">正在按顺序执行：问题理解、知识库检索、工具调用和回答生成。结果返回前不会暴露模型配置细节。</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold text-ink-900">最终回答</h2><p className="mt-1 break-words text-sm text-ink-500">问题：{result?.question ?? question}</p></div>
          <span className={"shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 " + runtimeStatusClass(result?.api.responseMode ?? mode)}>{responseModeLabel(result?.api.responseMode ?? mode)}</span>
        </div>
        {clientError ? <p className="mb-4 break-words rounded-md bg-rose-50 p-3 text-sm text-rose-700">运行失败：{clientError}</p> : null}
        {realErrorFallback ? <p className="mb-4 break-words rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-700">Real API 请求失败，当前展示的是系统兜底回答，不代表真实模型生成结果。{result?.api.httpStatus === 403 ? "403 通常表示 Key、模型权限、账户额度或模型名称配置存在问题。" : result?.api.llmError ? ` ${result.api.llmError}` : ""}</p> : null}
        {isLoading ? <div className="space-y-3 rounded-md bg-slate-50 p-4"><div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" /><div className="h-4 w-full animate-pulse rounded bg-slate-200" /><div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" /><p className="text-sm text-ink-500">{loadingMessage}...</p></div> : <p data-testid="agent-answer" className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-base leading-8 text-ink-800">{result?.finalAnswer ?? "输入问题并运行 Agent Pipeline 后，回答会显示在这里。"}</p>}
        {needsClarification ? <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900"><p className="font-semibold">{"\u9700\u8981\u8865\u5145\u4fe1\u606f"}</p>{missingFields.length ? <p className="mt-1 break-words">{"还需要你补充："}{missingFields.map(fieldLabel).join("、")}</p> : null}{result?.structuredOutput.clarificationQuestion ? <p className="mt-2 break-words"><span className="font-semibold">{"下一步请补充："}</span>{result.structuredOutput.clarificationQuestion}</p> : null}{result?.structuredOutput.dataBoundaryNote ? <p className="mt-1 break-words text-amber-800"><span className="font-semibold">{"回答边界："}</span>{result.structuredOutput.dataBoundaryNote}</p> : null}</div> : null}
        {result?.structuredOutput.usedDemoData ? <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm leading-6 text-ink-700">{"\u5f53\u524d\u4f7f\u7528\u6f14\u793a\u6570\u636e\uff0c\u4e0d\u4ee3\u8868\u771f\u5b9e\u8ba2\u5355\u3002"}</p> : null}
        {result && usedFallback && !needsClarification ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">{"\u5f53\u524d\u56de\u7b54\u4e3a\u8fb9\u754c\u515c\u5e95\uff1a\u7cfb\u7edf\u4f1a\u8bf4\u660e\u4e0d\u786e\u5b9a\u6027\uff0c\u4e0d\u4f1a\u7f16\u9020\u77e5\u8bc6\u5e93\u6216\u4e1a\u52a1\u5de5\u5177\u4e4b\u5916\u7684\u4fe1\u606f\u3002"}</p> : null}
        {noReliableRag ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">当前知识库中没有找到足够可靠的依据。建议上传相关制度、SOP 或 FAQ 文档后再提问；系统会避免把低相关片段包装成确定结论。</p> : null}
        {reliableSources.length ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">本次回答依据</h3>
                <p className="mt-1 text-xs text-ink-500">以下来源参与了本轮回答生成，可用于核对制度、流程或订单判断依据。</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-600">{reliableSources.length} 条高相关来源</span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {topSources.map((source, index) => (
                <article key={source.documentId} className="rounded-md bg-slate-50 p-3 text-sm leading-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">依据 {index + 1}</span>
                    <p className="break-words font-semibold text-ink-900">{source.title}</p>
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-ink-600 ring-1 ring-slate-200">{sourceTypeLabel(source.sourceType)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{source.category} · 相关度 {source.score ?? 0}</p>
                  {source.scoreReason?.length ? <p className="mt-2 break-words text-xs text-ink-500">为什么引用：{source.scoreReason.slice(0, 2).join(" / ")}</p> : null}
                  {source.contentPreview ? <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words rounded bg-white p-2 text-xs text-ink-600 ring-1 ring-slate-200">{source.contentPreview}</p> : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {result ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">业务场景 / 任务意图</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{scenarioLabel(result.route.scenario)} / {intentLabel(result.route.intent)}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">置信度 / 风险等级</p><p className="mt-1 text-sm font-semibold text-ink-900">{Math.round(result.route.confidence * 100)}% / {riskLabel(result.structuredOutput.riskLevel)}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">兜底回答 / 来源引用</p><p className="mt-1 text-sm font-semibold text-ink-900">{usedFallback ? "是" : "否"} / {reliableSources.length} 条</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">调用工具</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{formatTools(result.structuredOutput.toolsUsed)}</p></div></div> : null}
        {result ? <AgentFeedbackPanel values={feedbackValues} reason={feedbackReason} message={feedbackMessage} onToggle={toggleFeedback} onReasonChange={setFeedbackReason} onSubmit={() => void saveFeedback()} /> : null}
      </section>

      {result ? <section className="grid gap-5 lg:grid-cols-3"><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">{"\u77e5\u8bc6\u5e93\u4e0e RAG"}</h3><p className="mt-2 break-words text-sm text-ink-600">{"\u547d\u4e2d\u77e5\u8bc6\u5e93\u5305\uff1a"}{hitPacks.length ? hitPacks.map(packLabel).join("\u3001") : "\u65e0"}</p><p className="mt-2 text-sm text-ink-600">{"\u9ed8\u8ba4\u77e5\u8bc6\u5e93\u547d\u4e2d\uff1a"}{defaultHitCount}{" \u7bc7 \u00b7 \u7528\u6237\u6587\u6863\u547d\u4e2d\uff1a"}{userHitCount}{" \u7bc7"}</p><p className="mt-2 break-words text-sm text-ink-600">{"Top \u6765\u6e90\u7c7b\u578b\uff1a"}{topSourceTypes.length ? topSourceTypes.join("\u3001") : "\u65e0"}</p><p className="mt-2 text-sm text-ink-600">{"\u6700\u9ad8\u5206\uff1a"}{maxRagScore}{" \u00b7 \u5e73\u5747\u5206\uff1a"}{averageRagScore}</p><p className="mt-2 text-sm text-ink-600">{"\u68c0\u7d22\u6a21\u5f0f\uff1a"}{retrieverModeLabel(retrieverMode)}</p><p className="mt-2 text-sm text-ink-600">{"\u662f\u5426\u542f\u7528\u91cd\u6392\uff1a"}{yesNo(rerankEnabled)}</p><p className="mt-2 break-words text-sm text-ink-600">{"\u91cd\u6392\u539f\u56e0\uff1a"}{retrievalMetadata?.rerankReason ?? "\u65e0"}</p><p className="mt-2 text-sm text-ink-600">{"Embedding \u5206\u6570\uff1a"}{maxEmbeddingScore ? Math.round(maxEmbeddingScore * 10) / 10 : "\u65e0"}</p><p className="mt-2 text-sm text-ink-600">{"\u68c0\u7d22\u7f6e\u4fe1\u5ea6\uff1a"}{retrievalConfidenceLabel(retrievalConfidence)}</p><p className="mt-2 break-words text-sm text-ink-600">{"\u67e5\u8be2\u6269\u5c55\u8bcd\uff1a"}{expandedTerms.length ? expandedTerms.join(" / ") : "\u65e0"}</p>{lowConfidenceRag ? <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800">{"\u5f53\u524d\u77e5\u8bc6\u5e93\u76f8\u5173\u4f9d\u636e\u4e0d\u8db3\uff0c\u56de\u7b54\u5c06\u4ee5\u901a\u7528\u5efa\u8bae\u6216\u6f84\u6e05\u4e3a\u4e3b\u3002"}</p> : null}<p className="mt-2 break-words text-sm text-ink-500">{"\u8bc4\u5206\u539f\u56e0\uff1a"}{scoreReasons.length ? scoreReasons.join(" / ") : "\u6682\u65e0"}</p><p className="mt-2 text-sm text-ink-500">{"\u56de\u7b54\u8fb9\u754c\uff1a\u65e0\u53ef\u9760\u6765\u6e90\u65f6\uff0c\u7cfb\u7edf\u4f1a\u63d0\u793a\u8865\u5145\u77e5\u8bc6\u5e93\u6216\u4e1a\u52a1\u5de5\u5177\u3002"}</p></article><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">{"来源引用 / 业务工具"}</h3><div className="mt-3 space-y-3 text-sm text-ink-600">{topSources.length ? topSources.map((source) => <p key={source.documentId} className="break-words rounded-md bg-slate-50 p-2">{source.title}{" \u00b7 "}{sourceTypeLabel(source.sourceType)}{" \u00b7 \u5207\u7247 "}{source.chunkIndexes.join(", ")}</p>) : <p>{"\u6682\u65e0\u6765\u6e90"}</p>}{topTools.length ? topTools.map((tool) => <div key={tool.executedAt + tool.tool} className="rounded-md bg-brand-50 p-3 ring-1 ring-brand-100"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-brand-800">{toolLabel(tool.tool)}</p><span className={tool.status === "success" ? "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700" : "rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"}>{toolStatusLabel(tool.status)}</span></div><p className="mt-1 break-words text-xs leading-5 text-brand-800">{toolBusinessSummary(tool)}</p>{tool.error ? <p className="mt-1 break-words text-xs text-rose-700">{tool.error}</p> : null}</div>) : <p>{"暂未调用业务工具。系统会在需要订单、商品、规则或工单信息时自动调用。"}</p>}</div></article><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">{"LLM \u72b6\u6001\u6458\u8981"}</h3><div className="mt-3 space-y-2 text-sm text-ink-600"><p>{"\u8bf7\u6c42\u6a21\u5f0f\uff1a"}{result.api.requestedMode === "real" ? "真实模型生成" : "开发模拟模式"}</p><p>{"\u54cd\u5e94\u6a21\u5f0f\uff1a"}{responseModeLabel(result.api.responseMode)}</p><p>{"模型服务："}{result.api.responseMode === "mock" ? "开发模拟模式" : result.api.responseMode === "real_error_fallback" ? "Real API 失败，已兜底" : result.api.responseMode === "fallback" ? "兜底模式" : "真实模型生成"}</p><p>{"\u8017\u65f6\uff1a"}{result.api.llmDurationMs ? result.api.llmDurationMs + "ms" : "\u65e0"}</p><p className="break-words">{"\u9519\u8bef\u7c7b\u578b\uff1a"}{result.api.errorType ?? "\u65e0"}</p></div></article></section> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink-900">示例问题分组</h3>
            <p className="mt-1 text-sm text-ink-500">点击示例只会填入输入框，不会自动运行。首次运行后这里会默认折叠，避免挡住回答区域。</p>
          </div>
          <button type="button" onClick={() => setExamplesPanelOpen((open) => !open)} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700">{examplesPanelOpen ? "收起" : "展开"}</button>
        </div>
        {examplesPanelOpen ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exampleGroups.map((group) => {
          const open = openGroups.includes(group.title);
          const expanded = expandedGroups.includes(group.title);
          const visibleQuestions = expanded ? group.questions : group.questions.slice(0, 4);
          return (
            <div key={group.title} className="min-w-0 rounded-md border border-slate-200 bg-slate-50">
              <button type="button" onClick={() => toggleGroup(group.title)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold text-ink-700">
                <span>{group.title}</span><span>{open ? "收起" : "展开"}</span>
              </button>
              {open ? <div className="space-y-2 border-t border-slate-200 p-3">{visibleQuestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} className={exampleButtonClass(selectedExample === item)}><span className="block break-words">{item}</span></button>)}{group.questions.length > 4 ? <button type="button" onClick={() => toggleMore(group.title)} className="text-xs font-semibold text-brand-700">{expanded ? "收起更多" : "显示更多"}</button> : null}</div> : null}
            </div>
          );
        })}</div> : null}
      </section>

      <section className="space-y-4">
        <CollapsibleSection title="详细调试信息" description="默认折叠，需要排查或复盘时可展开查看完整 Agent Trace。" defaultOpen={false}><AgentTracePanel result={result} /></CollapsibleSection>
        {healthResult ? <CollapsibleSection title="LLM Health Diagnostic JSON" description="连接诊断 JSON 默认折叠，不挤占回答区域。" defaultOpen={false}><pre className="max-h-[420px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(healthResult, null, 2)}</pre></CollapsibleSection> : null}
        <CollapsibleSection title="来源引用完整列表" description="仅展示达到相关性阈值的 sources；原始召回可在 Trace 中查看。" defaultOpen={false}><SourceList sources={reliableSources} /></CollapsibleSection>
      </section>

      <ChatRunHistoryPanel currentResult={result} />
    </div>
  );
}
