"use client";

import { useEffect, useMemo, useState } from "react";
import { clearChatFeedback, loadChatFeedback, summarizeChatFeedback } from "@/lib/chat/feedback";
import type { ChatAnswerFeedbackItem } from "@/types";

function percent(value: number) {
  return `${value}%`;
}

function valueLabels(values: ChatAnswerFeedbackItem["values"]) {
  const labels = {
    positive: "有帮助",
    negative: "没帮助",
    accurate: "引用准确",
    inaccurate: "引用不准确",
  };
  return values.map((value) => labels[value]).join(" / ");
}

export function ChatFeedbackStatsPanel() {
  const [items, setItems] = useState<ChatAnswerFeedbackItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loaded = loadChatFeedback();
    setItems(loaded.data);
    if (!loaded.ok) setMessage(loaded.error);
  }, []);

  const summary = useMemo(() => summarizeChatFeedback(items), [items]);

  function handleClear() {
    if (!window.confirm("确认清空本地 Chat 回答反馈吗？")) return;
    const cleared = clearChatFeedback();
    setItems(cleared.data);
    setMessage(cleared.ok ? "已清空本地反馈记录。" : cleared.error);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">Chat 回答反馈统计</h2>
          <p className="mt-1 text-sm leading-6 text-ink-500">统计来自 /chat 最终回答卡片的本地反馈，用于观察回答帮助度、引用准确性和常见问题类型。</p>
        </div>
        {items.length ? <button type="button" onClick={handleClear} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-slate-50">清空反馈</button> : null}
      </div>
      {message ? <p className="mt-3 rounded-md bg-brand-50 p-3 text-sm text-brand-700">{message}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">总反馈数</p><p className="mt-1 text-xl font-semibold text-ink-900">{summary.total}</p></div>
        <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">有帮助率</p><p className="mt-1 text-xl font-semibold text-ink-900">{percent(summary.helpfulRate)}</p></div>
        <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">引用准确率</p><p className="mt-1 text-xl font-semibold text-ink-900">{percent(summary.citationAccuracyRate)}</p></div>
        <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-ink-500">常见问题类型</p><p className="mt-1 break-words text-sm font-semibold text-ink-900">{summary.commonIssueTypes.join(" / ") || "暂无"}</p></div>
      </div>
      <div className="mt-4 space-y-3">
        {summary.recent.length ? summary.recent.map((item) => (
          <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-900">{new Date(item.createdAt).toLocaleString()}</span>
              <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-ink-600 ring-1 ring-slate-200">{valueLabels(item.values)}</span>
            </div>
            <p className="mt-1 break-words text-ink-600">{item.question}</p>
            {item.reason ? <p className="mt-1 break-words text-ink-500">原因：{item.reason}</p> : null}
          </article>
        )) : <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-ink-500">暂无反馈记录。运行 /chat 并提交反馈后，这里会展示统计。</p>}
      </div>
    </section>
  );
}
