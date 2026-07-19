"use client";

import { useRef } from "react";
import { ChatRunHistoryPanel } from "@/components/ChatRunHistoryPanel";
import { useModalFocus } from "@/components/chat-workspace/useModalFocus";
import type { AgentApiResponse } from "@/types";

export function ChatHistoryDialog({ open, currentResult, onClose }: { open: boolean; currentResult: AgentApiResponse | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: closeRef, onClose });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-2 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="chat-history-title" aria-describedby="chat-history-description">
      <button type="button" aria-label="关闭运行记录" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-950/40" />
      <div ref={dialogRef} tabIndex={-1} className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[90dvh]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <h2 id="chat-history-title" className="font-semibold text-ink-900">Chat 运行记录</h2>
          <p id="chat-history-description" className="sr-only">查看、保存与导出当前浏览器中的 Agent 运行记录。</p>
          <button ref={closeRef} type="button" onClick={onClose} className="app-button-secondary px-3">关闭</button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4"><ChatRunHistoryPanel currentResult={currentResult} /></div>
      </div>
    </div>
  );
}
