import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Evaluation"
        title="Agent 评测面板"
        description="V1.4 基于 74 条多场景评测用例，新增评测历史趋势图表、趋势摘要增强，以及 Markdown / JSON 报告预览与复制能力，用于持续验证 Agent Router、Hybrid RAG、Tool Calling、fallback 与结构化输出质量。"
      />
      <EvaluationDashboard />
    </div>
  );
}