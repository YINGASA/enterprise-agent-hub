"use client";

import { useState } from "react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleSection({ title, description, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-ink-900">{title}</span>
          {description ? <span className="mt-1 block text-sm leading-6 text-ink-500">{description}</span> : null}
        </span>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-ink-600">{open ? "收起" : "展开"}</span>
      </button>
      {open ? <div className="border-t border-slate-200 p-5">{children}</div> : null}
    </section>
  );
}
