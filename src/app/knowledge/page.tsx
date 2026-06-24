import { KnowledgeWorkspace } from "@/components/KnowledgeWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库管理"
        description="V0.3 将知识库升级为可交互的 mock RAG 管理页：默认文档、前端新增文档、文本切片、关键词提取和来源引用都可以直接演示。"
      />
      <KnowledgeWorkspace />
    </div>
  );
}
