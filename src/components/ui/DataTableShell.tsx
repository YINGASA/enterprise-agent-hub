import type { ReactNode } from "react";

type DataTableShellProps = {
  label: string;
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function DataTableShell({ label, children, title, description, action, className = "" }: DataTableShellProps) {
  return (
    <div className={className}>
      {title || description || action ? (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title ? <h3 className="font-semibold text-ink-900">{title}</h3> : null}
            {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
          </div>
          {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-x-auto rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        {children}
      </div>
    </div>
  );
}
