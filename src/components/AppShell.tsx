import Link from "next/link";
import type { ReactNode } from "react";
import { AppNavigation } from "@/components/AppNavigation";
import { appVersion } from "@/lib/appVersion";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--app-bg)] text-ink-900">
      <a href="#main-content" className="fixed left-3 top-3 z-[80] -translate-y-20 rounded-md bg-ink-950 px-3 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">
        跳到主要内容
      </a>
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 shadow-[0_1px_0_rgba(16,24,40,0.02)] backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-1.5 px-4 py-2.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
          <Link href="/" aria-label="返回 Enterprise Agent Hub 首页" className="flex shrink-0 items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-brand-500">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-xs font-bold tracking-wide text-white shadow-sm">
              EAH
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-950 sm:text-base">
                Enterprise Agent Hub
                <span className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 sm:inline">V{appVersion}</span>
              </span>
              <span className="block truncate text-[11px] text-ink-500 sm:text-xs">企业知识问答与业务流程工作台</span>
            </span>
          </Link>
          <AppNavigation />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
