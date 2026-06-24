import { ChatRagDemo } from "@/components/ChatRagDemo";
import { MockJsonPanel } from "@/components/MockJsonPanel";
import { PageHeader } from "@/components/PageHeader";
import { agentDecisions, chatMessages, scenarios, structuredOutput, toolCallLogs } from "@/data/mock";

export default function ChatPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Chat Workspace"
        title="聊天工作台"
        description="保留 V0.1 的静态 Agent 工作台，并新增 V0.3 基础 RAG 演示。当前不接真实 AI，不做复杂 Agent Router。"
      />
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-ink-900">场景选择</h2>
          <div className="mt-4 space-y-3">
            {scenarios.map((scenario, index) => (
              <div
                key={scenario.id}
                className={`rounded-lg border p-3 ${index === 0 ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"}`}
              >
                <p className="text-sm font-semibold text-ink-900">{scenario.name}</p>
                <p className="mt-1 text-xs leading-5 text-ink-500">{scenario.description}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ink-900">Mock 聊天记录</h2>
              <p className="text-sm text-ink-500">静态 Agent 展示保留，下面新增基础 RAG 输入框。</p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">静态展示</span>
          </div>
          <div className="space-y-4">
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                    message.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-ink-700"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-ink-900">Agent 决策过程</h2>
            <div className="mt-4 space-y-3">
              {agentDecisions.map((decision) => (
                <div key={decision.step} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">{decision.step}</p>
                    <span className="text-xs font-semibold text-emerald-700">{decision.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-500">{decision.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <MockJsonPanel title="工具调用记录" data={toolCallLogs} />
          <MockJsonPanel title="结构化输出" data={structuredOutput} />
        </aside>
      </div>
      <ChatRagDemo />
    </div>
  );
}
