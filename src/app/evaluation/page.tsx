import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Evaluation"
        title="Agent 评测面板"
        description="V1.9 评测面板用于持续验证 Agent Router、Hybrid RAG、Tool Calling、fallback、结构化输出和引用质量；同时展示 Real API 健康状态、Mock 回归摘要、历史趋势和 Markdown / JSON 报告导出。"
      />
      <EvaluationDashboard />
    </div>
  );
}
