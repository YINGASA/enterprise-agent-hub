type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="mb-8">
      {eyebrow ? <p className="mb-2 text-sm font-semibold text-brand-600">{eyebrow}</p> : null}
      <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-ink-500">{description}</p>
    </section>
  );
}
