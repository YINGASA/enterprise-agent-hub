import { PageHeader } from "@/components/PageHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import { scenarios } from "@/data/mock";

export default function ScenariosPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Scenario Templates"
        title="场景模板"
        description="用模板沉淀不同业务 Agent 的适用问题、可调用工具和输出结果类型，方便后续扩展插件化场景。"
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}
