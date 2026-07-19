import type { AgentResponseMode, LlmMode } from "@/types";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";

type ChatHeaderProps = {
  title: string;
  mode: LlmMode;
  responseMode?: AgentResponseMode;
  hasMessages: boolean;
  storageWritable: boolean;
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

function modeTone(mode: AgentResponseMode | LlmMode): StatusTone {
  if (mode === "real" || mode === "real_repaired") return "success";
  if (mode === "real_error_fallback") return "danger";
  if (mode === "real_text_fallback" || mode === "fallback") return "warning";
  return "neutral";
}

export function ChatHeader({ title, mode, responseMode, hasMessages, storageWritable, mobileSidebarOpen, onOpenSidebar, onOpenHistory, onRequestClear, onRequestDelete }: ChatHeaderProps) {
  return (
    <header data-testid="chat-header" className="flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" data-testid="conversation-drawer-open" aria-label="打开会话列表" aria-controls="mobile-conversation-drawer" aria-expanded={mobileSidebarOpen} onClick={onOpenSidebar} className="app-button-secondary px-3 lg:hidden">会话</button>
        <div className="min-w-0">
          <h1 title={title} className="truncate text-base font-semibold text-ink-950 sm:text-lg">{title}</h1>
          <div className="mt-1"><StatusBadge tone={modeTone(responseMode ?? mode)} showDot>{modeLabel(responseMode ?? mode)}</StatusBadge></div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" data-testid="chat-history-open" onClick={onOpenHistory} className="app-button-secondary hidden px-3 sm:inline-flex">运行记录</button>
        <button type="button" data-testid="conversation-clear" disabled={!hasMessages || !storageWritable} onClick={onRequestClear} className="app-button-secondary hidden px-3 md:inline-flex">清空</button>
        <button type="button" data-testid="conversation-delete-current" aria-label="删除当前会话" disabled={!storageWritable} onClick={onRequestDelete} className="app-button-tertiary min-h-10 px-2.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3">删除</button>
      </div>
    </header>
  );
}
