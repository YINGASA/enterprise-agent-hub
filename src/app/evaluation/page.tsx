import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { metrics, testCases } from "@/data/mock";

export default function EvaluationPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Evaluation"
        title="评测面板"
        description="用 mock 指标和测试集展示企业级 AI 应用需要持续追踪的质量维度。"
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-ink-900">Mock 测试集</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">场景</th>
                <th className="px-5 py-3">输入</th>
                <th className="px-5 py-3">期望工具</th>
                <th className="px-5 py-3">结果</th>
                <th className="px-5 py-3">耗时</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {testCases.map((testCase) => (
                <tr key={testCase.id}>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ink-500">{testCase.id}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-700">{testCase.scenario}</td>
                  <td className="min-w-[260px] px-5 py-4 text-ink-700">{testCase.input}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-brand-700">{testCase.expectedTool}</td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        testCase.result === "pass" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {testCase.result}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-500">{testCase.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
