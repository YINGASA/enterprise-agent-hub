import { expect, test } from "@playwright/test";

const enabled = process.env.RUN_SERVER_STORAGE_E2E === "1";
test.skip(!enabled, "仅在 CI 临时 PostgreSQL 16 数据库中执行真实服务端存储 E2E。");

test("PostgreSQL 服务端知识包导入可恢复、可检索且工作区隔离", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required for server storage E2E.");
  const root = baseURL;
  const first = await browser.newContext();
  const second = await browser.newContext();
  const marker = `PG-E2E-${Date.now()}`;
  let packId = "";
  try {
    const page = await first.newPage();
    await page.goto("/knowledge");
    await expect(page.getByTestId("storage-status")).toContainText("服务端存储");

    await page.getByTestId("knowledge-pack-name").fill(`${marker}-制度包`);
    await page.getByTestId("knowledge-pack-create").click();
    const packCard = page.locator('article[data-testid^="knowledge-pack-"]').filter({ hasText: `${marker}-制度包` });
    await expect(packCard).toBeVisible();
    packId = (await packCard.getAttribute("data-testid"))?.replace("knowledge-pack-", "") ?? "";
    expect(packId).not.toBe("");

    await page.getByTestId("knowledge-import-pack").selectOption(packId);
    await page.getByTestId("knowledge-import-files").setInputFiles([
      {
        name: `${marker}-employee-policy.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(`星河审批码 Q7X9 是员工设备申请的唯一业务编号。${marker}。`.repeat(30)),
      },
      {
        name: `${marker}-travel-policy.md`,
        mimeType: "text/markdown",
        buffer: Buffer.from(`# 差旅规则\n\n${marker} 的差旅申请需要在出发前完成主管审批，并保留报销凭证。\n`.repeat(30)),
      },
    ]);
    const previewResponsePromise = page.waitForResponse((response) => (
      response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/storage/knowledge/import/preview"
    ));
    await page.getByTestId("knowledge-import-preview").click();
    const previewResponse = await previewResponsePromise;
    expect(previewResponse.status(), await safeImportErrorCode(previewResponse)).toBe(201);
    const previewItems = page.locator('[data-testid^="knowledge-import-item-"]');
    await expect(previewItems).toHaveCount(2);
    await expect(previewItems.first()).toContainText("checksum 已计算");
    await expect(previewItems.first()).toContainText(/优秀|可用|需处理/);
    const beforeConfirmation = await first.request.get(`${root}/api/storage/knowledge`);
    expect((await beforeConfirmation.json()).documents).toEqual([]);
    await previewItems.first().locator("input").first().fill(`${marker}-员工设备制度`);

    await page.getByTestId("knowledge-import-confirm").click();
    await expect(page.getByTestId("knowledge-import-notice")).toContainText("成功 2", { timeout: 30_000 });
    await expect(page.getByTestId("knowledge-import-notice")).toContainText("失败 0");
    await expect(page.getByText(`${marker}-员工设备制度`, { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("knowledge-batch-import")).toContainText("completed");
    await expect(page.getByText(`${marker}-员工设备制度`, { exact: true }).first()).toBeVisible();
    await page.getByText(`${marker}-员工设备制度`, { exact: true }).first().click();
    const testBench = page.locator("section").filter({ hasText: "RAG 检索测试台" }).first();
    await testBench.locator("textarea").fill("星河审批码 Q7X9 用于什么申请？");
    await testBench.getByRole("button", { name: "测试当前文档" }).click();
    await expect(testBench.getByText("用户文档命中", { exact: true }).locator("..")).toContainText("是");

    const secondPage = await second.newPage();
    await secondPage.goto("/knowledge");
    await expect(secondPage.getByTestId("storage-status")).toContainText("服务端存储");
    await expect(secondPage.getByText(`${marker}-制度包`, { exact: true })).toHaveCount(0);
    await expect(secondPage.getByText(`${marker}-员工设备制度`, { exact: true })).toHaveCount(0);
    const secondPacks = await second.request.get(`${root}/api/storage/knowledge/packs`);
    const secondDocuments = await second.request.get(`${root}/api/storage/knowledge`);
    expect((await secondPacks.json()).packs).toEqual([]);
    expect((await secondDocuments.json()).documents).toEqual([]);
  } finally {
    const documentsResponse = await first.request.get(`${root}/api/storage/knowledge`).catch(() => null);
    if (documentsResponse?.ok()) {
      const body = await documentsResponse.json() as { documents?: Array<{ id: string; title: string }> };
      for (const document of body.documents ?? []) {
        if (document.title.startsWith(marker)) {
          await first.request.delete(`${root}/api/storage/knowledge/${encodeURIComponent(document.id)}`, {
            headers: { origin: root },
          }).catch(() => undefined);
        }
      }
    }
    if (packId) {
      const packResponse = await first.request.get(`${root}/api/storage/knowledge/packs/${encodeURIComponent(packId)}`).catch(() => null);
      if (packResponse?.ok()) {
        const body = await packResponse.json() as { pack?: { revision: number } };
        await first.request.delete(`${root}/api/storage/knowledge/packs/${encodeURIComponent(packId)}`, {
          headers: { "content-type": "application/json", origin: root },
          data: { expectedRevision: body.pack?.revision ?? 0 },
        }).catch(() => undefined);
      }
    }
    await first.close();
    await second.close();
  }
});

async function safeImportErrorCode(response: import("@playwright/test").Response) {
  if (response.ok()) return "knowledge import preview succeeded";
  try {
    const body = await response.json() as { errorCode?: unknown; error?: unknown };
    const code = typeof body.errorCode === "string" ? body.errorCode : typeof body.error === "string" ? body.error : "unknown_error";
    return `knowledge import preview failed: HTTP ${response.status()} (${code})`;
  } catch {
    return `knowledge import preview failed: HTTP ${response.status()} (invalid_error_response)`;
  }
}
