import { expect, test } from "@playwright/test";

async function hasPageOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test("全局导航标识当前页面并提供键盘跳转主内容", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation.getByRole("link", { name: "首页", exact: true })).toHaveAttribute("aria-current", "page");

  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.goto("/knowledge");
  await expect(navigation.getByRole("link", { name: "知识库", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "首页", exact: true })).not.toHaveAttribute("aria-current", "page");
});

test("390px Chat 与 Knowledge 保持关键操作可达且页面不横向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
  await expect(page.getByTestId("conversation-drawer-open")).toBeVisible();
  await expect(page.getByTestId("agent-question")).toBeVisible();
  expect(await hasPageOverflow(page)).toBe(false);

  await page.goto("/knowledge");
  await expect(page.getByRole("heading", { name: "知识库管理", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "搜索知识文档" })).toBeVisible();
  expect(await hasPageOverflow(page)).toBe(false);
});

test("主要工作台在桌面与平板断点保持无页面级横向溢出", async ({ page }) => {
  test.setTimeout(60_000);
  const widths = [768, 1024, 1280, 1440];
  const routes = ["/chat", "/knowledge", "/evaluation", "/ops"];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      expect(await hasPageOverflow(page), `${route} 在 ${width}px 不应出现页面级横向溢出`).toBe(false);
    }
  }
});

test("评测中心与运行监控提供明确的表单和受保护状态语义", async ({ page }) => {
  await page.goto("/evaluation");
  await expect(page.getByRole("heading", { name: "Agent 评测中心" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "知识库范围" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mock 模式" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("尚未运行评测", { exact: true })).toBeVisible();

  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "运行监控" })).toBeVisible();
  await expect(page.getByLabel("运维访问口令")).toBeVisible();
  await expect(page.getByText("运行数据受保护", { exact: true })).toBeVisible();
});

test("未知地址显示可恢复的中文页面状态", async ({ page }) => {
  await page.goto("/not-a-product-route");
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
});
