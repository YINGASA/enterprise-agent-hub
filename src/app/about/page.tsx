import { PageHeader } from "@/components/PageHeader";

const capabilities = [
  "4 个 Knowledge Packs，42 篇 mock 文档",
  "Pack-aware keyword RAG 与来源引用",
  "Agent Router 场景与意图识别",
  "本地 Tool Calling 业务工具编排",
  "OpenAI-compatible / DeepSeek Real API 接入",
  "50 条 Agent Evaluation Suite",
];

const versions = [
  { version: "V0.1", title: "页面骨架", body: "完成 7 个基础页面和 B 端 SaaS 风格导航。" },
  { version: "V0.2", title: "工具层", body: "新增 mock 数据和 queryOrder、queryProduct、searchPolicy、createTicket、analyzeJD 等本地工具。" },
  { version: "V0.3", title: "Mock RAG", body: "跑通文档切片、关键词检索、TopK 召回、来源引用和 mock 回答。" },
  { version: "V0.4", title: "Agent Router", body: "实现规则版 Router，将 RAG、Tools 和结构化输出串成多步骤 Agent Pipeline。" },
  { version: "V0.5", title: "Real API", body: "接入 OpenAI-compatible API，支持 DeepSeek、代理诊断、JSON repair 和 fallback。" },
  { version: "V0.6", title: "Evaluation Dashboard", body: "内置评测集，统计路由、意图、工具、RAG、引用、关键词和 fallback 指标。" },
  { version: "V0.7", title: "项目包装", body: "完善 README、架构文档、评测文档、简历 bullet 和面试讲解稿。" },
  { version: "V0.8", title: "发布准备", body: "补充截图清单、发布检查清单和 GitHub/Vercel 上线准备。" },
  { version: "V0.9", title: "知识库与评测扩容", body: "扩展 4 个知识库包、42 篇文档和 50 条评测用例，优化自由提问和 pack-aware RAG。" },
];

const resumeHighlights = [
  "RAG：从 Knowledge Packs、document、chunk、keywords、scoreReason 到 sources，后续可替换为向量数据库。",
  "Agent：Router 判断场景和意图，统一编排 RAG、Tools、LLM 与 fallback。",
  "Tool Calling：本地工具层覆盖订单、商品、政策、工单、JD 分析和客服回复。",
  "结构化输出：Real API 返回 AgentResponse JSON，支持 parse、repair 和文本兜底。",
  "评测闭环：50 条多场景测试用例，Mock 完整评测 50/50，passRate 100%。",
];

export default function AboutPage() {
  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader eyebrow="About" title="项目说明" description="Enterprise Agent Hub 是面向 AI 应用开发工程师岗位的企业级 Agent 平台原型，覆盖 RAG、Agent Router、Tool Calling、Real API、结构化输出、fallback 和评测闭环。" />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-ink-900">项目定位</h2><p className="mt-3 text-sm leading-7 text-ink-500">本项目基于 Next.js、TypeScript 和 Tailwind CSS 构建，使用本地 mock 数据展示企业制度、电商客服售后、招聘求职和 AI 应用工程规范四类知识库场景。当前 RAG 是 mock keyword retrieval，不是向量库；Tool Calling 是服务端本地工具编排，不是模型原生 tool_calls。Mock 模式可稳定演示完整链路，Real 模式通过服务端 API Route 调用 OpenAI-compatible 模型，API Key 不暴露到浏览器。</p></section>
      <section><h2 className="mb-4 text-lg font-semibold text-ink-900">核心能力</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map((item) => <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-ink-900">{item}</p></article>)}</div></section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-ink-900">技术架构</h2><p className="mt-3 text-sm leading-7 text-ink-500">用户输入进入 Agent Router 后，系统判断场景和意图，决定是否进行 pack-aware RAG 检索，并选择本地业务工具。随后服务端将 Router、RAG、Tools 的上下文交给 mock response 或 Real API 生成结构化 AgentResponse。若 JSON 解析失败，会尝试 repair；若仍失败，则使用真实文本回答和 fallback structured output。</p></section>
      <section><h2 className="mb-4 text-lg font-semibold text-ink-900">当前版本能力</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{versions.map((item) => <article key={item.version} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.version}</span><h3 className="mt-3 font-semibold text-ink-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p></article>)}</div></section>
      <section className="grid gap-4 md:grid-cols-4"><article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Knowledge Packs</p><p className="mt-2 text-2xl font-semibold text-ink-900">4</p></article><article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Mock 文档</p><p className="mt-2 text-2xl font-semibold text-ink-900">42</p></article><article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">完整评测</p><p className="mt-2 text-2xl font-semibold text-ink-900">50/50</p></article><article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">passRate</p><p className="mt-2 text-2xl font-semibold text-ink-900">100%</p></article></section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-ink-900">简历亮点</h2><div className="mt-4 space-y-3">{resumeHighlights.map((item) => <p key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">{item}</p>)}</div></section>
    </div>
  );
}
