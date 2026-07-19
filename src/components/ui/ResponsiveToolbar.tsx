import type { ReactNode } from "react";

type ResponsiveToolbarProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function ResponsiveToolbar({ children, label, className = "" }: ResponsiveToolbarProps) {
  return (
    <div role={label ? "group" : undefined} aria-label={label} className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between ${className}`.trim()}>
      {children}
    </div>
  );
}
