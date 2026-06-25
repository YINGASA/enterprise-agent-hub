"use client";

import { useMemo, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { SourceList } from "@/components/SourceList";
import type { AgentApiResponse, LlmMode } from "@/types";

const exampleGroups = [
  { title: "企业制度", questions: ["我出差回来想报销，应该准备哪些材料？", "年假连续休 6 天需要提前多久申请？", "客户数据要外发给供应商，需要注意什么？", "采购一个 SaaS 工具要走什么流程？", "合同盖章前需要哪些审批？", "P1 工单多久必须响应？"] },
  { title: "电商客服", questions: ["订单10001能不能退？", "客户买的衣服已经拆封了还能退吗？", "用户说尺码不合适但超过 7 天了，客服应该怎么回复？", "物流 48 小时没更新要怎么处理？", "商品P001还有库存吗？", "客户投诉要求主管介入，应该怎么升级？"] },
  { title: "招聘求职", questions: ["这个 AI 应用开发工程师 JD 和我的简历匹配吗？", "这个项目如果面试 AI 应用开发岗，最应该讲哪些技术点？", "我的简历还缺哪些 AI 项目关键词？", "RAG 知识库开发实习生会问什么？", "前端 AI 应用开发实习生看重哪些能力？", "如何把这个项目包装成一页简历 bullet？"] },
  { title: "AI 工程规范", questions: ["如果模型返回的 JSON 不合法，系统应该怎么处理？", "RAG 检索质量应该怎么评测？", "Agent 工具调用要注意哪些参数和幂等问题？", "API Key 为什么不能暴露在前端？", "fallback 机制在 AI 应用里有什么价值？", "Agent Trace 应该展示哪些可观测性字段？"] },
  { title: "兜底测试", questions: ["火星基地怎么申请？", "今天北京天气怎么样？", "推荐一家附近好吃的火锅店。", "帮我写一首关于海边的诗。", "股票明天会涨吗？", "这份知识库里有没有宇宙移民政策？"] },
];

const fallbackQuestion = exampleGroups[0].questions[0];

function formatValue(value: unknown) { return value === undefined || value === null || value === "" ? "无" : String(value); }
function responseModeLabel(mode: AgentApiResponse["api"]["responseMode"] | LlmMode) {
  const labels: Record<string, string> = { mock: "Mock", real: "Real JSON", real_repaired: "Real Repaired", real_text_fallback: "Real Text Fallback", fallback: "Mock Fallback" };
  return labels[mode] ?? mode;
}
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function packLabel(packId?: string) {
  const labels: Record<string, string> = { "enterprise-policy": "企业制度", "ecommerce-support": "电商客服与售后", "recruitment-career": "招聘求职", "ai-engineering": "AI 应用工程规范" };
  return packId ? labels[packId] ?? packId : "无";
}
function modeButtonClass(active: boolean) { return "min-h-10 rounded-md px-2 py-2 text-center text-sm font-semibold transition " + (active ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/70 hover:text-ink-900"); }
function exampleButtonClass(active: boolean) { return "w-full rounded-md border px-3 py-2 text-left text-xs leading-5 transition " + (active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-ink-600 hover:bg-brand-50"); }

export function AgentWorkspace() {
  const [question, setQuestion] = useState(fallbackQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [result, setResult] = useState<AgentApiResponse | null>(null);
  const [healthResult, setHealthResult] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [clientError, setClientError] = useState("");

  const selectedExample = useMemo(() => exampleGroups.flatMap((group) => group.questions).find((item) => item === question), [question]);
  const hitPacks = useMemo(() => unique(result?.ragAnswer?.retrievedChunks.map((item) => item.chunk.packId ?? "") ?? []), [result]);
  const scoreReasons = useMemo(() => result?.ragAnswer?.retrievedChunks.flatMap((item) => item.scoreReason?.map((reason) => item.chunk.sourceTitle + ": " + reason) ?? []) ?? [], [result]);
  const usedFallback = result ? result.api.responseMode === "fallback" || result.api.responseMode === "real_text_fallback" || result.route.intent === "general_chat" : false;

  async function handleRun() {
    setIsLoading(true);
    setClientError("");
    try {
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, mode }) });
      if (!response.ok) throw new Error("API request failed: " + response.status);
      setResult((await response.json()) as AgentApiResponse);
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Unknown client error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleHealthCheck() {
    setIsCheckingHealth(true);
    setClientError("");
    try {
      const response = await fetch("/api/llm/health", { method: "GET" });
      setHealthResult((await response.json()) as unknown);
    } catch (error) {
      setHealthResult({ ok: false, stage: "client_error", errorMessage: error instanceof Error ? error.message : "Unknown client error." });
    } finally {
      setIsCheckingHealth(false);
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,330px)_minmax(0,1fr)_minmax(320px,420px)]">
        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4"><h2 className="font-semibold text-ink-900">自由提问区</h2><p className="mt-1 text-sm leading-6 text-ink-500">你可以自由输入问题，不限于示例；系统会通过 Agent Router 判断场景，并决定是否调用 RAG、工具和 Real API。</p></div>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">{(["mock", "real"] as LlmMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={modeButtonClass(mode === item)}><span className="block truncate">{item === "mock" ? "Mock 模式" : "Real API 模式"}</span></button>)}</div>
          <button type="button" onClick={handleHealthCheck} disabled={isCheckingHealth} className="mb-4 min-h-10 w-full rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-ink-500">{isCheckingHealth ? "检查中..." : "检查 LLM 连接"}</button>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={6} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <button type="button" onClick={handleRun} disabled={isLoading} className="mt-3 min-h-10 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white">{isLoading ? "运行中..." : "运行 Agent Pipeline"}</button>
          {clientError ? <p className="mt-3 break-words rounded-md bg-rose-50 p-3 text-sm text-rose-700">{clientError}</p> : null}
          <div className="mt-5 space-y-4"><h3 className="text-sm font-semibold text-ink-900">示例问题分组</h3>{exampleGroups.map((group) => <div key={group.title}><p className="mb-2 text-xs font-semibold text-ink-500">{group.title}</p><div className="space-y-2">{group.questions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} className={exampleButtonClass(selectedExample === item)}><span className="block break-words">{item}</span></button>)}</div></div>)}</div>
        </aside>
        <main className="min-w-0 space-y-5">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold text-ink-900">最终回答</h2><p className="mt-1 break-words text-sm text-ink-500">问题：{result?.question ?? question}</p></div><span className="shrink-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{responseModeLabel(result?.api.responseMode ?? mode)}</span></div><p className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-sm leading-7 text-ink-700">{result?.finalAnswer ?? "选择模式并运行 Agent Pipeline 后会在这里展示最终回答。"}</p></section>
          {result ? <section className="grid min-w-0 gap-4 md:grid-cols-4"><div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">场景</p><p className="mt-2 break-words font-semibold text-ink-900">{result.route.scenario}</p></div><div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">意图</p><p className="mt-2 break-words font-semibold text-ink-900">{result.route.intent}</p></div><div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">置信度</p><p className="mt-2 font-semibold text-ink-900">{Math.round(result.route.confidence * 100)}%</p></div><div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">fallback</p><p className="mt-2 font-semibold text-ink-900">{usedFallback ? "是" : "否"}</p></div></section> : null}
          {result ? <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">RAG 检索解释</h2><div className="grid gap-3 text-sm text-ink-700 md:grid-cols-2"><p className="break-words">命中的知识库包：{hitPacks.length ? hitPacks.map(packLabel).join("、") : "无"}</p><p className="break-words">检索 chunk 数：{result.ragAnswer?.retrievedChunks.length ?? 0}</p><p className="break-words">是否使用 fallback：{usedFallback ? "是" : "否"}</p><p className="break-words">回答边界：当前为 mock/keyword RAG；无来源时应补充知识库或业务工具，不应编造。</p></div>{scoreReasons.length ? <div className="mt-3 flex flex-wrap gap-2">{scoreReasons.slice(0, 12).map((reason) => <span key={reason} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-ink-500 ring-1 ring-slate-200">{reason}</span>)}</div> : <p className="mt-3 text-sm text-ink-500">当前没有 RAG 检索评分原因。</p>}</section> : null}
          {result ? <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">LLM 状态</h2><div className="grid min-w-0 gap-3 text-sm text-ink-700 md:grid-cols-2"><p className="break-words">requestMode：{result.api.requestedMode}</p><p className="break-words">responseMode：{result.api.responseMode}</p><p className="break-words">provider：{result.api.provider}</p><p className="break-words">model：{result.api.model}</p><p className="break-all">requestUrl：{formatValue(result.api.requestUrl)}</p><p className="break-words">timeoutMs：{formatValue(result.api.timeoutMs)}</p><p className="break-words">durationMs：{result.api.llmDurationMs ? result.api.llmDurationMs + "ms" : "无"}</p><p className="break-words">errorType：{result.api.errorType ?? "无"}</p></div></section> : null}
          {healthResult ? <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">LLM 连接诊断</h2><pre className="max-h-[420px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(healthResult, null, 2)}</pre></section> : null}
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold text-ink-900">来源引用</h2><SourceList sources={result?.ragAnswer?.sources ?? []} /></section>
        </main>
        <div className="min-w-0"><AgentTracePanel result={result} /></div>
      </div>
    </div>
  );
}
