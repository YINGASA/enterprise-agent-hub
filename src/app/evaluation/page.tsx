import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Evaluation"
        title="Agent 评测面板"
        description="持续验证企业知识库与业务流程场景中的 Agent Router、Hybrid RAG、Tool Calling、fallback、结构化输出和引用质量；同时展示 Real API 健康状态、Mock 回归摘要、历史趋势和报告导出。"
      />
      <EvaluationDashboard />
    </div>
  );
}
