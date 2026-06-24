import type { Scenario } from "@/types";

export function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-ink-900">{scenario.name}</h3>
        <p className="mt-2 text-sm leading-6 text-ink-500">{scenario.description}</p>
      </div>
      <div className="space-y-4 text-sm">
        <div>
          <p className="font-medium text-ink-700">适用问题</p>
          <ul className="mt-2 space-y-1 text-ink-500">
            {scenario.questions.map((question) => (
              <li key={question}>- {question}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-medium text-ink-700">可调用工具</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenario.tools.map((tool) => (
              <span key={tool} className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                {tool}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium text-ink-700">输出结果类型</p>
          <p className="mt-2 text-ink-500">{scenario.outputType}</p>
        </div>
      </div>
    </article>
  );
}
