type EmptyConversationProps = {
  examples: string[];
  onSelectExample: (question: string) => void;
};

export function EmptyConversation({ examples, onSelectExample }: EmptyConversationProps) {
  return (
    <div data-testid="empty-conversation" className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-4 sm:px-6 sm:py-8">
      <section className="app-panel p-4 sm:p-6" aria-labelledby="empty-conversation-title">
        <p className="app-kicker">聊天工作台</p>
        <h2 id="empty-conversation-title" className="mt-2 text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">从一个明确问题开始</h2>
        <p className="mt-2 max-w-[72ch] text-sm leading-6 text-ink-600">Agent 会结合当前会话、启用的知识文档和业务工具回答。推荐问题只填入输入框，由你确认后发送。</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {examples.slice(0, 4).map((question) => (
            <button key={question} type="button" onClick={() => onSelectExample(question)} className="min-h-12 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm leading-6 text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {question}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-ink-600">连续追问示例</p>
          <ol className="mt-2 flex flex-col gap-2 text-sm leading-6 text-ink-700 sm:flex-row sm:items-center">
            <li><span className="mr-2 font-semibold text-brand-700">1.</span>订单可以退货吗？</li>
            <li aria-hidden="true" className="hidden text-ink-400 sm:block">→</li>
            <li><span className="mr-2 font-semibold text-brand-700">2.</span>那需要准备什么材料？</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
