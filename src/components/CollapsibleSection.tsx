"use client";

import { useId, useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, description, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-panel">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 rounded-lg px-4 py-3 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:px-5 sm:py-4"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-ink-900">{title}</span>
          {description ? <span className="mt-1 block text-sm leading-6 text-ink-500">{description}</span> : null}
        </span>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-600">{open ? "收起" : "展开"}</span>
      </button>
      {open ? <div id={panelId} className="border-t border-slate-200 p-4 sm:p-5">{children}</div> : null}
    </section>
  );
}
