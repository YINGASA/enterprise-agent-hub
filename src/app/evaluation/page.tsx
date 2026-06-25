import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Evaluation"
        title="Agent 评测面板"
        description="V0.9 将评测集扩展到 50 条，支持快速 15 条、标准 30 条、完整 50 条和知识库包筛选，用于验证 Router、RAG、Tools、LLM fallback 与来源引用。"
      />
      <EvaluationDashboard />
    </div>
  );
}
