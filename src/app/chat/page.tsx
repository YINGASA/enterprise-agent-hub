import { AgentWorkspace } from "@/components/AgentWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function ChatPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Agent Workspace"
        title="聊天工作台"
        description="V0.4 升级为本地规则版 Agent 工作台：自动判断业务场景、任务意图、是否需要 RAG、需要调用哪些工具，并展示完整执行链路。"
      />
      <AgentWorkspace />
    </div>
  );
}
