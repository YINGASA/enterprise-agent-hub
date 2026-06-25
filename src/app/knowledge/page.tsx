import { KnowledgeWorkspace } from "@/components/KnowledgeWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function KnowledgePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Base"
        title="知识库管理"
        description="V0.9 升级为 Knowledge Packs 管理页：内置企业制度、电商客服、招聘求职、AI 应用工程规范 4 个知识库包，支持包切换、搜索、标签、详情、chunks 和用户新增文档。"
      />
      <KnowledgeWorkspace />
    </div>
  );
}
