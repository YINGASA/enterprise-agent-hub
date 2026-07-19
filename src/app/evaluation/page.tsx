import { EvaluationDashboard } from "@/components/EvaluationDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function EvaluationPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="质量验证"
        title="Agent 评测中心"
        description="持续验证企业知识问答与业务流程中的路由、RAG、工具调用、fallback、结构化输出和引用质量，并集中查看 Real API 状态、Mock 回归、失败定位与历史趋势。"
      />
      <EvaluationDashboard />
    </div>
  );
}
