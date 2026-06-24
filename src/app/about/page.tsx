import { PageHeader } from "@/components/PageHeader";

const sections = [
  {
    title: "项目背景",
    body: "Enterprise Agent Hub 面向 AI 应用开发工程师岗位展示企业级 AI 应用的完整产品化链路：知识库问答、业务工具调用、Agent Router、多步骤编排、结构化输出和评测分析。",
  },
  {
    title: "技术架构",
    body: "当前使用 Next.js App Router、TypeScript 和 Tailwind CSS 搭建前端原型。业务数据、RAG、工具调用和 Agent Router 保留本地 mock 能力，V0.5 新增服务端 LLM Client 和 API Route。",
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
    title: "V0.5 OpenAI-compatible API",
    body: "新增 OpenAI-compatible Chat Completions 调用能力，兼容 DeepSeek。用户可在 /chat 选择 mock 或 real 模式，真实调用只发生在服务端 API Route，浏览器不会暴露 API Key。",
  },
  {
    title: "V0.5.1 DeepSeek 诊断",
    body: "新增 /api/llm/health 和 /chat 的连接诊断入口，可查看脱敏 Key 状态、最终请求 URL、HTTP 状态、网络错误、响应预览和 JSON 解析结果。如果 deepseek-v4-flash 当前账号不可用，可以临时尝试 deepseek-chat 做兼容测试。",
  },
  {
    title: "密钥与 fallback",
    body: "API Key 通过 AI_API_KEY、AI_BASE_URL、AI_MODEL、AI_PROVIDER 环境变量管理。未配置 Key、网络失败、HTTP 错误或模型 JSON 解析失败时，系统自动 fallback 到 mock-agent，页面仍可演示。",
  },
  {
    title: "结构化输出设计",
    body: "AgentResponse 包含 scenario、intent、answer、evidence、toolsUsed、sources、confidence、riskLevel 和 nextAction。Real 模式会要求模型返回同样结构，并在失败时保留 mock 输出。",
  },
  {
    title: "V0.6 方向",
    body: "下一版可升级 Tool Calls、JSON Schema 校验、模型输出重试、流式响应和更正式的评测面板，把真实模型质量纳入可观测指标。",
  },
];

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        eyebrow="About"
        title="项目说明"
        description="面向面试展示的 AI 应用开发项目说明，突出 mock/real 双模式、OpenAI-compatible API、DeepSeek 兼容和可观测 Agent 执行轨迹。"
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
