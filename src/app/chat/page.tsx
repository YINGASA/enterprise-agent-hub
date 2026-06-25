import { AgentWorkspace } from "@/components/AgentWorkspace";
import { PageHeader } from "@/components/PageHeader";

export default function ChatPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Agent Workspace"
        title="聊天工作台"
        description="V0.5.3 支持 Mock / Real API 双模式，Real 模式通过服务端 API Route 调用 OpenAI-compatible 模型，并保留 RAG、工具调用、结构化输出和 fallback 机制。"
      />
      <AgentWorkspace />
    </div>
  );
}