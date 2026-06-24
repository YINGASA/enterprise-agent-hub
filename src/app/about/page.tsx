import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "项目背景",
    body: "Enterprise Agent Hub 面向 AI 应用开发工程师岗位展示企业级 AI 应用的完整产品化链路：知识库问答、业务工具调用、Agent Router、多步骤编排、结构化输出和评测分析。",
  },
  {
    title: "技术架构",
    body: "当前使用 Next.js App Router、TypeScript 和 Tailwind CSS 搭建前端原型。业务数据、RAG、工具调用和 Agent Router 都是本地 mock 实现，保持轻量可演示。",
  },
  {
    title: "V0.3 RAG 流程",
    body: "已实现文档录入、文本切片、关键词提取、简单检索、TopK 召回、来源引用和 mock 回答。该流程为后续接入 Embedding、向量数据库和真实 LLM 预留边界。",
  },
  {
    title: "V0.4 Agent Router 流程",
    body: "用户输入后，Router 判断场景与意图，决定是否调用 RAG，决定需要哪些工具，执行工具调用，汇总 RAG 和工具结果，输出结构化 AgentResponse，并在前端展示完整决策轨迹。",
  },
  {
    title: "Tool Calling 设计",
    body: "工具层保持独立，包含 queryOrder、queryProduct、searchPolicy、createTicket、analyzeJD 和 generateCustomerReply。Agent Pipeline 只通过明确参数调用这些本地 mock 工具。",
  },
  {
    title: "结构化输出设计",
    body: "AgentResponse 包含 scenario、intent、answer、evidence、toolsUsed、sources、confidence、riskLevel 和 nextAction，方便前端展示、日志追踪和后续自动化评测。",
  },
  {
    title: "当前边界",
    body: "V0.4 仍为 mock-agent，不接真实 AI API、数据库、向量库、Embedding、LangChain 或 LlamaIndex。规则路由用于面试演示和工程边界验证。",
  },
  {
    title: "V0.5 方向",
    body: "下一版可接入真实 OpenAI-compatible API，将 Router 决策、回答生成和结构化输出从规则 mock 升级为真实模型调用，同时保留当前可观测执行轨迹。",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="面向面试展示的 AI 应用开发项目说明，突出 mock RAG、Agent Router、多步骤编排和后续真实模型接入路径。"
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
