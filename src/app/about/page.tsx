import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "项目背景",
    body: "企业内部常见 AI 需求不仅是单轮问答，还包括知识库检索、业务系统查询、客服回复、招聘匹配和质量评测。Enterprise Agent Hub 用一个轻量平台展示这些能力如何组合成可落地的 AI 应用。",
  },
  {
    title: "技术架构",
    body: "当前使用 Next.js App Router、TypeScript 和 Tailwind CSS 搭建前端原型。业务数据、工具调用和 RAG 流程均为本地 mock 实现，后续可在 API Route 或独立后端接入真实模型服务、检索服务和工具执行层。",
  },
  {
    title: "V0.3 RAG 流程",
    body: "已实现文档录入、文本切片、关键词提取、简单检索、TopK 召回、来源引用和 mock 回答。整个链路不依赖真实 AI API、数据库、向量库、Embedding、LangChain 或 LlamaIndex。",
  },
  {
    title: "RAG 后续升级",
    body: "当前是 mock RAG，后续可逐步升级为 Embedding、向量数据库、Rerank、真实 LLM 生成和 Agent Router。V0.3 的类型与函数边界已经为这些能力预留了接入点。",
  },
  {
    title: "Agent Router 流程",
    body: "Router 将在 V0.4 中实现：先识别场景和意图，再选择企业知识库、客服售后或 JD 匹配等 Agent 模板，并决定是否调用 RAG 或业务工具链。",
  },
  {
    title: "Tool Calling 设计",
    body: "每个工具都拥有稳定的名称、说明、输入参数和输出结构。Agent 后续只通过明确契约调用 queryOrder、searchPolicy、createTicket、analyzeJD 等工具，降低业务系统集成风险。",
  },
  {
    title: "结构化输出设计",
    body: "回答结果不仅包含自然语言，还包含 scenario、intent、tools、citations、confidence、retrievedChunks、sources 等字段，方便前端渲染、日志追踪和自动化评测。",
  },
  {
    title: "岗位能力点",
    body: "该项目覆盖 AI 应用开发工程师常见能力：RAG 产品化、Agent 编排、工具调用建模、结构化输出、前端工程化、mock 驱动原型、质量评测和业务场景抽象。",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="面向面试展示的 AI 应用开发项目说明，突出架构思路、业务抽象、mock RAG 链路和后续可扩展方向。"
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-ink-900">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-ink-500">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
