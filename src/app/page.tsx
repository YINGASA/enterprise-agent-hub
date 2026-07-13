import Link from "next/link";
import { FeatureCard } from "@/components/FeatureCard";
import { PageHeader } from "@/components/PageHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import type { Feature, Scenario } from "@/types";

const homeFeatures: Feature[] = [
  { title: "RAG 知识库问答", description: "默认知识库与用户导入文档共同参与检索，回答展示高相关来源和引用依据。" },
  { title: "Agent Router", description: "根据用户问题识别业务场景、任务意图、RAG 使用和工具编排策略。" },
  { title: "Business Tool Calling", description: "业务工具覆盖订单、商品、规则、工单和客服回复生成，支撑知识查询与流程协同。" },
  { title: "Real API 优先运行时", description: "配置模型服务后优先使用真实模型生成；开发模拟模式保留用于离线回归和故障兜底。" },
  { title: "可信 fallback", description: "Real API 失败时明确标记 real_error_fallback，不把兜底回答伪装成模型成功。" },
  { title: "评测闭环", description: "内置 80 条多场景评测，统计路由、意图、工具、RAG、引用和 fallback 指标。" },
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
];

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <PageHeader
          eyebrow="Enterprise AI Agent Platform"
          title="Enterprise Agent Hub"
          description="企业知识库与业务流程自动化 Agent 平台。基于 Real API-first Runtime、Hybrid RAG、Agent Router、Business Tools、反馈闭环和评测面板，形成可解释、可验证、可复盘的 AI 应用链路。"
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            进入 Agent 工作台
          </Link>
          <Link href="/knowledge" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            管理知识库
          </Link>
          <Link href="/tools" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            查看业务工具
          </Link>
          <Link href="/evaluation" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            查看评测面板
          </Link>
          <Link href="/about" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">
            阅读项目说明
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-brand-100 bg-brand-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink-900">推荐体验路径</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { href: "/knowledge", title: "1. 知识库", desc: "查看默认知识库、导入本地文档、检查 chunks 和质量诊断。" },
            { href: "/chat?question=%E8%AE%A2%E5%8D%9510001%E8%83%BD%E4%B8%8D%E8%83%BD%E9%80%80%EF%BC%9F", title: "2. Chat", desc: "带入业务问题，观察 Router、RAG、Tools、Real API / fallback。" },
            { href: "/tools", title: "3. 业务工具", desc: "查看订单、规则、工单和客服协同工具如何支撑回答与流程。" },
            { href: "/evaluation", title: "4. 评测面板", desc: "运行 full Mock 回归，查看 80 条评测和报告导出。" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md bg-white p-4 text-left shadow-sm ring-1 ring-brand-100 hover:bg-brand-100">
              <span className="block font-semibold text-brand-800">{item.title}</span>
              <span className="mt-2 block text-sm leading-6 text-ink-600">{item.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">核心能力</h2>
            <p className="mt-1 text-sm text-ink-500">从知识库管理、真实模型生成到评测闭环，完整展示企业 AI Agent 应用形态。</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homeFeatures.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-ink-900">核心业务场景</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {homeScenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>
    </div>
  );
}
