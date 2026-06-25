import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "项目背景",
    body: "Enterprise Agent Hub 面向 AI 应用开发工程师岗位展示企业级 AI 应用的完整产品化链路：知识库问答、业务工具调用、Agent Router、多步骤编排、结构化输出、真实模型接入和评测分析。",
  },
  {
    title: "技术架构",
    body: "当前使用 Next.js App Router、TypeScript 和 Tailwind CSS 搭建前端与服务端原型。业务数据、RAG、工具调用和 Agent Router 保留 mock 能力，Real 模式通过服务端 API Route 调用 OpenAI-compatible 模型。",
  },
  {
    title: "RAG 流程",
    body: "已实现文档录入、文本切片、关键词提取、简单检索、TopK 召回、来源引用和 mock 回答。后续可升级为 Embedding、向量数据库、Rerank 和真实 LLM 生成。",
  },
  {
    title: "Agent Router",
    body: "用户输入后，Router 判断场景与意图，决定是否调用 RAG，选择需要的业务工具，执行工具调用，汇总 RAG 和工具结果，最终输出结构化 AgentResponse，并在前端展示完整执行轨迹。",
  },
  {
    title: "LLM 接入",
    body: "V0.5 支持 OpenAI-compatible API 与 DeepSeek，API Key 只通过服务端环境变量读取。V0.5.2 支持 HTTPS_PROXY / HTTP_PROXY / ALL_PROXY 和请求超时诊断，适配本地代理网络环境。",
  },
  {
    title: "结构化输出",
    body: "AgentResponse 包含 scenario、intent、answer、evidence、toolsUsed、sources、confidence、riskLevel 和 nextAction。V0.5.3 增强 JSON 提取、一次 JSON 修复请求和真实文本兜底，减少模型输出不稳定对演示的影响。",
  },
  {
    title: "V0.6 评测面板",
    body: "新增 Agent Evaluation Dashboard，可统计场景识别、意图识别、工具命中、RAG 来源引用、关键词命中、LLM 成功率和 fallback 率。评测默认使用 Mock 模式，Real 模式用于验证真实模型稳定性与结构化输出质量。",
  },
  {
    title: "岗位能力点",
    body: "该项目覆盖 AI 应用开发中的产品原型、RAG、Agent 编排、Tool Calling、结构化输出、服务端模型接入、错误 fallback、连接诊断、评测指标和可观测性能力，适合面试中展示工程闭环。",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="面向面试展示的 AI 应用开发项目说明，突出 Mock / Real 双模式、OpenAI-compatible API、DeepSeek 兼容、Agent 执行轨迹和评测可观测性。"
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