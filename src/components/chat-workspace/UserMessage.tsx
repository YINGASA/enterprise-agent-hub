"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "@/types";

type UserMessageProps = {
  message: ConversationMessage;
  canEdit?: boolean;
  disabled?: boolean;
  onEditResend?: (messageId: string, question: string) => void;
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
}

export function UserMessage({ message, canEdit = false, disabled = false, onEditResend }: UserMessageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(message.content);
  }, [editing, message.content]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  function cancel() {
    setDraft(message.content);
    setEditing(false);
  }

  function submit() {
    if (disabled) return;
    const nextQuestion = draft.trim();
    if (!nextQuestion) return;
    setEditing(false);
    if (nextQuestion === message.content.trim()) return;
    onEditResend?.(message.id, nextQuestion);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent & { keyCode?: number };
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Enter" || event.shiftKey || isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
    event.preventDefault();
    submit();
  }

  return (
    <article data-testid="conversation-message-user" data-message-id={message.id} className="flex min-w-0 w-full justify-end">
      <div className="ml-auto min-w-0 w-full max-w-3xl">
        <div className="mb-1.5 flex items-center justify-end gap-2 text-xs text-ink-500">
          <span className="font-semibold text-ink-600">你的问题</span>
          {canEdit ? <button type="button" data-testid="user-edit" aria-label="编辑最后一条用户问题" disabled={disabled} onClick={() => setEditing(true)} className="cursor-pointer rounded px-1.5 py-0.5 font-medium text-ink-500 hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50">编辑</button> : null}
          <time className="app-tabular" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </div>
        {editing ? (
          <div className="rounded-lg border border-brand-300 bg-white p-3 shadow-sm">
            <label htmlFor={`edit-${message.id}`} className="sr-only">编辑最后一条用户问题</label>
            <textarea id={`edit-${message.id}`} ref={textareaRef} data-testid="user-edit-input" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={() => setIsComposing(false)} rows={3} className="max-h-40 min-h-20 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-100" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" data-testid="user-edit-cancel" onClick={cancel} className="cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">取消</button>
              <button type="button" data-testid="user-edit-submit" disabled={disabled || !draft.trim()} onClick={submit} className="cursor-pointer rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300">重新发送</button>
            </div>
          </div>
        ) : <p className="whitespace-pre-wrap break-words rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-7 text-ink-800">{message.content}</p>}
      </div>
    </article>
  );
}
