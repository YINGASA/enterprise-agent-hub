import { AgentWorkspace } from "@/components/AgentWorkspace";
import { PageHeader } from "@/components/PageHeader";
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <div className="overflow-x-hidden">
      <PageHeader
        eyebrow="Agent Workspace"
        title="聊天工作台"
        description="支持自由提问的企业 Agent 工作台。系统会通过 Agent Router 判断业务场景，结合 RAG 知识库和业务工具生成可追溯回答；模型服务已配置时优先使用 Real API，未配置或失败时明确进入开发模拟或兜底状态。"
      />
      <Suspense fallback={<div className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-ink-500 shadow-sm">正在加载聊天工作台...</div>}>
        <AgentWorkspace />
      </Suspense>
    </div>
  );
}
