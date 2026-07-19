"use client";

import { useRef, useState } from "react";
import { useModalFocus } from "@/components/chat-workspace/useModalFocus";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PublicStorageStatus } from "@/lib/storage/status";
import type { Conversation } from "@/types";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeConversationId: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => string | null | Promise<string | null>;
  onRequestDelete: (conversationId: string) => void;
  onRequestClearCurrent: () => void;
  onOpenHistory: () => void;
  activeHasMessages: boolean;
  storageStatus?: PublicStorageStatus | null;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间未知";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

type SidebarPanelProps = Omit<ConversationSidebarProps, "mobileOpen" | "onCloseMobile"> & { onSelected?: () => void };

function SidebarPanel({ conversations, activeConversationId, activeHasMessages, storageStatus, onNewConversation, onSelectConversation, onRenameConversation, onRequestDelete, onRequestClearCurrent, onOpenHistory, onSelected }: SidebarPanelProps) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const filtered = conversations.filter((conversation) => conversation.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const writable = Boolean(storageStatus && storageStatus.storageMode !== "degraded");

  function selectConversation(conversationId: string) {
    onSelectConversation(conversationId);
    onSelected?.();
  }

  function beginRename(conversation: Conversation) {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
    setRenameError("");
  }

  function cancelRename() {
    setRenamingId("");
    setRenameValue("");
    setRenameError("");
  }

  async function submitRename() {
    if (!renamingId) return;
    const error = await onRenameConversation(renamingId, renameValue);
    if (error) {
      setRenameError(error);
      return;
    }
    cancelRename();
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 p-4">
        <button type="button" data-testid="conversation-new" disabled={!writable} onClick={() => { onNewConversation(); onSelected?.(); }} className="app-button-primary w-full disabled:cursor-wait">新建对话</button>
        <label className="mt-3 block">
          <span className="sr-only">搜索会话</span>
          <input data-testid="conversation-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索会话标题" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-ink-700 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
        </label>
      </div>
      <div data-testid="conversation-list" role="list" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-label="会话列表" aria-busy={!storageStatus}>
        {filtered.length ? filtered.map((conversation) => {
          const selected = conversation.id === activeConversationId;
          const renaming = conversation.id === renamingId;
          return (
            <article key={conversation.id} role="listitem" data-testid="conversation-list-item" className={"group rounded-lg border p-2 transition-colors " + (selected ? "border-brand-200 bg-brand-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50")}>
              {renaming ? (
                <div>
                  <label>
                    <span className="sr-only">新的会话标题</span>
                    <input autoFocus data-testid="conversation-rename-input" value={renameValue} onChange={(event) => { setRenameValue(event.target.value); setRenameError(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitRename(); } else if (event.key === "Escape") { event.preventDefault(); cancelRename(); } }} className="w-full rounded-md border border-brand-300 bg-white px-2 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </label>
                  {renameError ? <p role="alert" className="mt-1 text-xs text-rose-700">{renameError}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <button type="button" data-testid="conversation-rename-save" onClick={() => void submitRename()} className="cursor-pointer rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">保存</button>
                    <button type="button" onClick={cancelRename} className="cursor-pointer rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" data-testid="conversation-select" aria-current={selected ? "page" : undefined} onClick={() => selectConversation(conversation.id)} className="min-h-10 w-full cursor-pointer rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                    <span data-testid="conversation-title" title={conversation.title} className="block truncate text-sm font-semibold text-ink-800">{conversation.title}</span>
                    <span className="mt-1 block text-xs text-ink-500">{formatUpdatedAt(conversation.updatedAt)}</span>
                  </button>
                  <div className="mt-1 flex items-center gap-1 px-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                    <button type="button" data-testid="conversation-rename" aria-label={`重命名会话 ${conversation.title}`} disabled={!writable} onClick={() => beginRename(conversation)} className="min-h-9 cursor-pointer rounded-md px-2 text-xs font-medium text-ink-600 hover:bg-white hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50">重命名</button>
                    <button type="button" data-testid="conversation-delete" aria-label={`删除会话 ${conversation.title}`} disabled={!writable} onClick={() => onRequestDelete(conversation.id)} className="min-h-9 cursor-pointer rounded-md px-2 text-xs font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50">删除</button>
                  </div>
                </>
              )}
            </article>
          );
        }) : <p className="rounded-lg bg-slate-50 p-4 text-center text-sm leading-6 text-ink-500">{query.trim() ? "没有匹配的会话。" : "暂无已保存会话，发送第一条消息后会显示在这里。"}</p>}
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 p-3 lg:hidden">
        <button type="button" data-testid="conversation-clear-mobile" disabled={!activeHasMessages || !writable} onClick={() => { onRequestClearCurrent(); onSelected?.(); }} className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50">清空当前</button>
        <button type="button" data-testid="chat-history-open-mobile" onClick={() => { onOpenHistory(); onSelected?.(); }} className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">运行记录</button>
      </div>
      <div className={`shrink-0 border-t border-slate-200 p-3 text-xs leading-5 ${storageStatus?.storageMode === "degraded" ? "bg-amber-50 text-amber-800" : "text-ink-500"}`}>
        <StatusBadge tone={!storageStatus ? "neutral" : storageStatus.storageMode === "server" ? "success" : storageStatus.storageMode === "degraded" ? "warning" : "neutral"}>
          {!storageStatus ? "正在确认存储" : storageStatus.storageMode === "server" ? "服务端存储" : storageStatus.storageMode === "degraded" ? "服务端只读" : "本地存储"}
        </StatusBadge>
        <p className="mt-1.5">{!storageStatus ? "完成检查后可开始操作。" : storageStatus.storageMode === "server"
          ? "会话按当前匿名工作区隔离并持久化。"
          : storageStatus.storageMode === "degraded"
            ? "写操作已暂停，不会静默保存到本地。"
            : "会话保存在当前浏览器。"}</p>
      </div>
    </div>
  );
}

export function ConversationSidebar(props: ConversationSidebarProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useModalFocus({ open: props.mobileOpen, containerRef: drawerRef, initialFocusRef: closeRef, onClose: props.onCloseMobile });

  return (
    <>
      <aside data-testid="conversation-sidebar" className="hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-slate-200 lg:block">
        <SidebarPanel {...props} />
      </aside>
      {props.mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-conversation-title">
          <button type="button" aria-label="关闭会话抽屉" onClick={props.onCloseMobile} className="absolute inset-0 cursor-default bg-slate-950/40" />
          <aside ref={drawerRef} tabIndex={-1} id="mobile-conversation-drawer" data-testid="conversation-drawer" className="relative h-full w-[min(88vw,320px)] border-r border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <h2 id="mobile-conversation-title" className="font-semibold text-ink-900">会话</h2>
              <button ref={closeRef} type="button" data-testid="conversation-drawer-close" onClick={props.onCloseMobile} className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">关闭</button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">
              <SidebarPanel {...props} onSelected={props.onCloseMobile} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
