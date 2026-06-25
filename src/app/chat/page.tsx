import { AgentWorkspace } from "@/components/AgentWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function ChatPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Agent Workspace"
        title="聊天工作台"
        description="支持自由提问的企业 Agent 工作台。系统会通过 Agent Router 判断业务场景，结合 RAG 知识库、业务工具和 Real API / Mock 模式生成可追溯回答。"
      />
      <AgentWorkspace />
    </div>
  );
}
