"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export const appNavigationItems = [
  { href: "/", label: "首页" },
  { href: "/chat", label: "聊天工作台" },
  { href: "/knowledge", label: "知识库" },
  { href: "/tools", label: "业务工具" },
  { href: "/scenarios", label: "场景模板" },
  { href: "/evaluation", label: "评测中心" },
  { href: "/ops", label: "运行监控" },
  { href: "/about", label: "关于" },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label="主导航" className="app-scrollbar-hidden min-w-0 overflow-x-auto">
      <div className="flex min-w-max items-center gap-1 py-1">
        {appNavigationItems.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              ref={active ? activeItemRef : undefined}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100"
                  : "text-ink-600 hover:bg-slate-100 hover:text-ink-900")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
