import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({ title, description, action, children, className = "", id }: SectionCardProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={`app-panel min-w-0 ${className}`.trim()}>
      {title || description || action ? (
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title ? <h2 id={headingId} className="font-semibold text-ink-950">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
