"use client";

import { useEffect, useRef, useState } from "react";
import type { LlmMode } from "@/types";
import type { LlmHealthResult, LlmStatus } from "@/components/agent-workspace/useAgentWorkspace";

type ChatComposerProps = {
  value: string;
  mode: LlmMode;
  isLoading: boolean;
  isCheckingHealth: boolean;
  realApiUnavailable: boolean;
  storageWritable: boolean;
  llmStatus: LlmStatus | null;
  llmStatusError: string;
  healthResult: LlmHealthResult | null;
  onChange: (value: string) => void;
  onModeChange: (mode: LlmMode) => void;
  onSend: () => void;
  onStop: () => void;
  onCheckHealth: () => void;
};

function statusText(llmStatus: LlmStatus | null, healthResult: LlmHealthResult | null, llmStatusError: string) {
  if (!llmStatus) return llmStatusError || "正在检查模型服务状态";
  if (!llmStatus.configured) return "模型服务未配置，当前使用开发模拟模式";
  if (healthResult?.healthy) return "模型服务连接正常";
  if (healthResult && !healthResult.healthy) return "模型服务连接检查失败";
  return "模型服务已配置";
}

export function ChatComposer(props: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const sendDisabled = props.realApiUnavailable || !props.storageWritable || !props.value.trim();

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(160, Math.max(48, textarea.scrollHeight))}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [props.value]);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent & { keyCode?: number };
    if (event.key !== "Enter" || event.shiftKey || isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
    event.preventDefault();
    if (!props.isLoading && !sendDisabled) props.onSend();
  }

  return (
    <div data-testid="chat-composer" className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
      <div className="mx-auto max-w-4xl rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <label className="sr-only" htmlFor="agent-question">输入消息</label>
        <textarea id="agent-question" ref={textareaRef} data-testid="agent-question" value={props.value} onChange={(event) => props.onChange(event.target.value)} onKeyDown={onKeyDown} onCompositionStart={() => setIsComposing(true)} onCompositionEnd={() => setIsComposing(false)} disabled={props.isLoading || !props.storageWritable} rows={1} placeholder="输入问题，Enter 发送，Shift + Enter 换行" className="block max-h-40 min-h-12 w-full resize-none rounded-t-xl border-0 bg-transparent px-4 py-3 text-sm leading-6 text-ink-900 placeholder:text-ink-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50" />
        <div className="flex items-end justify-between gap-3 border-t border-slate-100 px-3 py-2">
          <details data-testid="agent-mode-options" className="relative min-w-0 text-xs text-ink-500">
            <summary className="cursor-pointer rounded px-1 py-1 font-medium hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">高级选项 · {props.mode === "real" ? "真实模型" : "模拟模式"}</summary>
            <div className="absolute bottom-full left-0 z-10 mb-3 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <div role="group" aria-label="回答运行模式" className="grid grid-cols-2 gap-2">
                {(["real", "mock"] as LlmMode[]).map((mode) => <button key={mode} type="button" data-testid={`agent-mode-${mode}`} aria-pressed={props.mode === mode} disabled={mode === "real" && props.llmStatus?.configured === false} onClick={() => props.onModeChange(mode)} className={"cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 " + (props.mode === mode ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-ink-600 hover:bg-slate-50")}>{mode === "real" ? "真实模型" : "开发模拟"}</button>)}
              </div>
              <p aria-live="polite" className="mt-3 text-xs leading-5 text-ink-500">{statusText(props.llmStatus, props.healthResult, props.llmStatusError)}</p>
              <button type="button" onClick={props.onCheckHealth} disabled={props.isCheckingHealth} className="mt-2 cursor-pointer text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50">{props.isCheckingHealth ? "检查中…" : "检查模型连接"}</button>
            </div>
          </details>
          <button
            type="button"
            data-testid={props.isLoading ? "stop-generation" : "agent-run"}
            aria-label={props.isLoading ? "停止生成" : "发送消息"}
            onClick={props.isLoading ? props.onStop : props.onSend}
            disabled={!props.isLoading && sendDisabled}
            className={"min-h-10 shrink-0 cursor-pointer rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 " + (props.isLoading ? "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500" : "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-500")}
          >{props.isLoading ? "停止生成" : "发送"}</button>
        </div>
      </div>
      <p aria-live="polite" className="mx-auto mt-2 max-w-4xl px-1 text-xs text-ink-500">{props.realApiUnavailable ? "真实模型未配置，请在高级选项中切换到开发模拟模式。" : "回答可能使用当前会话最近内容；历史原文不会显示在上下文状态中。"}</p>
    </div>
  );
}
