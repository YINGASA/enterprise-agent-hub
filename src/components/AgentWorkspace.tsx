"use client";

import { useMemo, useState } from "react";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { SourceList } from "@/components/SourceList";
import type { AgentApiResponse, LlmMode, ToolName } from "@/types";

const exampleGroups = [
  { title: "企业制度", defaultOpen: true, questions: ["我出差回来想报销，应该准备哪些材料？", "年假连续休 6 天需要提前多久申请？", "客户数据要外发给供应商，需要注意什么？", "采购一个 SaaS 工具要走什么流程？", "合同盖章前需要哪些审批？", "P1 工单多久必须响应？"] },
  { title: "电商客服", defaultOpen: true, questions: ["订单10001能不能退？", "客户买的衣服已经拆封了还能退吗？", "用户说尺码不合适但超过 7 天了，客服应该怎么回复？", "物流 48 小时没更新要怎么处理？", "商品P001还有库存吗？", "客户投诉要求主管介入，应该怎么升级？"] },
  { title: "招聘求职", defaultOpen: false, questions: ["这个 AI 应用开发工程师 JD 和我的简历匹配吗？", "这个项目如果面试 AI 应用开发岗，最应该讲哪些技术点？", "我的简历还缺哪些 AI 项目关键词？", "RAG 知识库开发实习生会问什么？", "前端 AI 应用开发实习生看重哪些能力？", "如何把这个项目包装成一页简历 bullet？"] },
  { title: "AI 工程规范", defaultOpen: false, questions: ["如果模型返回的 JSON 不合法，系统应该怎么处理？", "RAG 检索质量应该怎么评测？", "Agent 工具调用要注意哪些参数和幂等问题？", "API Key 为什么不能暴露在前端？", "fallback 机制在 AI 应用里有什么价值？", "Agent Trace 应该展示哪些可观测性字段？"] },
  { title: "兜底测试", defaultOpen: false, questions: ["火星基地怎么申请？", "今天北京天气怎么样？", "推荐一家附近好吃的火锅店。", "帮我写一首关于海边的诗。", "股票明天会涨吗？", "这份知识库里有没有宇宙移民政策？"] },
];

const fallbackQuestion = exampleGroups[0].questions[0];

function responseModeLabel(mode: AgentApiResponse["api"]["responseMode"] | LlmMode) {
  const labels: Record<string, string> = { mock: "Mock", real: "Real JSON", real_repaired: "Real Repaired", real_text_fallback: "Real Text Fallback", fallback: "Mock Fallback" };
  return labels[mode] ?? mode;
}
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))); }
function packLabel(packId?: string) {
  const labels: Record<string, string> = { "enterprise-policy": "企业制度", "ecommerce-support": "电商客服与售后", "recruitment-career": "招聘求职", "ai-engineering": "AI 应用工程规范" };
  return packId ? labels[packId] ?? packId : "无";
}
function modeButtonClass(active: boolean) { return "min-h-10 rounded-md px-3 py-2 text-center text-sm font-semibold transition " + (active ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/70 hover:text-ink-900"); }
function exampleButtonClass(active: boolean) { return "rounded-md border px-3 py-2 text-left text-xs leading-5 transition " + (active ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-ink-600 hover:bg-brand-50"); }
function formatTools(tools: ToolName[]) { return tools.length ? tools.join(" + ") : "无"; }

export function AgentWorkspace() {
  const [question, setQuestion] = useState(fallbackQuestion);
  const [mode, setMode] = useState<LlmMode>("mock");
  const [result, setResult] = useState<AgentApiResponse | null>(null);
  const [healthResult, setHealthResult] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [clientError, setClientError] = useState("");
  const [examplesPanelOpen, setExamplesPanelOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(exampleGroups.filter((group) => group.defaultOpen).map((group) => group.title));
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const selectedExample = useMemo(() => exampleGroups.flatMap((group) => group.questions).find((item) => item === question), [question]);
  const hitPacks = useMemo(() => unique(result?.ragAnswer?.retrievedChunks.map((item) => item.chunk.packId ?? "") ?? []), [result]);
  const topSources = result?.ragAnswer?.sources.slice(0, 3) ?? [];
  const topTools = result?.toolResults.slice(0, 3) ?? [];
  const ragScores = result?.ragAnswer?.retrievedChunks.map((item) => item.score) ?? [];
  const maxRagScore = ragScores.length ? Math.max(...ragScores) : 0;
  const averageRagScore = ragScores.length ? Math.round(ragScores.reduce((sum, score) => sum + score, 0) / ragScores.length) : 0;
  const usedFallback = result ? result.api.responseMode === "fallback" || result.api.responseMode === "real_text_fallback" || result.route.intent === "general_chat" : false;
  const loadingMessage = mode === "real" ? "正在执行 Router / RAG / Tools / LLM" : "正在执行 Mock Agent Pipeline";


  async function handleRun() {
    setIsLoading(true);
    setClientError("");
    setExamplesPanelOpen(false);
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

  function toggleGroup(title: string) { setOpenGroups((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]); }
  function toggleMore(title: string) { setExpandedGroups((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title]); }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 overflow-x-hidden">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="font-semibold text-ink-900">自由提问区</h2>
            <p className="mt-1 rounded-md bg-brand-50 p-3 text-sm leading-6 text-brand-700">你可以自由输入问题，不限于示例；系统会通过 Agent Router 判断场景，并决定是否调用 RAG、业务工具和 Real API / Mock 模式。</p>
          </div>
          <div className="grid max-w-sm grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 text-sm">
            {(["mock", "real"] as LlmMode[]).map((item) => <button key={item} type="button" onClick={() => setMode(item)} className={modeButtonClass(mode === item)}><span className="block truncate">{item === "mock" ? "Mock 模式" : "Real API 模式"}</span></button>)}
          </div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={handleRun} disabled={isLoading} className="min-h-10 rounded-md bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white">{isLoading ? loadingMessage + "..." : "运行 Agent Pipeline"}</button>
            <button type="button" onClick={handleHealthCheck} disabled={isCheckingHealth} className="min-h-10 rounded-md border border-brand-200 bg-brand-50 px-5 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-ink-500">{isCheckingHealth ? "检查中..." : "检查 LLM 连接"}</button>
          </div>
          {isLoading ? <p className="rounded-md bg-slate-50 p-3 text-sm text-ink-600">{loadingMessage}</p> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold text-ink-900">最终回答</h2><p className="mt-1 break-words text-sm text-ink-500">问题：{result?.question ?? question}</p></div>
          <span className="shrink-0 rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{responseModeLabel(result?.api.responseMode ?? mode)}</span>
        </div>
        {clientError ? <p className="mb-4 break-words rounded-md bg-rose-50 p-3 text-sm text-rose-700">运行失败：{clientError}</p> : null}
        {isLoading ? <div className="space-y-3 rounded-md bg-slate-50 p-4"><div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" /><div className="h-4 w-full animate-pulse rounded bg-slate-200" /><div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" /><p className="text-sm text-ink-500">{loadingMessage}...</p></div> : <p className="whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-base leading-8 text-ink-800">{result?.finalAnswer ?? "输入问题并运行 Agent Pipeline 后，回答会显示在这里。"}</p>}
        {result && usedFallback ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">当前回答为边界兜底：系统会说明不确定性，不会编造知识库或业务工具之外的信息。</p> : null}
        {result ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">scenario / intent</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{result.route.scenario} / {result.route.intent}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">confidence / risk</p><p className="mt-1 text-sm font-semibold text-ink-900">{Math.round(result.route.confidence * 100)}% / {result.structuredOutput.riskLevel}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">fallback / sources</p><p className="mt-1 text-sm font-semibold text-ink-900">{usedFallback ? "是" : "否"} / {result.ragAnswer?.sources.length ?? 0}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">toolsUsed</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{formatTools(result.structuredOutput.toolsUsed)}</p></div></div> : null}
      </section>

      {result ? <section className="grid gap-5 lg:grid-cols-3"><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">知识库与 RAG</h3><p className="mt-2 break-words text-sm text-ink-600">命中知识库包：{hitPacks.length ? hitPacks.map(packLabel).join("、") : "无"}</p><p className="mt-2 text-sm text-ink-600">最高分：{maxRagScore} · 平均分：{averageRagScore}</p><p className="mt-2 text-sm text-ink-500">回答边界：当前为 mock/keyword RAG，无来源时应补充知识库或业务工具。</p></article><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">Top 来源 / 工具</h3><div className="mt-3 space-y-2 text-sm text-ink-600">{topSources.length ? topSources.map((source) => <p key={source.documentId} className="break-words">{source.title} · chunks {source.chunkIndexes.join(", ")}</p>) : <p>暂无来源</p>}{topTools.length ? topTools.map((tool) => <p key={tool.executedAt + tool.tool} className="break-words">{tool.tool}: {tool.status}</p>) : <p>暂无工具调用</p>}</div></article><article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-ink-900">LLM 状态摘要</h3><div className="mt-3 space-y-2 text-sm text-ink-600"><p>requestMode：{result.api.requestedMode}</p><p>responseMode：{result.api.responseMode}</p><p>provider/model：{result.api.provider} / {result.api.model}</p><p>duration：{result.api.llmDurationMs ? result.api.llmDurationMs + "ms" : "无"}</p><p className="break-words">errorType：{result.api.errorType ?? "无"}</p></div></article></section> : null}

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
        <CollapsibleSection title="详细调试信息" description="默认折叠，面试讲解时可展开查看完整 Agent Trace。" defaultOpen={false}><AgentTracePanel result={result} /></CollapsibleSection>
        {healthResult ? <CollapsibleSection title="LLM Health Diagnostic JSON" description="连接诊断 JSON 默认折叠，不挤占回答区域。" defaultOpen={false}><pre className="max-h-[420px] max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(healthResult, null, 2)}</pre></CollapsibleSection> : null}
        <CollapsibleSection title="来源引用完整列表" description="查看全部 sources。" defaultOpen={false}><SourceList sources={result?.ragAnswer?.sources ?? []} /></CollapsibleSection>
      </section>
    </div>
  );
}
