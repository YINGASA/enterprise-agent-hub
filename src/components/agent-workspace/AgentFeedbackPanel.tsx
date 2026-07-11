import type { ChatAnswerFeedbackValue } from "@/types";

type Props = {
  values: ChatAnswerFeedbackValue[];
  reason: string;
  message: string;
  onToggle: (value: ChatAnswerFeedbackValue) => void;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
};

const feedbackOptions: Array<[ChatAnswerFeedbackValue, string]> = [
  ["positive", "有帮助"],
  ["negative", "没帮助"],
  ["accurate", "引用准确"],
  ["inaccurate", "引用不准确"],
];

function buttonClass(active: boolean) {
  return "rounded-md border px-3 py-2 text-xs font-semibold transition " + (active ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-ink-600 hover:bg-brand-50");
}

export function AgentFeedbackPanel({ values, reason, message, onToggle, onReasonChange, onSubmit }: Props) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-ink-900">回答反馈</h3>
      <p className="mt-1 text-xs leading-5 text-ink-500">反馈仅保存在当前浏览器本地，用于统计回答帮助度和引用准确性。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {feedbackOptions.map(([value, label]) => (
          <button key={value} type="button" data-testid={`agent-feedback-${value}`} onClick={() => onToggle(value)} className={buttonClass(values.includes(value))}>{label}</button>
        ))}
      </div>
      <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} rows={2} className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="可选：补充这次回答哪里好或哪里需要改进" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="agent-feedback-submit" onClick={onSubmit} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">提交反馈</button>
        {message ? <p className="break-words text-sm text-ink-600">{message}</p> : null}
      </div>
    </div>
  );
}
