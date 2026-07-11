import { expect, test } from "@playwright/test";

const keys = {
  chat: "enterprise-agent-hub:chat-run-history",
  feedback: "enterprise-agent-hub:chat-answer-feedback",
  evaluation: "enterprise-agent-hub:evaluation-history",
  rag: "enterprise-agent-hub:rag-test-history",
};
const at = "2026-01-01T00:00:00.000Z";
const chat = { id: "legacy-chat", createdAt: at, question: "旧聊天迁移问题", finalAnswer: "旧回答", responseMode: "mock", scenario: "enterprise", intent: "knowledge_qa" };
const feedback = { id: "legacy-feedback", createdAt: at, question: "旧反馈问题", answerPreview: "旧回答", values: ["positive"], scenario: "enterprise", intent: "knowledge_qa", responseMode: "mock", sourceTitles: [] };
const evaluation = { id: "legacy-eval", createdAt: at, mode: "mock", suite: "full", caseCount: 80, passed: 80, passRate: 100, scenarioAccuracy: 100, intentAccuracy: 100, toolHitRate: 100, ragUsageAccuracy: 100, citationRate: 100, keywordHitRate: 100 };
const rag = { version: 1, id: "legacy-rag", question: "旧 RAG 测试问题", testedAt: at, hit: true, confidence: "high", candidateCount: 3 };

test.afterEach(async ({ page }) => {
  await page.evaluate((storageKeys) => Object.values(storageKeys).forEach((key) => localStorage.removeItem(key)), keys).catch(() => undefined);
});

test("migrates legacy arrays, filters invalid records and persists after refresh", async ({ page }) => {
  const postedBodies: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") postedBodies.push(request.postData() ?? ""); });
  await page.addInitScript(({ storageKeys, values }) => {
    if (!localStorage.getItem(storageKeys.chat)) localStorage.setItem(storageKeys.chat, JSON.stringify([values.chat, { id: "invalid" }]));
    if (!localStorage.getItem(storageKeys.feedback)) localStorage.setItem(storageKeys.feedback, JSON.stringify([values.feedback, { values: ["unknown"] }]));
    if (!localStorage.getItem(storageKeys.evaluation)) localStorage.setItem(storageKeys.evaluation, JSON.stringify([values.evaluation, { id: "invalid", passed: 81 }]));
    if (!localStorage.getItem(storageKeys.rag)) localStorage.setItem(storageKeys.rag, JSON.stringify([values.rag, { version: 1, id: "invalid" }]));
  }, { storageKeys: keys, values: { chat, feedback, evaluation, rag } });

  await page.goto("/chat");
  await expect(page.getByText("旧聊天迁移问题", { exact: true })).toBeVisible();
  await page.goto("/evaluation");
  await expect(page.getByText("80 条用例 · 80 条通过", { exact: false })).toBeVisible();
  await expect(page.getByText("总反馈数").locator("..")).toContainText("1");
  await page.goto("/knowledge");
  await expect(page.getByText("RAG 测试历史：1 条", { exact: true })).toBeVisible();

  const migrated = await page.evaluate((storageKeys) => Object.fromEntries(Object.entries(storageKeys).map(([name, key]) => [name, JSON.parse(localStorage.getItem(key) || "null")])), keys);
  for (const value of Object.values(migrated)) {
    expect(value.version).toBe(1);
    expect(value.data).toHaveLength(1);
  }
  await page.reload();
  await expect(page.getByText("RAG 测试历史：1 条", { exact: true })).toBeVisible();
  expect(postedBodies.join("\n")).not.toMatch(/legacy-chat|legacy-feedback|legacy-eval|legacy-rag|旧聊天迁移问题/);
});

test("corrupted JSON never crashes the consuming pages", async ({ page }) => {
  await page.addInitScript((storageKeys) => Object.values(storageKeys).forEach((key) => localStorage.setItem(key, "{")), keys);
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "聊天工作台" })).toBeVisible();
  await page.goto("/evaluation");
  await expect(page.getByRole("heading", { name: "Agent 评测面板", exact: true })).toBeVisible();
  await page.goto("/knowledge");
  await expect(page.getByRole("heading", { name: "知识库管理", exact: true })).toBeVisible();
});
