import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/chat", label: "聊天工作台" },
  { href: "/knowledge", label: "知识库" },
  { href: "/tools", label: "业务工具" },
  { href: "/scenarios", label: "场景模板" },
  { href: "/evaluation", label: "评测面板" },
  { href: "/ops", label: "运行状态" },
  { href: "/about", label: "项目说明" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50 text-ink-900">
      <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              EAH
            </span>
            <span>
              <span className="block text-base font-semibold">Enterprise Agent Hub</span>
              <span className="block text-xs text-ink-500">企业知识库与业务流程自动化 Agent 平台</span>
            </span>
          </Link>
          <nav className="flex gap-2 overflow-x-auto text-sm text-ink-500">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-2 transition hover:bg-brand-50 hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
    </div>
  );
}
