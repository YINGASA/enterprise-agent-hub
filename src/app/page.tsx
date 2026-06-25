import Link from "next/link";
import { FeatureCard } from "@/components/FeatureCard";
import { PageHeader } from "@/components/PageHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import type { Feature, Scenario } from "@/types";

const homeFeatures: Feature[] = [
  { title: "RAG 知识库问答", description: "基于 mock 文档、关键词切片检索和来源引用，展示企业知识问答链路。" },
  { title: "Agent Router", description: "根据用户问题识别业务场景、任务意图、RAG 使用和工具编排策略。" },
  { title: "Tool Calling", description: "本地业务工具覆盖订单、商品、政策、工单、JD 分析和客服回复生成。" },
  { title: "Real API 双模式", description: "Mock 模式稳定演示，Real 模式通过服务端 API Route 调用 OpenAI-compatible 模型。" },
  { title: "结构化输出与 fallback", description: "支持 JSON 输出、JSON repair、真实文本兜底和 mock-agent fallback。" },
  { title: "评测闭环", description: "内置 15 条测试集，统计路由、意图、工具、RAG、引用和 fallback 指标。" },
];

const homeScenarios: Scenario[] = [
  {
    id: "enterprise-agent",
    name: "企业知识库 Agent",
    description: "回答报销、年假、请假、信息安全等企业制度问题，并展示来源引用。",
    questions: ["公司报销需要什么材料？", "年假制度是什么？", "信息安全规范里对客户数据有什么要求？"],
    tools: ["searchPolicy", "createTicket"],
    outputType: "带来源引用的知识库回答",
  },
  {
    id: "ecommerce-agent",
    name: "电商客服与售后 Agent",
    description: "处理订单退货、商品库存、尺码建议、客服回复和售后工单。",
    questions: ["订单10001能不能退？", "商品P001还有库存吗？", "客户说尺码不合适怎么回复？"],
    tools: ["queryOrder", "queryProduct", "searchPolicy", "generateCustomerReply", "createTicket"],
    outputType: "客服回复 + 工具结果 + 风险提示",
  },
  {
    id: "recruitment-agent",
    name: "招聘求职 JD 匹配 Agent",
    description: "分析岗位 JD 与 mock 简历匹配度，输出匹配点、缺口和面试准备建议。",
    questions: ["这个 AI 应用开发工程师岗位和我的简历匹配吗？", "帮我分析这个 JD 的核心要求。"],
    tools: ["analyzeJD"],
    outputType: "匹配分 + 关键词 + 能力缺口",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <PageHeader
          eyebrow="Enterprise AI Agent Platform"
          title="Enterprise Agent Hub"
          description="企业知识库与业务流程自动化 Agent 平台。基于 RAG、Agent Router、Tool Calling、OpenAI-compatible API、结构化输出、fallback 和评测面板，展示 AI 应用开发工程化闭环。"
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            进入 Agent 工作台
          </Link>
          <Link href="/evaluation" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            查看评测面板
          </Link>
          <Link href="/about" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            阅读项目说明
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">核心能力</h2>
            <p className="mt-1 text-sm text-ink-500">从 mock 数据到 Real API，再到评测闭环，完整展示企业 AI Agent 应用形态。</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homeFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-ink-900">首批业务场景</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {homeScenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>
    </div>
  );
}