import { expect, test, type Page, type Route } from "@playwright/test";
import type { AgentApiResponse, ConversationSummaryState } from "@/types";

const chatHistoryKey = "enterprise-agent-hub:chat-run-history";
const conversationKey = "enterprise-agent-hub:conversations";
const feedbackKey = "enterprise-agent-hub:chat-answer-feedback";

async function selectMockMode(page: Page) {
  await page.getByTestId("agent-mode-options").locator("summary").click();
  await page.getByTestId("agent-mode-mock").click();
  await expect(page.getByTestId("agent-mode-options").locator("summary")).toContainText("模拟模式");
}

async function readConversationStore(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.[0] ?? null, conversationKey) as Promise<{ activeConversationId: string; conversations: Array<{ id: string; title: string; messages: unknown[]; conversationSummary?: ConversationSummaryState }> }>;
}

function mockAgentResponse(question: string, runId: string, overrides: Record<string, unknown> = {}): AgentApiResponse {
  return {
    question,
    route: { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.8, reason: "e2e" },
    steps: [],
    ragAnswer: null,
    toolResults: [],
    finalAnswer: `回答：${question}`,
    structuredOutput: { scenario: "general", intent: "general_chat", answer: `回答：${question}`, evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" },
    createdAt: "2026-07-13T00:00:00.000Z",
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock" },
    runId,
    ...overrides,
  } as AgentApiResponse;
}

function mockStreamBody(result: ReturnType<typeof mockAgentResponse>, deltas?: string[]) {
  const answer = String(result.finalAnswer ?? "");
  const chunks = deltas ?? (answer.length > 1 ? [answer.slice(0, Math.ceil(answer.length / 2)), answer.slice(Math.ceil(answer.length / 2))] : [answer]);
  const { conversationSummaryPatch, ...safeResult } = result;
  const completed = {
    ...safeResult,
    api: { ...safeResult.api, streamingRequested: true, streamingUsed: true, streamFallback: false, aborted: false, streamDeltaCount: chunks.length },
  };
  return [
    { type: "run_started", runId: result.runId, requestedMode: "mock", responseMode: "mock", contextApplied: false, contextMessageCount: 0, contextTruncated: false },
    { type: "phase", phase: "understand" },
    { type: "phase", phase: "generate" },
    ...chunks.map((delta, index) => ({ type: "answer_delta", delta, index })),
    { type: "answer_completed", result: completed, ...(conversationSummaryPatch ? { conversationSummaryPatch } : {}), streamingRequested: true, streamingUsed: true, streamFallback: false, deltaCount: chunks.length },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function fulfillMockStream(route: Route, result: ReturnType<typeof mockAgentResponse>, deltas?: string[]) {
  await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body: mockStreamBody(result, deltas) });
}

function seedConversation(id: string, title: string, messagePairs: number, updatedAt: string) {
  const messages = Array.from({ length: messagePairs * 2 }, (_, index) => ({
    id: `${id}-message-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: index % 2 === 0 ? `${title} 用户问题 ${index / 2 + 1}：请继续说明相关流程和限制条件。` : `${title} Agent 回答 ${(index + 1) / 2}：这是用于浏览器滚动验证的安全本地消息。`,
    createdAt: new Date(Date.parse(updatedAt) + index * 1_000).toISOString(),
    ...(index % 2 === 1 ? { responseMode: "mock", scenario: "general", intent: "general_chat", contextApplied: index > 1, contextMessageCount: Math.min(index, 12), contextTruncated: false } : {}),
  }));
  return { id, title, titleSource: "manual", createdAt: updatedAt, updatedAt, schemaVersion: 1, messages };
}

async function seedConversationStore(page: Page, conversations: ReturnType<typeof seedConversation>[], activeConversationId: string) {
  await page.addInitScript(({ key, store }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ version: 1, data: [store], updatedAt: "2026-07-13T00:00:00.000Z" }));
    }
  }, {
    key: conversationKey,
    store: { activeConversationId, conversations, legacyHistoryMigrated: true },
  });
}

test.afterEach(async ({ page }) => {
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), [chatHistoryKey, conversationKey, feedbackKey]).catch(() => undefined);
});

test("uses recent mock context in the continuous desktop chat layout and restores it", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/stream") && request.method() === "POST") requests.push(JSON.parse(request.postData() ?? "{}") as Record<string, unknown>);
  });
  await page.goto("/chat");
  await expect(page.getByTestId("conversation-sidebar")).toBeVisible();
  await expect(page.getByTestId("chat-composer")).toBeVisible();
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("订单10001可以退货吗？");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  await page.getByTestId("agent-question").fill("那需要准备什么材料？");
  await page.getByTestId("agent-run").click();
  const assistants = page.getByTestId("conversation-message-assistant");
  await expect(assistants).toHaveCount(2);
  await expect(assistants.last().getByTestId("assistant-answer")).toContainText("订单号");
  await expect(assistants.last().getByTestId("assistant-context-meta")).toContainText("已参考最近 1 轮对话");
  const order = await page.getByTestId("conversation-messages")
    .locator('[data-testid="conversation-message-user"], [data-testid="conversation-message-assistant"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
  expect(order).toEqual(["conversation-message-user", "conversation-message-assistant", "conversation-message-user", "conversation-message-assistant"]);
  const userBox = await page.getByTestId("conversation-message-user").first().locator("p").last().boundingBox();
  const assistantBox = await assistants.first().getByTestId("assistant-answer").boundingBox();
  expect(userBox?.x ?? 0).toBeGreaterThan(assistantBox?.x ?? 0);
  expect(requests.map((request) => request.mode)).toEqual(["mock", "mock"]);
  expect(requests[1]?.question).toBe("那需要准备什么材料？");
  expect(requests[1]?.contextCandidates).toEqual([
    expect.objectContaining({ role: "user", content: "订单10001可以退货吗？" }),
    expect.objectContaining({ role: "assistant" }),
  ]);
  await page.reload();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(2);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(2);
  await expect(page.getByTestId("conversation-message-assistant").last().getByTestId("assistant-context-meta")).toContainText("已参考最近 1 轮对话");
  await expect(page.getByTestId("chat-composer")).toBeVisible();
});

test("persists and reuses a rolling summary without crossing conversations", async ({ page }) => {
  const first = seedConversation("summary-one", "摘要会话", 8, "2026-07-13T07:00:00.000Z");
  const second = seedConversation("summary-two", "隔离会话", 1, "2026-07-13T06:00:00.000Z");
  const requests: Array<Record<string, unknown>> = [];
  const patch = { set: { text: "已确认事项：订单 ORD-10001 不要取消。", throughMessageId: "summary-one-message-7", updatedAt: "2026-07-16T00:00:00.000Z", version: 1, sourceMessageCount: 8 } };
  await page.route("**/api/llm/status", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: false }) }));
  await page.route("**/api/agent/stream", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    requests.push(body);
    await fulfillMockStream(route, mockAgentResponse(String(body.question ?? ""), `summary-run-${requests.length}`, { conversationSummaryPatch: patch }));
  });
  await seedConversationStore(page, [first, second], first.id);
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("继续处理订单 ORD-10001");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(9);
  const saved = await readConversationStore(page);
  const savedFirst = saved.conversations.find((conversation) => conversation.id === first.id);
  expect(savedFirst?.conversationSummary).toMatchObject(patch.set);
  expect(requests[0]?.conversationSummary).toBeUndefined();

  await page.reload();
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("订单 ORD-10001 还有什么限制？");
  await expect(page.getByTestId("agent-run")).toBeEnabled();
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(10);
  expect(requests[1]?.conversationSummary).toEqual({ text: patch.set.text, throughMessageId: patch.set.throughMessageId, version: 1, sourceMessageCount: 8 });

  await page.getByTestId("conversation-list-item").filter({ hasText: "隔离会话" }).getByTestId("conversation-select").click();
  const isolated = await readConversationStore(page);
  expect(isolated.conversations.find((conversation) => conversation.id === second.id)?.conversationSummary).toBeUndefined();
});

test("starts a delayed isolated conversation without persisting duplicate empty drafts", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/agent/stream") && request.method() === "POST") requests.push(JSON.parse(request.postData() ?? "{}") as Record<string, unknown>);
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("订单10001可以退货吗？");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  const previous = await readConversationStore(page);
  await page.getByTestId("conversation-new").click();
  await page.getByTestId("conversation-new").click();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(0);
  expect((await readConversationStore(page)).conversations).toHaveLength(previous.conversations.length);
  await page.getByTestId("agent-question").fill("那需要准备什么材料？");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant").last().getByTestId("assistant-answer")).not.toContainText("结合刚才的订单退货语境");
  await expect(page.getByTestId("conversation-message-assistant").last().getByTestId("assistant-context-meta")).toHaveCount(0);
  expect(requests[1]?.contextCandidates).toEqual([]);
  const next = await readConversationStore(page);
  expect(next.activeConversationId).not.toBe(previous.activeConversationId);
  expect(next.conversations).toHaveLength(previous.conversations.length + 1);
});

test("keeps URL prefill and legacy run history available from a secondary dialog", async ({ page }) => {
  await page.goto("/chat?question=%E8%AE%A2%E5%8D%9510001%E8%83%BD%E4%B8%8D%E8%83%BD%E9%80%80%EF%BC%9F");
  await expect(page.getByTestId("agent-question")).toHaveValue("订单10001能不能退？");
  await selectMockMode(page);
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant").last().getByTestId("assistant-answer")).toBeVisible();
  await page.getByTestId("chat-history-open").click();
  await page.getByRole("button", { name: "保存本次运行" }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.length ?? 0, chatHistoryKey)).toBe(1);
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.data?.length ?? 0, chatHistoryKey)).toBe(1);
});

test("renders clarification as a normal assistant message", async ({ page }) => {
  await page.route("**/api/agent/stream", async (route) => {
    await fulfillMockStream(route, mockAgentResponse("我想报销", "e2e-clarification", {
      route: { scenario: "enterprise", intent: "policy_check", needRag: true, toolsNeeded: [], confidence: 0.4, reason: "e2e" },
      finalAnswer: "请补充报销金额和票据类型。",
      structuredOutput: { scenario: "enterprise", intent: "policy_check", answer: "请补充报销金额和票据类型。", evidence: [], toolsUsed: [], sources: [], confidence: 0.4, riskLevel: "low", nextAction: "补充信息", needsClarification: true, missingFields: ["金额"], clarificationQuestion: "报销金额是多少？" },
      api: { requestedMode: "mock", responseMode: "fallback" },
    }));
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("我想报销");
  await page.getByTestId("agent-run").click();
  const assistant = page.getByTestId("conversation-message-assistant").last();
  await expect(assistant.getByTestId("assistant-answer")).toContainText("请补充报销金额和票据类型。");
  await expect(assistant.getByText("当前回答需要你补充信息后才能继续判断。", { exact: true })).toBeVisible();
});

test("supports Enter send, Shift+Enter newline and IME-safe composition", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/agent/stream", async (route) => {
    requestCount += 1;
    const question = String((JSON.parse(route.request().postData() ?? "{}") as { question?: string }).question ?? "");
    await fulfillMockStream(route, mockAgentResponse(question, `keyboard-run-${requestCount}`));
  });
  await page.goto("/chat");
  await selectMockMode(page);
  const composer = page.getByTestId("agent-question");
  await composer.fill("第一行");
  await composer.press("Shift+Enter");
  await composer.type("第二行");
  await expect(composer).toHaveValue("第一行\n第二行");
  expect(requestCount).toBe(0);

  await composer.fill("中文组合输入");
  await composer.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "入" }));
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter", isComposing: true }));
    element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "入" }));
  });
  expect(requestCount).toBe(0);
  await composer.press("Enter");
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  expect(requestCount).toBe(1);
});

test("renders deterministic Mock stream deltas before completing the assistant answer", async ({ page }) => {
  await page.goto("/chat");
  await selectMockMode(page);
  await page.evaluate(() => {
    const state = window as typeof window & { __eahStreamSnapshots?: string[] };
    state.__eahStreamSnapshots = [];
    new MutationObserver(() => {
      const text = document.querySelector<HTMLElement>("[data-testid='stream-answer']")?.innerText ?? "";
      if (text && state.__eahStreamSnapshots?.at(-1) !== text) state.__eahStreamSnapshots?.push(text);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByTestId("agent-question").fill("请详细说明订单10001退货所需材料、办理步骤、时间限制和注意事项。");
  await page.getByTestId("agent-run").click();

  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect(page.getByTestId("assistant-streaming")).toBeVisible();
  await expect(page.getByTestId("chat-composer")).toBeVisible();

  const assistant = page.getByTestId("conversation-message-assistant").last();
  await expect(assistant.getByTestId("assistant-answer")).toBeVisible();
  await expect(assistant.getByTestId("assistant-feedback")).toBeVisible();
  await expect(page.getByTestId("assistant-streaming")).toHaveCount(0);
  const snapshots = await page.evaluate(() => (window as typeof window & { __eahStreamSnapshots?: string[] }).__eahStreamSnapshots ?? []);
  expect(new Set(snapshots).size).toBeGreaterThan(1);
  expect(snapshots.every((value, index) => index === 0 || value.length >= snapshots[index - 1].length)).toBe(true);
  const store = await readConversationStore(page);
  expect(store.conversations.find((conversation) => conversation.id === store.activeConversationId)?.messages).toHaveLength(2);
});

test("stops a Mock stream without persisting the partial answer and retries the same user turn", async ({ page }) => {
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("请完整列出企业差旅报销的全部材料、审批步骤、例外情形和注意事项。");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("stop-generation")).toBeVisible();
  await page.getByTestId("stop-generation").click();

  await expect(page.getByTestId("assistant-stopped")).toContainText("已停止生成");
  await expect(page.getByTestId("agent-question")).toBeEnabled();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  const stoppedStore = await readConversationStore(page);
  expect(stoppedStore?.conversations?.find((conversation) => conversation.id === stoppedStore.activeConversationId)?.messages ?? []).toHaveLength(0);

  await page.getByTestId("retry-generation").click();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  const completedStore = await readConversationStore(page);
  expect(completedStore.conversations.find((conversation) => conversation.id === completedStore.activeConversationId)?.messages).toHaveLength(2);
});

test("keeps feedback on the target run and retries failures without duplicating the optimistic user message", async ({ page }) => {
  let feedbackRunId = "";
  await page.route("**/api/agent/stream", async (route) => fulfillMockStream(route, mockAgentResponse("测试反馈", "e2e-feedback-run")));
  await page.route("**/api/ops/feedback", async (route) => {
    feedbackRunId = String((JSON.parse(route.request().postData() ?? "{}") as { runId?: string }).runId ?? "");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("测试反馈");
  await page.getByTestId("agent-run").click();
  const firstAssistant = page.getByTestId("conversation-message-assistant").first();
  await firstAssistant.getByTestId("assistant-feedback").locator("summary").click();
  await firstAssistant.getByTestId("agent-feedback-positive").click();
  await firstAssistant.getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("e2e-feedback-run");

  await page.unroute("**/api/agent/stream");
  await page.route("**/api/agent/stream", async (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ errorType: "rate_limited", message: "请求过于频繁，请稍后再试。" }) }));
  await page.getByTestId("agent-question").fill("再次测试");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("assistant-error")).toContainText("请求过于频繁，请稍后再试。");
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(2);
  const failedStore = await readConversationStore(page);
  expect(failedStore.conversations.find((conversation) => conversation.id === failedStore.activeConversationId)?.messages).toHaveLength(2);

  await page.unroute("**/api/agent/stream");
  await page.route("**/api/agent/stream", async (route) => fulfillMockStream(route, mockAgentResponse("再次测试", "e2e-retry-run")));
  await page.getByTestId("agent-retry").click();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(2);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(2);
  const retriedAssistant = page.getByTestId("conversation-message-assistant").last();
  await retriedAssistant.getByTestId("assistant-feedback").locator("summary").click();
  await retriedAssistant.getByTestId("agent-feedback-positive").click();
  await retriedAssistant.getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("e2e-retry-run");
  const retriedStore = await readConversationStore(page);
  expect(retriedStore.conversations.find((conversation) => conversation.id === retriedStore.activeConversationId)?.messages).toHaveLength(4);
});

test("keeps the composer fixed while long streamed answers scroll independently", async ({ page }) => {
  const conversation = seedConversation("scroll-conversation", "长对话滚动", 20, "2026-07-13T01:00:00.000Z");
  await seedConversationStore(page, [conversation], conversation.id);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agent/stream", async (route) => {
    await gate;
    await fulfillMockStream(route, mockAgentResponse("滚动中的新问题", "scroll-run"));
  });
  await page.goto("/chat");
  await selectMockMode(page);
  const list = page.getByTestId("message-list");
  const composer = page.getByTestId("chat-composer");
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.getByTestId("agent-question").fill("滚动中的新问题");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("assistant-pending")).toBeVisible();
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const before = await composer.boundingBox();
  await list.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
  await expect(page.getByTestId("jump-to-latest")).toBeVisible();
  release?.();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(21);
  expect(await list.evaluate((element) => element.scrollTop)).toBeLessThan(5);
  await expect(page.getByTestId("jump-to-latest")).toBeVisible();
  const after = await composer.boundingBox();
  expect(Math.abs((before?.y ?? 0) - (after?.y ?? 0))).toBeLessThan(2);
  await page.getByTestId("jump-to-latest").click();
  await expect.poll(() => list.evaluate((element) => Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight))).toBeLessThan(5);
});

test("searches, renames, clears and deletes independent conversations", async ({ page }) => {
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("公司差旅报销材料有哪些？");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  await page.getByTestId("conversation-new").click();
  await page.getByTestId("conversation-new").click();
  expect((await readConversationStore(page)).conversations).toHaveLength(1);
  await page.getByTestId("agent-question").fill("订单10001可以退货吗？");
  await page.getByTestId("agent-run").click();
  await expect.poll(async () => (await readConversationStore(page)).conversations.length).toBe(2);
  await expect(page.getByTestId("conversation-list-item")).toHaveCount(2);

  await page.getByTestId("conversation-search").fill("差旅报销");
  const target = page.getByTestId("conversation-list-item").filter({ hasText: "公司差旅报销材料有哪些？" });
  await expect(target).toHaveCount(1);
  await target.getByTestId("conversation-select").click();
  await target.getByTestId("conversation-rename").click();
  await page.getByTestId("conversation-rename-input").fill("差旅报销会话");
  await page.getByTestId("conversation-rename-input").press("Enter");
  await page.getByTestId("conversation-search").fill("");
  await expect(page.getByTestId("conversation-title").filter({ hasText: "差旅报销会话" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("conversation-title").filter({ hasText: "差旅报销会话" })).toBeVisible();

  await page.getByTestId("conversation-clear").click();
  await page.getByTestId("conversation-confirm-submit").click();
  await expect(page.getByTestId("empty-conversation")).toBeVisible();
  expect((await readConversationStore(page)).conversations).toHaveLength(2);
  await expect(page.getByTestId("chat-header")).toContainText("新对话");

  const orderConversation = page.getByTestId("conversation-list-item").filter({ hasText: "订单10001可以退货吗？" });
  await orderConversation.getByTestId("conversation-select").click();
  await page.getByTestId("conversation-delete-current").click();
  await page.getByTestId("conversation-confirm-submit").click();
  expect((await readConversationStore(page)).conversations).toHaveLength(1);
  await expect(page.getByTestId("conversation-title").filter({ hasText: "新对话" })).toBeVisible();
});

test("uses a keyboard-accessible conversation drawer on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  const first = seedConversation("mobile-one", "移动会话一", 1, "2026-07-13T02:00:00.000Z");
  const second = seedConversation("mobile-two", "移动会话二", 1, "2026-07-13T03:00:00.000Z");
  await seedConversationStore(page, [second, first], first.id);
  await page.goto("/chat");
  await expect(page.getByTestId("conversation-sidebar")).toBeHidden();
  await expect(page.getByTestId("chat-composer")).toBeVisible();
  await page.getByTestId("conversation-drawer-open").click();
  const drawer = page.getByTestId("conversation-drawer");
  await expect(drawer).toBeVisible();
  await drawer.getByTestId("conversation-list-item").filter({ hasText: "移动会话二" }).getByTestId("conversation-select").click();
  await expect(page.getByTestId("conversation-drawer")).toHaveCount(0);
  await expect(page.getByTestId("chat-header")).toContainText("移动会话二");
  await expect(page.getByTestId("conversation-message-assistant").getByTestId("assistant-copy")).toBeVisible();
  await expect(page.getByTestId("conversation-message-assistant").getByTestId("assistant-regenerate")).toBeVisible();
  await expect(page.getByTestId("conversation-message-user").getByTestId("user-edit")).toBeVisible();
  await page.getByTestId("conversation-drawer-open").click();
  const reopenedDrawer = page.getByTestId("conversation-drawer");
  await expect(reopenedDrawer.getByTestId("conversation-clear-mobile")).toBeVisible();
  await expect(reopenedDrawer.getByTestId("chat-history-open-mobile")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("conversation-drawer")).toHaveCount(0);
  await expect(page.getByTestId("conversation-drawer-open")).toBeFocused();
  await expect(page.getByTestId("chat-composer")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("keeps sources, tools, trace and feedback with the assistant answer that produced them", async ({ page }) => {
  let call = 0;
  let feedbackRunId = "";
  await page.route("**/api/agent/stream", async (route) => {
    call += 1;
    const question = String((JSON.parse(route.request().postData() ?? "{}") as { question?: string }).question ?? "");
    const response = call === 1 ? mockAgentResponse(question, "details-run-one", {
      route: { scenario: "enterprise", intent: "knowledge_qa", needRag: true, toolsNeeded: ["searchPolicy"], confidence: 0.9, reason: "e2e" },
      steps: [{ id: "step-one", name: "第一轮规则检索", type: "tool", status: "success", input: { private: "not-persisted" }, output: { private: "not-persisted" }, durationMs: 3 }],
      ragAnswer: { answer: "规则依据", sources: [{ documentId: "source-one", title: "第一轮政策来源", category: "企业制度", sourceType: "default", score: 20, chunkIndexes: [0] }], retrievedChunks: [], retrievalConfidence: "high", lowConfidenceRetrieval: false },
      toolResults: [{ tool: "searchPolicy", status: "success", input: { private: "not-persisted" }, data: { private: "not-persisted" }, executedAt: "2026-07-13T00:00:00.000Z" }],
      finalAnswer: "第一轮有依据的回答。",
      structuredOutput: { scenario: "enterprise", intent: "knowledge_qa", answer: "第一轮有依据的回答。", evidence: [], toolsUsed: ["searchPolicy"], sources: ["第一轮政策来源"], confidence: 0.9, riskLevel: "low", nextAction: "继续" },
    }) : mockAgentResponse(question, "details-run-two", { finalAnswer: "第二轮独立回答。", structuredOutput: { scenario: "general", intent: "general_chat", answer: "第二轮独立回答。", evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" } });
    await fulfillMockStream(route, response);
  });
  await page.route("**/api/ops/feedback", async (route) => {
    feedbackRunId = String((JSON.parse(route.request().postData() ?? "{}") as { runId?: string }).runId ?? "");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("第一轮政策问题");
  await page.getByTestId("agent-run").click();
  await page.getByTestId("agent-question").fill("第二轮问题");
  await page.getByTestId("agent-run").click();
  const assistants = page.getByTestId("conversation-message-assistant");
  await expect(assistants).toHaveCount(2);
  await assistants.first().getByTestId("assistant-details").getByText("查看依据、工具与执行过程", { exact: true }).click();
  await expect(assistants.first().getByTestId("assistant-sources")).toContainText("第一轮政策来源");
  await expect(assistants.first().getByTestId("assistant-tools")).toContainText("规则检索");
  await expect(assistants.first().getByTestId("assistant-trace-summary")).toContainText("第一轮规则检索");
  await expect(assistants.last()).not.toContainText("第一轮政策来源");
  await expect(assistants.first().getByTestId("assistant-feedback")).toHaveCount(0);
  await assistants.last().getByTestId("assistant-feedback").locator("summary").click();
  await assistants.last().getByTestId("agent-feedback-positive").click();
  await assistants.last().getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("details-run-two");
});

test("does not revive a deleted conversation when its pending stream finishes", async ({ page }) => {
  const first = seedConversation("pending-one", "待删除会话", 1, "2026-07-13T04:00:00.000Z");
  const second = seedConversation("safe-two", "保留会话", 1, "2026-07-13T03:00:00.000Z");
  await seedConversationStore(page, [first, second], first.id);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agent/stream", async (route) => {
    await gate;
    await fulfillMockStream(route, mockAgentResponse("等待中的问题", "late-run")).catch(() => undefined);
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("等待中的问题");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("assistant-pending")).toBeVisible();
  const activeItem = page.getByTestId("conversation-list-item").filter({ hasText: "待删除会话" });
  await activeItem.getByTestId("conversation-delete").click();
  await page.getByTestId("conversation-confirm-submit").click();
  release?.();
  await expect.poll(async () => (await readConversationStore(page)).conversations.some((conversation) => conversation.id === first.id)).toBe(false);
  await expect(page.getByTestId("chat-header")).toContainText("保留会话");
  await expect(page.getByTestId("assistant-pending")).toHaveCount(0);
  expect((await readConversationStore(page)).conversations.find((conversation) => conversation.id === second.id)?.messages).toHaveLength(2);
});

test("does not write late stream events into a conversation selected later", async ({ page }) => {
  const first = seedConversation("switch-one", "发起请求的会话", 1, "2026-07-13T05:00:00.000Z");
  const second = seedConversation("switch-two", "切换后的会话", 1, "2026-07-13T04:00:00.000Z");
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agent/stream", async (route) => {
    const question = String((JSON.parse(route.request().postData() ?? "{}") as { question?: string }).question ?? "");
    await gate;
    await fulfillMockStream(route, mockAgentResponse(question, "late-send-run", { finalAnswer: "不得串入切换后会话的回答。" })).catch(() => undefined);
  });
  await seedConversationStore(page, [first, second], first.id);
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("订单10001可以退货吗？请详细说明退货材料、办理步骤、时间限制、例外条件和全部注意事项。");
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("assistant-pending")).toBeVisible();
  await page.evaluate(() => {
    const target = [...document.querySelectorAll<HTMLElement>("[data-testid='conversation-list-item']")]
      .find((element) => element.innerText.includes("切换后的会话"));
    target?.querySelector<HTMLButtonElement>("[data-testid='conversation-select']")?.click();
  });
  release?.();
  await expect(page.getByTestId("chat-header")).toContainText("切换后的会话");
  await expect(page.getByTestId("assistant-pending")).toHaveCount(0);
  await expect(page.getByTestId("conversation-messages")).not.toContainText("不得串入切换后会话的回答");
  await page.waitForTimeout(600);
  await expect.poll(async () => (await readConversationStore(page)).activeConversationId).toBe(second.id);
  const store = await readConversationStore(page);
  expect(store.conversations.find((conversation) => conversation.id === first.id)?.messages).toHaveLength(2);
  expect(store.conversations.find((conversation) => conversation.id === second.id)?.messages).toHaveLength(2);
  expect(JSON.stringify(store)).not.toMatch(/请详细说明退货材料|late-send-run/);
  await page.getByTestId("conversation-list-item").filter({ hasText: "发起请求的会话" }).getByTestId("conversation-select").click();
  await expect(page.getByTestId("assistant-pending")).toHaveCount(0);
  await expect(page.getByTestId("assistant-stopped")).toHaveCount(0);
});

test("copies only the visible completed Assistant answer", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const answer = "可复制的回答正文。\n第二行保留换行。";
  await page.route("**/api/agent/stream", async (route) => fulfillMockStream(route, mockAgentResponse("复制测试", "copy-run", {
    finalAnswer: answer,
    structuredOutput: { scenario: "general", intent: "general_chat", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" },
  })));
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("复制测试");
  await page.getByTestId("agent-run").click();

  const assistant = page.getByTestId("conversation-message-assistant");
  await assistant.getByTestId("assistant-copy").click();
  await expect(assistant.getByTestId("assistant-copy-status")).toHaveText("已复制");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replace(/\r\n/g, "\n")).toBe(answer);
  expect(copied).not.toMatch(/copy-run|Trace|responseMode|requestAction/);
});

test("regenerates only the latest completed answer with a new run and feedback target", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  let call = 0;
  let feedbackRunId = "";
  await page.route("**/api/agent/stream", async (route) => {
    call += 1;
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    requests.push(body);
    const answer = call === 1 ? "原始回答。" : "重新生成后的回答。";
    if (call > 1) await new Promise((resolve) => setTimeout(resolve, 80));
    await fulfillMockStream(route, mockAgentResponse(String(body.question ?? ""), call === 1 ? "regen-old-run" : "regen-new-run", {
      finalAnswer: answer,
      structuredOutput: { scenario: "general", intent: "general_chat", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" },
    }));
  });
  await page.route("**/api/ops/feedback", async (route) => {
    feedbackRunId = String((JSON.parse(route.request().postData() ?? "{}") as { runId?: string }).runId ?? "");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("请回答同一个问题");
  await page.getByTestId("agent-run").click();
  const assistant = page.getByTestId("conversation-message-assistant");
  await expect(assistant).toHaveAttribute("data-run-id", "regen-old-run");

  await assistant.getByTestId("assistant-regenerate").click();
  await expect(page.getByTestId("revision-streaming")).toBeVisible();
  await expect(assistant.getByTestId("assistant-answer")).toHaveText("重新生成后的回答。");
  await expect(assistant).toHaveAttribute("data-run-id", "regen-new-run");
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  expect(requests[1]?.requestAction).toBe("regenerate");
  expect(requests[1]?.question).toBe("请回答同一个问题");
  expect((requests[1]?.conversationContext as { messages?: unknown[] })?.messages ?? []).toHaveLength(0);

  await assistant.getByTestId("assistant-feedback").locator("summary").click();
  await assistant.getByTestId("agent-feedback-positive").click();
  await assistant.getByTestId("agent-feedback-submit").click();
  await expect.poll(() => feedbackRunId).toBe("regen-new-run");
  const store = await readConversationStore(page);
  expect(store.conversations.find((conversation) => conversation.id === store.activeConversationId)?.messages).toHaveLength(2);
  expect(JSON.stringify(store)).not.toContain("regen-old-run");
});

test("restores the original answer and feedback after a stopped regeneration", async ({ page }) => {
  let call = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agent/stream", async (route) => {
    call += 1;
    if (call === 1) {
      await fulfillMockStream(route, mockAgentResponse("停止重新生成", "regen-stable-run", { finalAnswer: "必须保留的原回答。" }));
      return;
    }
    await gate;
    await fulfillMockStream(route, mockAgentResponse("停止重新生成", "regen-aborted-run", { finalAnswer: "不应保存的新回答。" })).catch(() => undefined);
  });
  await page.route("**/api/ops/feedback", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("停止重新生成");
  await page.getByTestId("agent-run").click();
  const assistant = page.getByTestId("conversation-message-assistant");
  await assistant.getByTestId("assistant-feedback").locator("summary").click();
  await assistant.getByTestId("agent-feedback-positive").click();
  await assistant.getByTestId("agent-feedback-submit").click();
  const feedbackBefore = await page.evaluate((key) => localStorage.getItem(key), feedbackKey);

  await assistant.getByTestId("assistant-regenerate").click();
  await expect(page.getByTestId("revision-streaming")).toBeVisible();
  await page.getByTestId("stop-generation").click();
  release?.();
  await expect(page.getByTestId("revision-streaming").getByTestId("assistant-stopped")).toBeVisible();
  await expect(assistant.getByTestId("assistant-answer")).toHaveText("必须保留的原回答。");
  await expect(assistant).toHaveAttribute("data-run-id", "regen-stable-run");
  expect(await page.evaluate((key) => localStorage.getItem(key), feedbackKey)).toBe(feedbackBefore);
  await page.reload();
  await expect(page.getByTestId("conversation-message-assistant").getByTestId("assistant-answer")).toHaveText("必须保留的原回答。");
  await expect(page.getByTestId("conversation-message-assistant")).toHaveAttribute("data-run-id", "regen-stable-run");
});

test("edits and resends the latest user question without duplicating the turn", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  let call = 0;
  await page.route("**/api/agent/stream", async (route) => {
    call += 1;
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    requests.push(body);
    const answer = call === 1 ? "旧问题的回答。" : "修改后问题的回答。";
    if (call > 1) await new Promise((resolve) => setTimeout(resolve, 80));
    await fulfillMockStream(route, mockAgentResponse(String(body.question ?? ""), call === 1 ? "edit-old-run" : "edit-new-run", {
      finalAnswer: answer,
      structuredOutput: { scenario: "general", intent: "general_chat", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.8, riskLevel: "low", nextAction: "结束" },
    }));
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("原始用户问题");
  await page.getByTestId("agent-run").click();
  await page.getByTestId("user-edit").click();
  await expect(page.getByTestId("user-edit-input")).toHaveValue("原始用户问题");
  await page.getByTestId("user-edit-input").fill("修改后的用户问题");
  await page.getByTestId("user-edit-submit").click();
  await expect(page.getByTestId("revision-streaming")).toBeVisible();
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(1);
  await expect(page.getByTestId("conversation-message-user")).toContainText("修改后的用户问题");
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(1);
  await expect(page.getByTestId("assistant-answer")).toHaveText("修改后问题的回答。");
  await expect(page.getByTestId("conversation-message-assistant")).toHaveAttribute("data-run-id", "edit-new-run");
  expect(requests[1]?.requestAction).toBe("edit_resend");
  expect(requests[1]?.question).toBe("修改后的用户问题");
  expect((requests[1]?.conversationContext as { messages?: unknown[] })?.messages ?? []).toHaveLength(0);
  expect(JSON.stringify(await readConversationStore(page))).not.toMatch(/原始用户问题|旧问题的回答|edit-old-run/);
  await page.reload();
  await expect(page.getByTestId("conversation-message-user")).toContainText("修改后的用户问题");
  await expect(page.getByTestId("assistant-answer")).toHaveText("修改后问题的回答。");
});

test("cancels latest-question editing without changing messages or sending a request", async ({ page }) => {
  let requestCount = 0;
  await page.route("**/api/agent/stream", async (route) => {
    requestCount += 1;
    const question = String((JSON.parse(route.request().postData() ?? "{}") as { question?: string }).question ?? "");
    await fulfillMockStream(route, mockAgentResponse(question, "edit-cancel-run"));
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("agent-question").fill("不可改变的原问题");
  await page.getByTestId("agent-run").click();
  const before = JSON.stringify(await readConversationStore(page));
  await page.getByTestId("user-edit").click();
  await page.getByTestId("user-edit-input").fill("取消的修改");
  await page.getByTestId("user-edit-input").press("Escape");
  await expect(page.getByTestId("user-edit-input")).toHaveCount(0);
  await expect(page.getByTestId("conversation-message-user")).toContainText("不可改变的原问题");
  await expect(page.getByTestId("assistant-answer")).toContainText("不可改变的原问题");
  expect(requestCount).toBe(1);
  expect(JSON.stringify(await readConversationStore(page))).toBe(before);
});

test("isolates a late regeneration from a conversation selected later", async ({ page }) => {
  const first = seedConversation("revision-one", "重新生成会话", 1, "2026-07-13T06:00:00.000Z");
  const second = seedConversation("revision-two", "隔离会话", 1, "2026-07-13T05:00:00.000Z");
  await seedConversationStore(page, [first, second], first.id);
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/agent/stream", async (route) => {
    await gate;
    await fulfillMockStream(route, mockAgentResponse("重新生成会话 用户问题 1：请继续说明相关流程和限制条件。", "late-revision-run", { finalAnswer: "不得串入其他会话的新回答。" })).catch(() => undefined);
  });
  await page.goto("/chat");
  await selectMockMode(page);
  await page.getByTestId("assistant-regenerate").click();
  await expect(page.getByTestId("revision-streaming")).toBeVisible();
  await page.getByTestId("conversation-list-item").filter({ hasText: "隔离会话" }).getByTestId("conversation-select").click();
  release?.();
  await expect(page.getByTestId("chat-header")).toContainText("隔离会话");
  await expect(page.getByTestId("conversation-messages")).not.toContainText("不得串入其他会话的新回答");
  await page.waitForTimeout(300);
  const store = await readConversationStore(page);
  expect(store.conversations.find((conversation) => conversation.id === first.id)?.messages).toHaveLength(2);
  expect(store.conversations.find((conversation) => conversation.id === second.id)?.messages).toHaveLength(2);
  expect(JSON.stringify(store)).not.toContain("late-revision-run");
});
