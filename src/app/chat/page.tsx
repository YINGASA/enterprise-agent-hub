import { AgentWorkspace } from "@/components/AgentWorkspace";
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-x-hidden">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white p-5 text-sm text-ink-500 shadow-sm">正在加载聊天工作台...</div>}>
        <AgentWorkspace />
      </Suspense>
    </div>
  );
}
