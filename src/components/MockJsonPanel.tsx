export function MockJsonPanel({ title, data }: { title: string; data: unknown }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">mock JSON</span>
      </div>
      <pre className="max-h-[420px] overflow-auto rounded-md bg-slate-900 p-4 text-xs leading-6 text-slate-200">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
