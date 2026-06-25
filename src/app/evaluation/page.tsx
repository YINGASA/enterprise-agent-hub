import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Evaluation"
        title="Agent 评测面板"
        description="V0.6 Agent Evaluation Dashboard：用于验证 Agent Router、RAG、Tools、LLM 和 fallback 的稳定性，统计场景识别、意图识别、工具命中、来源引用和响应模式。"
      />
      <EvaluationDashboard />
    </div>
  );
}