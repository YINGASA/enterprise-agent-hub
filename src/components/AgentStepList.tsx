import type { AgentStep } from "@/types";

const statusClass: Record<AgentStep["status"], string> = {
  success: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  skipped: "bg-slate-100 text-ink-500",
};

export function AgentStepList({ steps }: { steps: AgentStep[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink-900">执行步骤</h3>
      <div className="space-y-3">
        {steps.map((step) => (
          <article key={step.id} className="min-w-0 rounded-md border border-slate-200 p-3">
            <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-ink-900">{step.name}</p>
                <p className="text-xs text-ink-500">{step.type} · {step.durationMs}ms</p>
              </div>
              <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass[step.status]}`}>{step.status}</span>
            </div>
            <pre className="max-h-44 max-w-full overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-xs leading-5 text-ink-700">
              {JSON.stringify({ input: step.input, output: step.output }, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
