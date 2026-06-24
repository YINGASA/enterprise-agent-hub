import Link from "next/link";
import { FeatureCard } from "@/components/FeatureCard";
import { PageHeader } from "@/components/PageHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import { features, scenarios } from "@/data/mock";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
        <PageHeader
          eyebrow="V0.1 Mock Prototype"
          title="Enterprise Agent Hub"
          description="企业知识库与业务流程自动化 Agent 平台。基于 RAG、Agent Router、Tool Calling 与结构化输出，面向多场景 AI 应用开发与面试展示。"
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/chat" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            查看聊天工作台
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
            <p className="mt-1 text-sm text-ink-500">V0.1 先以 mock 数据展示完整产品信息架构。</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-ink-900">首批业务场景</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>
    </div>
  );
}
