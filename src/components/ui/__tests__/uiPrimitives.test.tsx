import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isNavigationItemActive } from "@/components/AppNavigation";
import { DataTableShell } from "@/components/ui/DataTableShell";
import { ResponsiveToolbar } from "@/components/ui/ResponsiveToolbar";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatePanel } from "@/components/ui/StatePanel";
import { StatusBadge } from "@/components/ui/StatusBadge";

describe("V2.2.3 UI primitives", () => {
  it("matches nested routes without marking the home item active", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true);
    expect(isNavigationItemActive("/chat", "/")).toBe(false);
    expect(isNavigationItemActive("/knowledge/import", "/knowledge")).toBe(true);
    expect(isNavigationItemActive("/tools", "/knowledge")).toBe(false);
  });

  it("renders status with text and a non-color-only marker", () => {
    const html = renderToStaticMarkup(<StatusBadge tone="warning">服务端降级</StatusBadge>);
    expect(html).toContain("服务端降级");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-amber-500");
  });

  it("renders accessible live states and an action", () => {
    const html = renderToStaticMarkup(
      <StatePanel title="保存冲突" description="服务器版本已更新，请重新读取后再试。" tone="danger" live="assertive" action={<button type="button">重新读取</button>} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("保存冲突");
    expect(html).toContain("重新读取");
  });

  it("does not announce static neutral states as live updates", () => {
    const html = renderToStaticMarkup(<StatePanel title="暂无记录" description="创建第一条记录后会显示在这里。" headingLevel={1} />);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("aria-live");
    expect(html).toContain("<h1");
  });

  it("associates section cards with their headings", () => {
    const section = renderToStaticMarkup(<SectionCard id="storage-health" title="存储健康"><p>正常</p></SectionCard>);
    expect(section).toContain('aria-labelledby="storage-health-title"');
    expect(section).toContain('id="storage-health-title"');
  });

  it("makes dense tables keyboard-scrollable and toolbars responsive", () => {
    const table = renderToStaticMarkup(<DataTableShell label="订单表，可横向滚动"><table><tbody><tr><td>10001</td></tr></tbody></table></DataTableShell>);
    const toolbar = renderToStaticMarkup(<ResponsiveToolbar label="订单筛选"><button type="button">查询</button></ResponsiveToolbar>);
    expect(table).toContain('role="region"');
    expect(table).toContain('tabindex="0"');
    expect(table).toContain('aria-label="订单表，可横向滚动"');
    expect(toolbar).toContain('role="group"');
    expect(toolbar).toContain('aria-label="订单筛选"');
  });

  it("defines shared design tokens and reduced-motion behavior", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("--app-bg:");
    expect(css).toContain("--app-focus:");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition-duration: 0.01ms !important");
  });
});
