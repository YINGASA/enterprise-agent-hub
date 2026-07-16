type EmptyConversationProps = {
  examples: string[];
  onSelectExample: (question: string) => void;
};

export function EmptyConversation({ examples, onSelectExample }: EmptyConversationProps) {
  return (
    <div data-testid="empty-conversation" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Enterprise Agent</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">开始一段可连续追问的对话</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600">系统会先理解当前问题，再结合知识库、业务工具和当前会话最近内容生成回答。推荐问题只会填入输入框，不会自动发送。</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {examples.slice(0, 4).map((question) => (
            <button key={question} type="button" onClick={() => onSelectExample(question)} className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm leading-6 text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {question}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <p className="text-sm font-semibold text-brand-700">多轮示例</p>
          <ol className="mt-2 space-y-2 text-sm leading-6 text-ink-700">
            <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700">1</span>订单可以退货吗？</li>
            <li><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700">2</span>那需要准备什么材料？</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
