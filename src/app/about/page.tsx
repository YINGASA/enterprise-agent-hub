import { PageHeader } from "@/components/PageHeader";

const capabilities = [
  "RAG 知识库检索与来源引用",
  "Agent Router 场景与意图识别",
  "本地 Tool Calling 业务工具编排",
  "OpenAI-compatible / DeepSeek Real API 接入",
  "JSON 结构化输出、repair 与 fallback",
  "Agent Evaluation Dashboard 评测闭环",
];

const versions = [
  { version: "V0.1", title: "页面骨架", body: "完成首页、聊天工作台、知识库、工具中心、场景模板、评测面板和项目说明。" },
  { version: "V0.2", title: "工具层", body: "新增企业知识库、电商客服、招聘求职 mock 数据和本地业务工具函数。" },
  { version: "V0.3", title: "Mock RAG", body: "跑通文档切片、关键词检索、TopK 召回、来源引用和 mock 回答。" },
  { version: "V0.4", title: "Agent Router", body: "实现规则版 Router，将 RAG、Tools 和结构化输出串成多步骤 Agent Pipeline。" },
  { version: "V0.5", title: "Real API", body: "接入 OpenAI-compatible API，支持 DeepSeek、代理诊断、JSON repair 和 fallback。" },
  { version: "V0.6", title: "Evaluation Dashboard", body: "内置 15 条评测集，统计路由、意图、工具、RAG、引用、关键词和 fallback 指标。" },
  { version: "V0.7", title: "项目包装", body: "完善 README、架构文档、评测文档、简历 bullet 和面试讲解稿，准备 GitHub 与 Vercel 展示。" },
  { version: "V0.8", title: "发布准备", body: "补充截图清单、发布检查清单和最终简历推荐版，完成 GitHub / Vercel 上线前收口。" },
];

const resumeHighlights = [
  "RAG：从文档、chunk、关键词检索到来源引用，后续可替换为向量数据库。",
  "Agent：Router 判断场景和意图，统一编排 RAG、Tools、LLM 与 fallback。",
  "Tool Calling：本地工具层覆盖订单、商品、政策、工单、JD 分析和客服回复。",
  "结构化输出：Real API 返回 AgentResponse JSON，支持 parse、repair 和文本兜底。",
  "评测闭环：15 条测试集，Mock 全量评测 15/15，passRate 100%。",
];

export default function AboutPage() {
  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="Enterprise Agent Hub 是面向 AI 应用开发工程师岗位的企业级 Agent 平台原型，突出 RAG、Agent Router、Tool Calling、Real API、结构化输出、fallback 和评测闭环。"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">项目定位</h2>
        <p className="mt-3 text-sm leading-7 text-ink-500">
          本项目基于 Next.js、TypeScript 和 Tailwind CSS 构建，使用本地 mock 数据展示企业知识库问答、电商客服售后和招聘 JD 匹配三个场景。Mock 模式可稳定演示完整链路，Real 模式通过服务端 API Route 调用 OpenAI-compatible 模型，API Key 不暴露到浏览器。
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">核心能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {capabilities.map((item) => (
            <article key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-ink-900">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">技术架构</h2>
        <p className="mt-3 text-sm leading-7 text-ink-500">
          用户输入进入 Agent Router 后，系统判断场景和意图，决定是否进行 RAG 关键词检索，选择并执行本地业务工具，然后将 Router、RAG、Tools 的上下文交给 Real API 或 mock response 生成结构化 AgentResponse。若 JSON 解析失败，会进行一次 repair；若仍失败，则使用真实文本回答和 fallback structured output。
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-ink-900">当前版本能力</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {versions.map((item) => (
            <article key={item.version} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{item.version}</span>
              <h3 className="mt-3 font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-500">Mock 全量评测</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">15/15</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-500">passRate</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">100%</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-500">toolHitRate</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">100%</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-500">citationRate</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">100%</p>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">简历亮点</h2>
        <div className="mt-4 space-y-3">
          {resumeHighlights.map((item) => (
            <p key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-ink-600">{item}</p>
          ))}
        </div>
      </section>
    </div>
  );
}