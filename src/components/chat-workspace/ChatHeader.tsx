import type { AgentResponseMode, LlmMode } from "@/types";

type ChatHeaderProps = {
  title: string;
  mode: LlmMode;
  responseMode?: AgentResponseMode;
  hasMessages: boolean;
  mobileSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenHistory: () => void;
  onRequestClear: () => void;
  onRequestDelete: () => void;
};

function modeLabel(mode: AgentResponseMode | LlmMode) {
  const labels: Record<string, string> = {
    mock: "开发模拟模式",
    real: "真实模型生成",
    real_repaired: "真实模型生成 · 已修复",
    real_text_fallback: "真实文本兜底",
    real_error_fallback: "真实模型失败 · 已兜底",
    fallback: "兜底模式",
  };
  return labels[mode] ?? mode;
}

export function ChatHeader({ title, mode, responseMode, hasMessages, mobileSidebarOpen, onOpenSidebar, onOpenHistory, onRequestClear, onRequestDelete }: ChatHeaderProps) {
  return (
    <header data-testid="chat-header" className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" data-testid="conversation-drawer-open" aria-label="打开会话列表" aria-controls="mobile-conversation-drawer" aria-expanded={mobileSidebarOpen} onClick={onOpenSidebar} className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden">会话</button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-ink-900 sm:text-lg">{title}</h1>
          <p className="mt-0.5 truncate text-xs text-ink-500">{modeLabel(responseMode ?? mode)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" data-testid="chat-history-open" onClick={onOpenHistory} className="hidden cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:inline-flex">运行记录</button>
        <button type="button" data-testid="conversation-clear" disabled={!hasMessages} onClick={onRequestClear} className="hidden cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex">清空</button>
        <button type="button" data-testid="conversation-delete-current" onClick={onRequestDelete} className="cursor-pointer rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">删除</button>
      </div>
    </header>
  );
}
