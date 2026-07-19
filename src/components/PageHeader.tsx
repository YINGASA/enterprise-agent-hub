import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, meta }: PageHeaderProps) {
  return (
    <section className="mb-6 border-b border-slate-200 pb-5 sm:mb-7 sm:pb-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="app-kicker mb-1.5">{eyebrow}</p> : null}
          <h1 className="max-w-4xl text-2xl font-bold tracking-[-0.02em] text-ink-950 sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-600 sm:text-base sm:leading-7">{description}</p>
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
