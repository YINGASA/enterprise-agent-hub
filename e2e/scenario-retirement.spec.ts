import { expect, test, type Download, type Page, type Route } from "@playwright/test";

const conversationKey = "enterprise-agent-hub:conversations";
const feedbackKey = "enterprise-agent-hub:chat-answer-feedback";
const knowledgeKey = "enterprise-agent-hub:user-knowledge-documents";
const retiredProductCopy = /招聘求职|(?:招聘|求职) Agent|简历(?:优化|分析)|面试辅导|职位推荐|职业规划|招聘与岗位匹配|JD 匹配/;

function mockAgentResponse(question: string, runId: string, answer: string) {
  return {
    question,
    route: { scenario: "ecommerce", intent: "order_query", needRag: true, toolsNeeded: ["queryOrder"], confidence: 0.92, reason: "e2e enterprise workflow" },
    steps: [{ id: `${runId}-tool`, name: "查询订单", type: "tool", status: "success", durationMs: 3 }],
    ragAnswer: {
      question,
      answer: "退货制度依据",
      retrievedChunks: [],
      sources: [{ documentId: "return-policy", title: "售后退货制度", category: "售后规则", sourceType: "default", score: 20, chunkIndexes: [0] }],
      mode: "mock-rag",
      createdAt: "2026-07-13T00:00:00.000Z",
      retrievalConfidence: "high",
    },
    toolResults: [{ tool: "queryOrder", status: "success", input: {}, data: {}, executedAt: "2026-07-13T00:00:00.000Z" }],
    finalAnswer: answer,
    structuredOutput: { scenario: "ecommerce", intent: "order_query", answer, evidence: ["售后退货制度"], toolsUsed: ["queryOrder"], sources: ["售后退货制度"], confidence: 0.92, riskLevel: "low", nextAction: "准备退货材料" },
    createdAt: "2026-07-13T00:00:00.000Z",
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock" },
    runId,
  };
}

function mockStreamBody(result: ReturnType<typeof mockAgentResponse>) {
  const midpoint = Math.ceil(result.finalAnswer.length / 2);
  const chunks = [result.finalAnswer.slice(0, midpoint), result.finalAnswer.slice(midpoint)].filter(Boolean);
  const completed = {
    ...result,
    api: { ...result.api, streamingRequested: true, streamingUsed: true, streamFallback: false, aborted: false, streamDeltaCount: chunks.length },
  };
  return [
    { type: "run_started", runId: result.runId, requestedMode: "mock", responseMode: "mock", contextApplied: false, contextMessageCount: 0, contextTruncated: false },
    { type: "phase", phase: "understand" },
    { type: "phase", phase: "retrieve" },
    { type: "phase", phase: "tool" },
    { type: "phase", phase: "generate" },
    ...chunks.map((delta, index) => ({ type: "answer_delta", delta, index })),
    { type: "answer_completed", result: completed, streamingRequested: true, streamingUsed: true, streamFallback: false, deltaCount: chunks.length },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function fulfillMockStream(route: Route, result: ReturnType<typeof mockAgentResponse>) {
  await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body: mockStreamBody(result) });
}

async function selectMockMode(page: Page) {
  await page.getByTestId("agent-mode-options").locator("summary").click();
  await page.getByTestId("agent-mode-mock").click();
}

async function readDownload(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test.afterEach(async ({ page }) => {
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), [conversationKey, feedbackKey, knowledgeKey]).catch(() => undefined);
});

test("removes the retired recruitment Agent from every active product entry", async ({ page }) => {
  for (const path of ["/", "/chat", "/scenarios", "/tools", "/evaluation"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(retiredProductCopy);
  }
});

test("opens a legacy recruitment conversation without reactivating it from URL state", async ({ page }) => {
  const savedAt = "2026-01-01T00:00:00.000Z";
  await page.addInitScript(({ key, at }) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      updatedAt: at,
      data: [{
        activeConversationId: "legacy-recruitment",
        legacyHistoryMigrated: true,
        conversations: [{
          id: "legacy-recruitment",
          title: "历史场景会话",
          titleSource: "manual",
          createdAt: at,
          updatedAt: at,
          schemaVersion: 1,
          messages: [
            { id: "legacy-user", role: "user", content: "历史用户问题", createdAt: at },
            { id: "legacy-assistant", role: "assistant", content: "已保留的历史回答", createdAt: at, responseMode: "mock", scenario: "recruitment", intent: "jd_match", runId: "legacy-recruitment-run" },
          ],
        }],
      }],
    }));
  }, { key: conversationKey, at: savedAt });
  let streamRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/stream")) streamRequests += 1;
  });

  await page.goto("/chat?scenario=recruitment");

  await expect(page.getByTestId("conversation-message-user")).toContainText("历史用户问题");
  await expect(page.getByTestId("assistant-answer")).toContainText("已保留的历史回答");
  await expect(page.getByRole("button", { name: retiredProductCopy })).toHaveCount(0);
  expect(streamRequests).toBe(0);
  const storedScenario = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.[0]?.conversations?.[0]?.messages?.[1]?.scenario, conversationKey);
  expect(storedScenario).toBe("recruitment");
});

test("preserves, toggles and exports recruitment-related user knowledge", async ({ page }) => {
  const title = "用户自定义候选人面试制度";
  const content = "这是用户自行导入的企业招聘制度，包含候选人面试材料、内部审批流程和不得自动删除的保护要求。";
  await page.goto("/knowledge");
  await page.getByTestId("knowledge-document-title").fill(title);
  await page.getByTestId("knowledge-document-content").fill(content);
  await page.getByTestId("knowledge-document-submit").click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  const documentId = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.documents?.find((document: { title?: string }) => document.title === "用户自定义候选人面试制度")?.id, knowledgeKey) as string;
  expect(documentId).toBeTruthy();
  await page.getByTestId(`knowledge-document-toggle-${documentId}`).click();
  await page.reload();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId(`knowledge-document-toggle-${documentId}`)).toContainText("启用检索");
  await page.getByTestId(`knowledge-document-toggle-${documentId}`).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("knowledge-backup-export").click();
  const exported = await readDownload(await downloadPromise);
  expect(exported).toContain(title);
  expect(exported).toContain(content);
  expect(JSON.parse(exported).documents).toContainEqual(expect.objectContaining({ id: documentId, enabled: true, sourceType: "user_paste" }));
});

test("keeps the enterprise order workflow and V2.0.3 message actions together", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  let call = 0;
  let feedbackRunId = "";
  await page.route("**/api/agent/stream", async (route) => {
    call += 1;
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    requests.push(body);
    const action = String(body.requestAction ?? "send");
    const answer = action === "regenerate" ? "重新生成的企业售后回答。" : action === "edit_resend" ? "修改问题后的企业售后回答。" : "订单可按售后制度申请退货。";
    await fulfillMockStream(route, mockAgentResponse(String(body.question ?? ""), `enterprise-run-${call}`, answer));
  });
  await page.route("**/api/ops/feedback", async (route) => {
    feedbackRunId = String((JSON.parse(route.request().postData() ?? "{}") as { runId?: string }).runId ?? "");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("订单10001可以退货吗？");
  await page.getByTestId("agent-run").click();
  let assistant = page.getByTestId("conversation-message-assistant");
  await assistant.getByTestId("assistant-details").getByText("查看依据、工具与执行过程", { exact: true }).click();
  await expect(assistant.getByTestId("assistant-sources")).toContainText("售后退货制度");
  await expect(assistant.getByTestId("assistant-tools")).toBeVisible();

  await assistant.getByTestId("assistant-regenerate").click();
  await expect(assistant).toHaveAttribute("data-run-id", "enterprise-run-2");
  await page.getByTestId("user-edit").click();
  await page.getByTestId("user-edit-input").fill("订单10001退货需要什么材料？");
  await page.getByTestId("user-edit-submit").click();
  assistant = page.getByTestId("conversation-message-assistant");
  await expect(assistant).toHaveAttribute("data-run-id", "enterprise-run-3");
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  expect(requests.map((request) => request.requestAction)).toEqual(["send", "regenerate", "edit_resend"]);

  await assistant.getByTestId("assistant-feedback").locator("summary").click();
  await assistant.getByTestId("agent-feedback-positive").click();
  await assistant.getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("enterprise-run-3");
});
