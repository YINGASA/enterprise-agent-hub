import { expect, test } from "@playwright/test";

const storageKey = "enterprise-agent-hub:user-knowledge-documents";
const title = "V1.12.4 E2E 测试文档";

test.afterEach(async ({ page }) => {
  await page.evaluate((key) => localStorage.removeItem(key), storageKey).catch(() => undefined);
});

test("creates, selects, toggles, refreshes and deletes a browser-local knowledge document", async ({ page }) => {
  await page.goto("/knowledge");
  await page.getByTestId("knowledge-document-title").fill(title);
  await page.getByTestId("knowledge-document-content").fill("这是用于验证知识库工作台结构拆分的本地测试文档，包含检索和刷新所需内容。");
  await page.getByTestId("knowledge-document-submit").click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  await page.getByText(title, { exact: true }).first().click();
  await expect(page.getByRole("complementary").getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "禁用检索", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "启用检索", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "启用检索", exact: true }).first().click();

  await page.reload();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "删除", exact: true }).first().click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
