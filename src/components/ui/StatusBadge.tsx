import type { ReactNode } from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-ink-600",
  info: "border-brand-100 bg-brand-50 text-brand-800",
  success: "border-emerald-100 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusTone;
  showDot?: boolean;
  className?: string;
};

export function StatusBadge({ children, tone = "neutral", showDot = true, className = "" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${toneClasses[tone]} ${className}`.trim()}>
      {showDot ? <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClasses[tone]}`} /> : null}
      <span>{children}</span>
    </span>
  );
}
