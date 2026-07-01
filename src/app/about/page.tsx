import { PageHeader } from "@/components/PageHeader";

const capabilities = [
  "4 个系统内置 Knowledge Packs，覆盖企业制度、电商售后、招聘匹配和 AI 工程规范",
  "本地知识库导入，支持 txt / md / json / csv，并保存在浏览器 localStorage",
  "Pack-aware Hybrid RAG，支持 Query Expansion、多维评分、scoreBreakdown 和 retrievalConfidence",
  "Agent Router 识别业务场景与任务意图，统一编排 RAG、Tools、LLM 与 fallback",
  "OpenAI-compatible / DeepSeek Real API 接入，服务端管理 Key，前端不暴露密钥",
  "80 条多场景 Agent Evaluation Suite，支持历史记录、趋势摘要和 Markdown / JSON 报告导出",
];

const versions = [
  { version: "V0.1", title: "项目骨架", body: "完成 7 个基础页面、统一导航和 B 端 SaaS 风格界面。" },
  { version: "V0.2", title: "业务工具层", body: "新增 mock 数据，并实现订单查询、商品查询、规则检索、工单创建、JD 分析和客服回复生成等本地工具。" },
  { version: "V0.3", title: "基础 Mock RAG", body: "跑通文档切片、关键词提取、TopK 检索、来源引用和 mock 回答链路。" },
  { version: "V0.4", title: "Agent Router", body: "实现规则版 Router，根据问题判断场景、意图、是否需要 RAG 和需要调用的业务工具。" },
  { version: "V0.5", title: "Real API 接入", body: "接入 OpenAI-compatible API，兼容 DeepSeek，支持 Mock / Real 双模式、JSON parse、repair 和 fallback。" },
  { version: "V0.6", title: "评测面板", body: "新增 Agent Evaluation Dashboard，统计场景识别、意图识别、工具命中、RAG 引用、关键词命中和 fallback 指标。" },
  { version: "V0.7", title: "文档与发布准备", body: "完善 README、架构文档、评测文档、截图清单和发布检查清单。" },
  { version: "V0.8", title: "GitHub / Vercel 发布准备", body: "完成发布前安全检查、截图说明、部署说明和 release checklist。" },
  { version: "V0.9", title: "知识库扩容与自由提问", body: "扩充默认 Knowledge Packs，优化自由提问体验、Top sources 展示和评测用例覆盖。" },
  { version: "V1.0", title: "本地知识库导入", body: "支持 txt / md / json / csv 文档导入，用户文档保存到 localStorage，并可与默认知识库一起参与 RAG 检索。" },
  { version: "V1.1", title: "知识库管理体验优化", body: "优化用户文档管理、知识库筛选、搜索、详情展示和导入体验，让 /knowledge 更像真实知识库管理页。" },
  { version: "V1.2", title: "Hybrid RAG 检索质量升级", body: "引入 Query Expansion、多维评分、scoreBreakdown、retrievalConfidence 和低置信边界。" },
  { version: "V1.2.1", title: "AI 工程规范路由优化", body: "JSON repair、fallback、Tool Calling、Agent 评测集等问题优先进入 AI 工程规范场景。" },
  { version: "V1.3", title: "评测历史与报告导出", body: "支持保存评测历史、趋势摘要，并导出 Markdown / JSON 报告，用于持续复盘 Agent 质量。" },
  { version: "V1.3.1", title: "评测面板中文化", body: "统一中文化评测页面文案，修正版本说明，提升面试展示和产品体验。" },
  { version: "V1.6", title: "Chat \u8fd0\u884c\u5386\u53f2\u4e0e Trace \u5bfc\u51fa", body: "\u652f\u6301\u4fdd\u5b58 Chat \u8fd0\u884c\u5386\u53f2\uff0c\u590d\u76d8 Router / RAG / Tools / LLM / Retriever Trace\uff0c\u5e76\u5bfc\u51fa Markdown / JSON \u8fd0\u884c\u62a5\u544a\u3002" },
];

const engineeringHighlights = [
  "RAG：从 Knowledge Packs、用户导入文档、chunks、keywords、scoreBreakdown 到 sources，形成可解释检索链路。",
  "Agent：Router 判断业务场景和意图，统一编排 RAG、Tools、LLM 与 fallback。",
  "Tool Calling：本地工具支持订单查询、商品查询、规则检索、工单创建、JD 分析和客服回复生成。",
  "结构化输出：Real API 返回 AgentResponse JSON，支持 parse、repair 和文本兜底。",
  "评测闭环：80 条多场景测试用例，支持保存历史、趋势摘要和 Markdown / JSON 报告导出。",
];

export default function AboutPage() {
  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="Enterprise Agent Hub 是一个面向企业知识库与业务流程自动化的 AI Agent 平台，集成 Agent Router、Hybrid RAG、Tool Calling、OpenAI-compatible API、评测面板、知识库导入和报告导出等能力。"
      />
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">项目定位</h2>
        <p className="mt-3 text-sm leading-7 text-ink-600">平台围绕企业知识库问答、电商客服售后、招聘求职匹配和 AI 工程规范四类场景构建。当前默认知识库与业务数据仍为 mock 数据，用户导入文档保存在浏览器 localStorage；Hybrid RAG 使用关键词、标题、标签、分类、知识库包、来源和业务短语等信号进行本地加权评分，不是 Embedding 向量检索。</p>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">核心能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map((item) => <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold leading-6 text-ink-900">{item}</p></article>)}</div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">技术架构</h2>
        <p className="mt-3 text-sm leading-7 text-ink-600">用户输入问题后，Agent Router 判断业务场景和意图，系统基于场景进行 pack-aware Hybrid RAG 检索，并选择本地业务工具；随后将 Router、RAG、Tools 上下文交给 mock response 或 Real API 生成结构化 AgentResponse。系统支持 JSON parse、JSON repair、fallback、缺失参数澄清和低置信检索边界。</p>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">当前版本能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{versions.map((item) => <article key={item.version} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.version}</span><h3 className="mt-3 font-semibold text-ink-900">{item.title}</h3><p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p></article>)}</div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Knowledge Packs</p><p className="mt-2 text-2xl font-semibold text-ink-900">4</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">Mock 文档</p><p className="mt-2 text-2xl font-semibold text-ink-900">42</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">完整评测</p><p className="mt-2 text-2xl font-semibold text-ink-900">80/80</p></article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-ink-500">passRate</p><p className="mt-2 text-2xl font-semibold text-ink-900">100%</p></article>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">工程实现亮点</h2>
        <div className="mt-4 space-y-3">{engineeringHighlights.map((item) => <p key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">{item}</p>)}</div>
      </section>
    </div>
  );
}
