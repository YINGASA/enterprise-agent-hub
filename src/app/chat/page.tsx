import { AgentWorkspace } from "@/components/AgentWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function ChatPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Agent Workspace"
        title="聊天工作台"
        description="V0.9 优化自由提问体验：示例问题按企业制度、电商客服、招聘求职、AI 工程规范和兜底测试分组，Agent 会展示命中的知识库包、RAG 评分原因、fallback 状态和回答边界。"
      />
      <AgentWorkspace />
    </div>
  );
}
