import { KnowledgeWorkspace } from "@/components/KnowledgeWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="企业知识管理"
        title="知识库管理"
        description="管理系统内置资料与当前工作区文档，查看检索状态、分块、标签和质量诊断；用户文档按当前存储模式持久化，启用后可参与聊天工作台的 RAG 检索。"
      />
      <KnowledgeWorkspace />
    </div>
  );
}
