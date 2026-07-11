import { expect, test } from "@playwright/test";

const chatHistoryKey = "enterprise-agent-hub:chat-run-history";

async function selectMockMode(page: import("@playwright/test").Page) {
  await page.getByTestId("agent-mode-options").locator("summary").click();
  await page.getByTestId("agent-mode-mock").click();
}

test.afterEach(async ({ page }) => {
  await page.evaluate((key) => localStorage.removeItem(key), chatHistoryKey).catch(() => undefined);
});

test("runs a mock chat from URL prefill and keeps local history safe after refresh", async ({ page }) => {
  const agentRequests: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent") && request.method() === "POST") {
      agentRequests.push(JSON.parse(request.postData() ?? "{}") as Record<string, unknown>);
    }
  });

  await page.goto("/chat?question=%E8%AE%A2%E5%8D%9510001%E8%83%BD%E4%B8%8D%E8%83%BD%E9%80%80%EF%BC%9F");
  await expect(page.getByTestId("agent-question")).toHaveValue("订单10001能不能退？");
  await selectMockMode(page);
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("agent-answer")).not.toContainText("输入问题并运行 Agent Pipeline 后，回答会显示在这里。");
  expect(agentRequests).toHaveLength(1);
  expect(agentRequests[0]?.mode).toBe("mock");

  await page.getByRole("button", { name: "保存本次运行" }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.length ?? 0, chatHistoryKey)).toBe(1);
  await page.reload();
  await expect(page.getByTestId("agent-question")).toBeVisible();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.length ?? 0, chatHistoryKey)).toBe(1);
});

test("renders clarification and fallback responses without optional display data", async ({ page }) => {
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      question: "我想报销",
      route: { scenario: "enterprise", intent: "policy_check", needRag: true, toolsNeeded: [], confidence: 0.4, reason: "e2e" },
      steps: [],
      ragAnswer: null,
      toolResults: [],
      finalAnswer: "请补充报销金额和票据类型。",
      structuredOutput: { scenario: "enterprise", intent: "policy_check", answer: "请补充报销金额和票据类型。", evidence: [], toolsUsed: [], sources: [], confidence: 0.4, riskLevel: "low", nextAction: "补充信息", needsClarification: true, missingFields: ["金额"], clarificationQuestion: "报销金额是多少？" },
      createdAt: "2026-07-11T00:00:00.000Z",
      mode: "mock-agent",
      api: { requestedMode: "mock", responseMode: "fallback" },
      runId: "e2e-clarification",
    }) });
  });

  await page.goto("/chat");
  await page.getByTestId("agent-question").fill("我想报销");
  await selectMockMode(page);
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("agent-answer")).toContainText("请补充报销金额和票据类型。");
  await expect(page.getByText("需要补充信息", { exact: true })).toBeVisible();
});

test("keeps rate-limit and feedback runId handling on the workspace request path", async ({ page }) => {
  let feedbackRunId = "";
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      question: "测试反馈",
      route: { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.8, reason: "e2e" },
      steps: [], ragAnswer: null, toolResults: [], finalAnswer: "用于验证反馈关联。",
      structuredOutput: { scenario: "general", intent: "general_chat", answer: "用于验证反馈关联。", evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" },
      createdAt: "2026-07-11T00:00:00.000Z", mode: "mock-agent", api: { requestedMode: "mock", responseMode: "mock" }, runId: "e2e-feedback-run",
    }) });
  });
  await page.route("**/api/ops/feedback", async (route) => {
    feedbackRunId = String((JSON.parse(route.request().postData() ?? "{}") as { runId?: string }).runId ?? "");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/chat");
  await page.getByTestId("agent-question").fill("测试反馈");
  await selectMockMode(page);
  await page.getByTestId("agent-run").click();
  await page.getByTestId("agent-feedback-positive").click();
  await page.getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("e2e-feedback-run");

  await page.unroute("**/api/agent");
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ errorType: "rate_limited", message: "请求过于频繁，请稍后再试。" }) });
  });
  await page.getByTestId("agent-run").click();
  await expect(page.getByText("运行失败：请求过于频繁，请稍后再试。", { exact: true })).toBeVisible();
});
