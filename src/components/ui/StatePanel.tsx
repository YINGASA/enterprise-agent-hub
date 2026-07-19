import type { ReactNode } from "react";
import type { StatusTone } from "@/components/ui/StatusBadge";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-ink-700",
  info: "border-brand-100 bg-brand-50 text-brand-900",
  success: "border-emerald-100 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
};

const iconText: Record<StatusTone, string> = {
  neutral: "·",
  info: "i",
  success: "✓",
  warning: "!",
  danger: "×",
};

type StatePanelProps = {
  title: string;
  description: string;
  tone?: StatusTone;
  action?: ReactNode;
  compact?: boolean;
  live?: "polite" | "assertive";
  headingLevel?: 1 | 2 | 3;
  className?: string;
};

export function StatePanel({ title, description, tone = "neutral", action, compact = false, live, headingLevel = 2, className = "" }: StatePanelProps) {
  const role = tone === "danger" ? "alert" : live ? "status" : undefined;
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      role={role}
      aria-live={live}
      className={`rounded-lg border ${toneClasses[tone]} ${compact ? "p-3" : "p-4"} ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 bg-white/70 text-xs font-bold">
          {iconText[tone]}
        </span>
        <div className="min-w-0 flex-1">
          <Heading className="text-sm font-semibold">{title}</Heading>
          <p className="mt-1 break-words text-sm leading-6 opacity-80">{description}</p>
          {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
        </div>
      </div>
    </section>
  );
}
