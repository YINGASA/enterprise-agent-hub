import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const storageKey = "enterprise-agent-hub:user-knowledge-documents";
const at = "2026-01-01T00:00:00.000Z";
const document = (id: string, title: string, content: string) => ({
  id, title, content, category: "制度流程", tags: ["测试"], summary: content,
  createdAt: at, updatedAt: at, importedAt: at, sourceType: "user_paste", enabled: true, isDefault: false,
});
const backup = (documents: unknown[]) => JSON.stringify({ version: 2, exportedAt: at, documents });

test.afterEach(async ({ page }) => {
  await page.evaluate((key) => localStorage.removeItem(key), storageKey).catch(() => undefined);
});

test("knowledge backup export, preview, merge, replace and validation", async ({ page }, testInfo) => {
  const duplicate = document("duplicate", "重复文档", "重复内容");
  const conflict = document("conflict", "冲突文档", "旧内容");
  await page.addInitScript(({ key, documents }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 2, documents, updatedAt: new Date().toISOString() }));
  }, { key: storageKey, documents: [duplicate, conflict] });
  await page.goto("/knowledge");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("knowledge-backup-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/knowledge-backup.*\.json$/);

  const previewFile = testInfo.outputPath("preview.json");
  await writeFile(previewFile, backup([
    duplicate,
    { ...conflict, content: "冲突后的新内容" },
    document("new", "新增文档", "新增内容"),
    { id: "invalid", title: "非法记录" },
  ]));
  await page.getByTestId("knowledge-backup-file").setInputFiles(previewFile);
  await expect(page.getByTestId("knowledge-backup-preview")).toContainText("新增 1 篇");
  await expect(page.getByTestId("knowledge-backup-preview")).toContainText("重复 1 篇");
  await expect(page.getByTestId("knowledge-backup-preview")).toContainText("冲突 1 篇");
  await expect(page.getByTestId("knowledge-backup-preview")).toContainText("非法 1 篇");

  const mergeFile = testInfo.outputPath("merge.json");
  await writeFile(mergeFile, backup([document("merged", "合并文档", "合并后刷新仍应存在")]));
  await page.getByTestId("knowledge-backup-file").setInputFiles(mergeFile);
  await page.getByTestId("knowledge-backup-apply").click();
  await expect(page.getByTestId("knowledge-backup-notice")).toContainText("已合并恢复 1 篇");
  await page.reload();
  await expect(page.getByText("合并文档", { exact: true }).first()).toBeVisible();

  const replaceFile = testInfo.outputPath("replace.json");
  await writeFile(replaceFile, backup([document("replacement", "替换文档", "替换恢复内容")]));
  await page.getByTestId("knowledge-backup-mode").selectOption("replace");
  await page.getByTestId("knowledge-backup-file").setInputFiles(replaceFile);
  const applyReplace = page.getByTestId("knowledge-backup-apply");
  await applyReplace.click();
  const replaceDialog = page.getByRole("alertdialog", { name: "替换当前用户知识文档？" });
  await expect(replaceDialog).toBeVisible();
  await expect(replaceDialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(replaceDialog).toHaveCount(0);
  await expect(applyReplace).toBeFocused();

  await applyReplace.click();
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.getByRole("button", { name: "确认替换恢复", exact: true }).click();
  await expect(page.getByText("替换文档", { exact: true }).first()).toBeVisible();

  const invalidFile = testInfo.outputPath("invalid.json");
  await writeFile(invalidFile, "not-json");
  await page.getByTestId("knowledge-backup-file").setInputFiles(invalidFile);
  await expect(page.getByTestId("knowledge-backup-preview")).toContainText("新增 0 篇");
  await expect(page.getByTestId("knowledge-backup-apply")).toHaveCount(0);

  const oversizedFile = testInfo.outputPath("oversized.json");
  await writeFile(oversizedFile, "x".repeat(2_000_001));
  await page.getByTestId("knowledge-backup-file").setInputFiles(oversizedFile);
  await expect(page.getByTestId("knowledge-backup-notice")).toContainText("2MB");
});
