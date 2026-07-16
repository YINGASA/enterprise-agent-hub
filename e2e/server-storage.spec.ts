import { expect, test, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

const conversationStorageKey = "enterprise-agent-hub:conversations";
const knowledgeStorageKey = "enterprise-agent-hub:user-knowledge-documents";
const migrationMarkerKey = "enterprise-agent-hub:server-storage-migration:v1";
const fixedNow = "2026-07-16T08:00:00.000Z";

type SummaryState = {
  text: string;
  throughMessageId: string;
  updatedAt: string;
  version: 1;
  sourceMessageCount: number;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  runId?: string;
  responseMode?: string;
  scenario?: string;
  intent?: string;
};

type StoredConversation = {
  id: string;
  title: string;
  titleSource: "auto" | "manual";
  createdAt: string;
  updatedAt: string;
  revision: number;
  messages: StoredMessage[];
  schemaVersion: 1;
  conversationSummary?: SummaryState;
};

type StoredKnowledgeDocument = {
  id: string;
  packId?: string;
  title: string;
  category: string;
  tags?: string[];
  summary?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceType: "user_upload" | "user_paste";
  isDefault: false;
  importedAt: string;
  enabled?: boolean;
  suggestedQuestions?: string[];
};

type StorageMode = "server" | "degraded";

type ServerApiState = {
  mode: StorageMode;
  conversations: StoredConversation[];
  knowledgeDocuments: StoredKnowledgeDocument[];
  agentBodies: Array<Record<string, unknown>>;
  conversationRequests: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  migrationRequests: Array<{ path: string; body: Record<string, unknown> }>;
  completedMigrationIds: Set<string>;
  nextConversation: number;
  nextRun: number;
};

function createServerState(overrides: Partial<ServerApiState> = {}): ServerApiState {
  return {
    mode: "server",
    conversations: [],
    knowledgeDocuments: [],
    agentBodies: [],
    conversationRequests: [],
    migrationRequests: [],
    completedMigrationIds: new Set(),
    nextConversation: 1,
    nextRun: 1,
    ...overrides,
  };
}

function seedConversation(id: string, question = "原始问题", answer = "原始回答"): StoredConversation {
  return {
    id,
    title: question,
    titleSource: "auto",
    createdAt: fixedNow,
    updatedAt: fixedNow,
    revision: 1,
    schemaVersion: 1,
    messages: [
      { id: `${id}-user-1`, role: "user", content: question, createdAt: fixedNow },
      { id: `${id}-assistant-1`, role: "assistant", content: answer, createdAt: fixedNow, runId: `${id}-run-1`, responseMode: "mock", scenario: "general", intent: "general_chat" },
    ],
  };
}

function applySummaryPatch(conversation: StoredConversation, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const patch = value as { clear?: unknown; set?: unknown };
  if (patch.clear === true && patch.set === undefined) delete conversation.conversationSummary;
  if (patch.set && typeof patch.set === "object" && !Array.isArray(patch.set) && patch.clear === undefined) {
    conversation.conversationSummary = structuredClone(patch.set) as SummaryState;
  }
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

function completedAgentResult(question: string, runId: string, answer: string, summaryPatch?: unknown) {
  return {
    question,
    route: { scenario: "general", intent: "general_chat", needRag: false, toolsNeeded: [], confidence: 0.9, reason: "server-storage-e2e" },
    steps: [],
    ragAnswer: null,
    toolResults: [],
    finalAnswer: answer,
    structuredOutput: { scenario: "general", intent: "general_chat", answer, evidence: [], toolsUsed: [], sources: [], confidence: 0.9, riskLevel: "low", nextAction: "结束" },
    createdAt: fixedNow,
    mode: "mock-agent",
    api: { requestedMode: "mock", responseMode: "mock" },
    runId,
    ...(summaryPatch ? { conversationSummaryPatch: summaryPatch } : {}),
  };
}

function mockStreamBody(result: ReturnType<typeof completedAgentResult>) {
  const { conversationSummaryPatch, ...safeResult } = result;
  const answer = safeResult.finalAnswer;
  const completed = {
    ...safeResult,
    api: { ...safeResult.api, streamingRequested: true, streamingUsed: true, streamFallback: false, aborted: false, streamDeltaCount: 1 },
  };
  return [
    { type: "run_started", runId: result.runId, requestedMode: "mock", responseMode: "mock", contextApplied: false, contextMessageCount: 0, contextTruncated: false },
    { type: "phase", phase: "understand" },
    { type: "phase", phase: "generate" },
    { type: "answer_delta", delta: answer, index: 0 },
    { type: "answer_completed", result: completed, ...(conversationSummaryPatch ? { conversationSummaryPatch } : {}), streamingRequested: true, streamingUsed: true, streamFallback: false, deltaCount: 1 },
  ].map((event) => JSON.stringify(event)).join("\n") + "\n";
}

async function installServerApi(page: Page, state: ServerApiState, summaryPatch?: SummaryState) {
  await page.route("**/api/llm/status", (route) => json(route, { configured: false }));

  await page.route("**/api/agent/stream", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
    state.agentBodies.push(body);
    const action = String(body.requestAction ?? "send");
    const answer = action === "regenerate" ? "重新生成后的服务端回答" : action === "edit_resend" ? "编辑重发后的服务端回答" : `服务端回答：${String(body.question ?? "")}`;
    const runId = `server-run-${state.nextRun++}`;
    const contextCandidates = Array.isArray(body.contextCandidates) ? body.contextCandidates : [];
    const summaryCursorIsEligible = summaryPatch
      ? contextCandidates.some((candidate) => candidate
        && typeof candidate === "object"
        && !Array.isArray(candidate)
        && (candidate as { id?: unknown }).id === summaryPatch.throughMessageId)
      : false;
    const patch = summaryPatch && action === "send" && summaryCursorIsEligible ? { set: summaryPatch } : undefined;
    await route.fulfill({ status: 200, contentType: "application/x-ndjson; charset=utf-8", body: mockStreamBody(completedAgentResult(String(body.question ?? ""), runId, answer, patch)) });
  });

  await page.route("**/api/storage/status", (route) => json(route, {
    configured: true,
    healthy: state.mode === "server",
    storageMode: state.mode,
    databaseType: "postgresql",
  }));

  await page.route("**/api/storage/conversations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()!) as Record<string, unknown> : {};
    state.conversationRequests.push({ method, path, body });

    if (state.mode !== "server") return json(route, { error: "storage_unavailable", message: "服务端存储暂不可用。" }, 503);
    if (path === "/api/storage/conversations" && method === "GET") return json(route, { conversations: structuredClone(state.conversations) });
    if (path === "/api/storage/conversations" && method === "POST") {
      const created: StoredConversation = {
        id: `server-conversation-${state.nextConversation++}`,
        title: "新对话",
        titleSource: "auto",
        createdAt: fixedNow,
        updatedAt: fixedNow,
        revision: 0,
        messages: [],
        schemaVersion: 1,
      };
      state.conversations.unshift(created);
      return json(route, { conversation: structuredClone(created) }, 201);
    }

    const suffix = path.slice("/api/storage/conversations/".length);
    const [encodedId, action] = suffix.split("/");
    const id = decodeURIComponent(encodedId ?? "");
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation) return json(route, { error: "not_found", message: "会话不存在。" }, 404);
    const expectedRevision = body.expectedRevision;
    if (method !== "GET" && expectedRevision !== conversation.revision) return json(route, { error: "conflict", message: "会话已发生变化，请刷新后重试。" }, 409);

    if (!action && method === "GET") return json(route, { conversation: structuredClone(conversation) });
    if (!action && method === "DELETE") {
      state.conversations = state.conversations.filter((item) => item.id !== id);
      return json(route, { ok: true });
    }
    if (!action && method === "PATCH") {
      conversation.title = String(body.title ?? conversation.title);
      conversation.titleSource = "manual";
    } else if (action === "clear" && method === "POST") {
      conversation.messages = [];
      conversation.title = "新对话";
      conversation.titleSource = "auto";
      delete conversation.conversationSummary;
    } else if (action === "turns" && method === "POST") {
      const userMessage = structuredClone(body.userMessage) as StoredMessage;
      const assistantMessage = structuredClone(body.assistantMessage) as StoredMessage;
      conversation.messages.push(userMessage, assistantMessage);
      if (conversation.title === "新对话") conversation.title = userMessage.content.slice(0, 36);
      applySummaryPatch(conversation, body.conversationSummaryPatch);
    } else if (action === "regenerate" && method === "POST") {
      const last = conversation.messages.at(-1);
      if (last?.role !== "assistant" || last.id !== body.expectedAssistantMessageId) return json(route, { error: "conflict", message: "最后一条回答已变化。" }, 409);
      conversation.messages[conversation.messages.length - 1] = structuredClone(body.assistantMessage) as StoredMessage;
      applySummaryPatch(conversation, body.conversationSummaryPatch);
    } else if (action === "edit-resend" && method === "POST") {
      const user = conversation.messages.at(-2);
      const assistant = conversation.messages.at(-1);
      if (user?.id !== body.expectedUserMessageId || assistant?.id !== body.expectedAssistantMessageId) return json(route, { error: "conflict", message: "最后一轮已变化。" }, 409);
      conversation.messages.splice(-2, 2, structuredClone(body.userMessage) as StoredMessage, structuredClone(body.assistantMessage) as StoredMessage);
      applySummaryPatch(conversation, body.conversationSummaryPatch);
    } else {
      return json(route, { error: "not_found", message: "接口不存在。" }, 404);
    }

    conversation.revision += 1;
    conversation.updatedAt = fixedNow;
    return json(route, { conversation: structuredClone(conversation) });
  });

  await page.route("**/api/storage/knowledge**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (state.mode !== "server") return json(route, { error: "storage_unavailable", message: "服务端知识存储暂不可用。" }, 503);
    if (path === "/api/storage/knowledge" && method === "GET") return json(route, { documents: structuredClone(state.knowledgeDocuments) });
    if (path === "/api/storage/knowledge" && method === "POST") {
      const body = JSON.parse(request.postData() ?? "{}") as { document?: StoredKnowledgeDocument };
      if (!body.document) return json(route, { error: "invalid_document", message: "文档无效。" }, 400);
      state.knowledgeDocuments.unshift(structuredClone(body.document));
      return json(route, { document: structuredClone(body.document) }, 201);
    }
    const suffix = path.slice("/api/storage/knowledge/".length);
    const [encodedId, action] = suffix.split("/");
    const id = decodeURIComponent(encodedId ?? "");
    const document = state.knowledgeDocuments.find((item) => item.id === id);
    if (!document) return json(route, { error: "not_found", message: "知识文档不存在。" }, 404);
    if (action === "chunks" && method === "GET") return json(route, { chunks: [{ id: `${id}-chunk-0`, documentId: id, sourceTitle: document.title, category: document.category, tags: document.tags ?? [], sourceType: document.sourceType, chunkIndex: 0, content: document.content, keywords: ["服务端", "知识"] }] });
    if (!action && method === "GET") return json(route, { document: structuredClone(document) });
    if (!action && method === "DELETE") {
      state.knowledgeDocuments = state.knowledgeDocuments.filter((item) => item.id !== id);
      return json(route, { ok: true });
    }
    if (!action && method === "PATCH") {
      const body = JSON.parse(request.postData() ?? "{}") as { update?: Partial<StoredKnowledgeDocument> };
      Object.assign(document, body.update ?? {}, { updatedAt: fixedNow });
      return json(route, { document: structuredClone(document) });
    }
    return json(route, { error: "not_found", message: "接口不存在。" }, 404);
  });

  await page.route("**/api/storage/migration**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    state.migrationRequests.push({ path, body });
    const migrationId = String(body.migrationId ?? "");
    const conversations = Array.isArray(body.conversations) ? body.conversations as StoredConversation[] : [];
    const documents = Array.isArray(body.knowledgeDocuments) ? body.knowledgeDocuments as StoredKnowledgeDocument[] : [];
    const idempotent = state.completedMigrationIds.has(migrationId);
    const newConversations = conversations.filter((incoming) => !state.conversations.some((existing) => existing.id === incoming.id));
    const newDocuments = documents.filter((incoming) => !state.knowledgeDocuments.some((existing) => existing.id === incoming.id));
    const counts = { imported: newConversations.length + newDocuments.length, skipped: idempotent ? conversations.length + documents.length : 0, conflicted: 0, failed: 0 };
    if (path.endsWith("/preview")) return json(route, { result: { migrationId, status: "completed", ...counts } });
    if (body.confirmed !== true) return json(route, { error: "migration_confirmation_required", message: "需要确认迁移。" }, 400);
    if (!idempotent) {
      state.conversations.push(...structuredClone(newConversations));
      state.knowledgeDocuments.push(...structuredClone(newDocuments));
      state.completedMigrationIds.add(migrationId);
    }
    return json(route, { result: { migrationId, status: "completed", idempotent, ...counts } });
  });
}

async function selectMockMode(page: Page) {
  await page.getByTestId("agent-mode-options").locator("summary").click();
  await page.getByTestId("agent-mode-mock").click();
}

async function sendQuestion(page: Page, question: string) {
  await page.getByTestId("agent-question").fill(question);
  await page.getByTestId("agent-run").click();
  await expect(page.getByTestId("conversation-message-assistant").last()).toBeVisible();
}

async function seedLocalMigrationData(page: Page) {
  const localConversation = seedConversation("local-conversation", "本地待迁移问题", "本地待迁移回答");
  const localDocument: StoredKnowledgeDocument = {
    id: "local-knowledge",
    title: "本地迁移知识文档",
    category: "制度流程",
    tags: ["迁移"],
    summary: "本地数据迁移验证",
    content: "本地知识正文必须在迁移完成后继续保留在浏览器备份中。",
    createdAt: fixedNow,
    updatedAt: fixedNow,
    sourceType: "user_paste",
    isDefault: false,
    importedAt: fixedNow,
    enabled: true,
  };
  await page.addInitScript(({ conversationKey, knowledgeKey, conversation, document, at }) => {
    localStorage.setItem(conversationKey, JSON.stringify({ version: 1, data: [{ activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true }], updatedAt: at }));
    localStorage.setItem(knowledgeKey, JSON.stringify({ version: 2, documents: [document], updatedAt: at }));
  }, { conversationKey: conversationStorageKey, knowledgeKey: knowledgeStorageKey, conversation: localConversation, document: localDocument, at: fixedNow });
}

test("server 模式创建会话、保存 Summary Patch，并在刷新后恢复", async ({ page }) => {
  const summary: SummaryState = { text: "已确认事项：服务端滚动摘要已持久化。", throughMessageId: "history-assistant-4", updatedAt: fixedNow, version: 1, sourceMessageCount: 8 };
  const state = createServerState();
  await installServerApi(page, state, summary);
  await page.goto("/chat");
  await expect(page.getByTestId("storage-status")).toContainText("服务端存储");
  await selectMockMode(page);
  await sendQuestion(page, "创建一条服务端会话");

  expect(state.conversations).toHaveLength(1);
  expect(state.conversations[0]?.messages).toHaveLength(2);
  expect(state.conversationRequests.some((entry) => entry.method === "POST" && entry.path === "/api/storage/conversations")).toBe(true);
  expect(state.conversationRequests.some((entry) => entry.path.endsWith("/turns") && entry.body.expectedRevision === 0)).toBe(true);
  expect(state.conversations[0]?.conversationSummary).toBeUndefined();

  const conversation = state.conversations[0]!;
  conversation.messages = Array.from({ length: 8 }, (_, index) => {
    const turn = index + 1;
    return [
      { id: `history-user-${turn}`, role: "user" as const, content: `历史问题 ${turn}`, createdAt: fixedNow },
      { id: `history-assistant-${turn}`, role: "assistant" as const, content: `历史回答 ${turn}`, createdAt: fixedNow, runId: `history-run-${turn}`, responseMode: "mock", scenario: "general", intent: "general_chat" },
    ];
  }).flat();
  conversation.revision = 8;

  await page.reload();
  await sendQuestion(page, "验证服务端滚动摘要");
  await expect(page.getByText("验证服务端滚动摘要", { exact: true })).toBeVisible();
  await expect(page.getByText("服务端回答：验证服务端滚动摘要", { exact: true })).toBeVisible();
  expect(state.conversations[0]?.conversationSummary).toEqual(summary);
  expect(state.conversationRequests.some((entry) => entry.path.endsWith("/turns") && entry.body.expectedRevision === 8)).toBe(true);
});

test("server Regenerate 与 Edit & Resend 使用 revision/CAS 端点且不保留废弃内容", async ({ page }) => {
  const conversation = seedConversation("revision-conversation");
  const state = createServerState({ conversations: [conversation] });
  await installServerApi(page, state);
  await page.goto("/chat");
  await selectMockMode(page);

  await page.getByTestId("assistant-regenerate").click();
  await expect(page.getByTestId("assistant-answer")).toHaveText("重新生成后的服务端回答");
  const regenerate = state.conversationRequests.find((entry) => entry.path.endsWith("/regenerate"));
  expect(regenerate?.body).toMatchObject({ expectedRevision: 1, expectedAssistantMessageId: "revision-conversation-assistant-1" });
  expect(state.conversations[0]?.messages.map((message) => message.content)).not.toContain("原始回答");

  await page.getByTestId("user-edit").click();
  await page.getByTestId("user-edit-input").fill("修改后的问题");
  await page.getByTestId("user-edit-submit").click();
  await expect(page.getByText("修改后的问题", { exact: true })).toBeVisible();
  await expect(page.getByTestId("assistant-answer")).toHaveText("编辑重发后的服务端回答");
  const editResend = state.conversationRequests.find((entry) => entry.path.endsWith("/edit-resend"));
  expect(editResend?.body.expectedRevision).toBe(2);
  expect(editResend?.body.expectedAssistantMessageId).toBe((regenerate?.body.assistantMessage as StoredMessage).id);
  expect(state.conversations[0]?.messages.map((message) => message.content)).toEqual(["修改后的问题", "编辑重发后的服务端回答"]);
  expect(state.agentBodies.at(-1)?.contextCandidates).toEqual([]);
});

test("degraded 模式明确只读，不调用 Agent，也不伪造本地保存", async ({ page }) => {
  const state = createServerState({ mode: "degraded" });
  await installServerApi(page, state);
  await page.goto("/chat");
  await expect(page.getByTestId("storage-status")).toContainText("服务端暂不可用");
  await expect(page.getByTestId("storage-status")).toContainText("写操作不会静默保存到本地");
  const localCacheBefore = await page.evaluate((key) => localStorage.getItem(key), conversationStorageKey);
  await selectMockMode(page);
  await expect(page.getByTestId("agent-question")).toBeDisabled();
  await expect(page.getByTestId("agent-run")).toBeDisabled();

  expect(state.agentBodies).toHaveLength(0);
  expect(state.conversations).toHaveLength(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), conversationStorageKey)).toBe(localCacheBefore);
  await expect(page.getByTestId("conversation-message-user")).toHaveCount(0);
  await expect(page.getByTestId("conversation-message-assistant")).toHaveCount(0);
});

test("迁移按 preview、确认、execute 执行，重复标记阻止再次导入且保留本地备份", async ({ page }) => {
  const state = createServerState();
  await installServerApi(page, state);
  await seedLocalMigrationData(page);
  let confirmationCount = 0;
  page.on("dialog", (dialog) => {
    confirmationCount += 1;
    void dialog.accept();
  });
  await page.goto("/chat");
  await page.getByRole("button", { name: "迁移本地数据" }).click();
  await expect(page.getByTestId("storage-status")).toContainText("迁移结果：已导入 2，已跳过 0，冲突 0，失败 0");

  expect(state.migrationRequests.map((entry) => entry.path)).toEqual(["/api/storage/migration/preview", "/api/storage/migration"]);
  expect(confirmationCount).toBe(2);
  expect(state.migrationRequests[1]?.body.confirmed).toBe(true);
  expect(state.conversations.some((conversation) => conversation.id === "local-conversation")).toBe(true);
  expect(state.knowledgeDocuments.some((document) => document.id === "local-knowledge")).toBe(true);
  const originalBackups = await page.evaluate(({ conversationKey, knowledgeKey }) => ({
    conversation: JSON.parse(localStorage.getItem(conversationKey) ?? "null"),
    knowledge: JSON.parse(localStorage.getItem(knowledgeKey) ?? "null"),
  }), { conversationKey: conversationStorageKey, knowledgeKey: knowledgeStorageKey });
  expect(await page.evaluate((key) => localStorage.getItem(key), migrationMarkerKey)).not.toBeNull();

  await page.reload();
  await expect(page.getByTestId("storage-status")).toContainText("此浏览器已执行过服务端迁移");
  await expect(page.getByRole("button", { name: "迁移本地数据" })).toHaveCount(0);
  expect(state.migrationRequests).toHaveLength(2);
  const retainedBackups = await page.evaluate(({ conversationKey, knowledgeKey }) => ({
    conversation: JSON.parse(localStorage.getItem(conversationKey) ?? "null"),
    knowledge: JSON.parse(localStorage.getItem(knowledgeKey) ?? "null"),
  }), { conversationKey: conversationStorageKey, knowledgeKey: knowledgeStorageKey });
  expect(retainedBackups.conversation?.data?.[0]?.conversations?.[0]?.id).toBe(originalBackups.conversation?.data?.[0]?.conversations?.[0]?.id);
  expect(retainedBackups.conversation?.data?.[0]?.conversations?.[0]?.messages).toEqual(originalBackups.conversation?.data?.[0]?.conversations?.[0]?.messages);
  expect(retainedBackups.knowledge?.documents).toEqual(originalBackups.knowledge?.documents);
});

test("迁移在用户允许上传前不会发送本地正文", async ({ page }) => {
  const state = createServerState();
  await installServerApi(page, state);
  await seedLocalMigrationData(page);
  page.once("dialog", (dialog) => dialog.dismiss());

  await page.goto("/chat");
  await page.getByRole("button", { name: "迁移本地数据" }).click();
  await page.waitForTimeout(100);

  expect(state.migrationRequests).toHaveLength(0);
  expect(state.conversations).toHaveLength(0);
  expect(state.knowledgeDocuments).toHaveLength(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), migrationMarkerKey)).toBeNull();
});

test("server 知识文档刷新后仍存在，聊天 RAG 请求不上传 userDocuments", async ({ page }) => {
  const state = createServerState();
  await installServerApi(page, state);
  await page.goto("/knowledge");
  await expect(page.getByTestId("storage-status")).toContainText("服务端存储");
  await page.getByTestId("knowledge-document-title").fill("服务端持久知识文档");
  await page.getByTestId("knowledge-document-content").fill("这是一篇保存在 PostgreSQL 工作区中的服务端知识文档，用于检索验证。");
  await page.getByTestId("knowledge-document-submit").click();
  await expect(page.getByText("服务端持久知识文档", { exact: true }).first()).toBeVisible();
  expect(state.knowledgeDocuments).toHaveLength(1);

  await page.reload();
  await expect(page.getByText("服务端持久知识文档", { exact: true }).first()).toBeVisible();
  await page.goto("/chat");
  await selectMockMode(page);
  await sendQuestion(page, "请查询服务端知识文档");
  expect(state.agentBodies.at(-1)?.userDocuments).toEqual([]);
  expect(JSON.stringify(state.agentBodies.at(-1))).not.toContain("这是一篇保存在 PostgreSQL");
});

async function createIsolatedWorkspace(browser: Browser, question: string) {
  const context: BrowserContext = await browser.newContext();
  const page = await context.newPage();
  const state = createServerState();
  await installServerApi(page, state);
  await page.goto("/chat");
  await selectMockMode(page);
  await sendQuestion(page, question);
  return { context, page, state };
}

test("两个独立浏览器工作区的数据严格隔离", async ({ browser }) => {
  const first = await createIsolatedWorkspace(browser, "工作区甲的私有问题");
  const second = await createIsolatedWorkspace(browser, "工作区乙的私有问题");
  try {
    expect(JSON.stringify(first.state.conversations)).toContain("工作区甲的私有问题");
    expect(JSON.stringify(first.state.conversations)).not.toContain("工作区乙的私有问题");
    expect(JSON.stringify(second.state.conversations)).toContain("工作区乙的私有问题");
    expect(JSON.stringify(second.state.conversations)).not.toContain("工作区甲的私有问题");

    await first.page.reload();
    await second.page.reload();
    await expect(first.page.getByTestId("conversation-message-user").getByText("工作区甲的私有问题", { exact: true })).toBeVisible();
    await expect(first.page.getByTestId("conversation-message-user").getByText("工作区乙的私有问题", { exact: true })).toHaveCount(0);
    await expect(second.page.getByTestId("conversation-message-user").getByText("工作区乙的私有问题", { exact: true })).toBeVisible();
    await expect(second.page.getByTestId("conversation-message-user").getByText("工作区甲的私有问题", { exact: true })).toHaveCount(0);
  } finally {
    await first.context.close();
    await second.context.close();
  }
});
