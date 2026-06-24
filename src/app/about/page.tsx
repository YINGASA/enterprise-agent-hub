import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "项目背景",
    body: "企业内部常见 AI 需求不仅是单轮问答，还包括知识库检索、业务系统查询、客服回复、招聘匹配和质量评测。Enterprise Agent Hub 用一个轻量平台展示这些能力如何组合成可落地的 AI 应用。",
  },
  {
    title: "技术架构",
    body: "V0.1 使用 Next.js App Router、TypeScript 和 Tailwind CSS 搭建前端原型。后续可在 API Route 或独立后端中接入模型服务、检索服务、工具执行层和评测流水线。",
  },
  {
    title: "RAG 流程",
    body: "用户问题进入后，系统进行查询改写、文档召回、chunk 重排、上下文组装、模型回答和来源引用输出。当前页面使用 mock 文档、chunks 和 citations 展示该流程的产品形态。",
  },
  {
    title: "Agent Router 流程",
    body: "Router 先识别场景和意图，再选择企业知识库、客服售后或 JD 匹配等 Agent 模板，并决定需要执行的工具链。聊天工作台右侧展示了这一决策轨迹。",
  },
  {
    title: "Tool Calling 设计",
    body: "每个工具都拥有稳定的名称、说明、输入参数和输出结构。Agent 只通过明确契约调用 queryOrder、searchPolicy、createTicket、analyzeJD 等工具，降低业务系统集成风险。",
  },
  {
    title: "结构化输出设计",
    body: "回答结果不仅包含自然语言，还包含 scenario、intent、tools、citations、confidence 等字段，方便前端渲染、工单写入、日志追踪和自动化评测。",
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
        description="面向面试展示的 AI 应用开发项目说明，突出架构思路、业务抽象和后续可扩展方向。"
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
