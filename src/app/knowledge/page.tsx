import { KnowledgeWorkspace } from "@/components/KnowledgeWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库管理"
        description="管理默认知识库与本地导入文档，查看启用状态、chunks、标签、建议测试问题和质量诊断；用户文档保存在当前浏览器 localStorage，并可参与 Chat 工作台 RAG 检索。"
      />
      <KnowledgeWorkspace />
    </div>
  );
}
