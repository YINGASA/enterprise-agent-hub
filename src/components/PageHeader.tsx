type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p> : null}
      <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-ink-600">{description}</p>
    </section>
  );
}
