import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadConversationStore: vi.fn(),
  readUserKnowledgeDocumentsWithStatus: vi.fn(),
}));

vi.mock("@/lib/conversation/storage", () => ({
  CONVERSATION_STORAGE_KEY: "enterprise-agent-hub:conversations",
  loadConversationStore: mocks.loadConversationStore,
}));

vi.mock("@/lib/knowledge/storage", () => ({
  readUserKnowledgeDocumentsWithStatus: mocks.readUserKnowledgeDocumentsWithStatus,
}));

import {
  STORAGE_MIGRATION_MARKER_KEY,
  StorageMigrationClientError,
  collectLocalStorageMigration,
  createStorageMigrationId,
  executeLocalStorageMigration,
  hasLocalStorageMigrationData,
  isStorageMigrationComplete,
  previewLocalStorageMigration,
  readStorageMigrationMarker,
  sanitizeStorageMigrationResult,
} from "@/lib/storage/migrationClient";
import type { Conversation, ImportedKnowledgeDocument } from "@/types";

const conversation: Conversation = {
  id: "conversation-1",
  title: "报销问题",
  titleSource: "auto",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:01:00.000Z",
  revision: 1,
  schemaVersion: 1,
  messages: [
    { id: "user-1", role: "user", content: "报销需要什么？", createdAt: "2026-07-01T00:00:00.000Z" },
    { id: "assistant-1", role: "assistant", content: "请准备发票。", createdAt: "2026-07-01T00:01:00.000Z", runId: "run-1" },
  ],
};

const document: ImportedKnowledgeDocument = {
  id: "document-1",
  title: "报销制度",
  category: "财务",
  content: "报销需要提供合规发票。",
  sourceType: "user_paste",
  isDefault: false,
  importedAt: "2026-07-01T00:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
      },
    },
  });
  return data;
}

function response(result: object, ok = true, status = 200) {
  return { ok, status, json: async () => result } as Response;
}

beforeEach(() => {
  mocks.loadConversationStore.mockReset();
  mocks.readUserKnowledgeDocumentsWithStatus.mockReset();
  mocks.loadConversationStore.mockReturnValue({ data: { activeConversationId: conversation.id, conversations: [conversation], legacyHistoryMigrated: true } });
  mocks.readUserKnowledgeDocumentsWithStatus.mockReturnValue({ ok: true, data: [document] });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("local storage migration client", () => {
  it("collects only the minimal migration DTO with a stable idempotency key", () => {
    installStorage({ "enterprise-agent-hub:conversations": "unchanged" });
    const first = collectLocalStorageMigration();
    const second = collectLocalStorageMigration();

    expect(first).toEqual(second);
    expect(first).toMatchObject({ conversations: [{ id: "conversation-1" }], knowledgeDocuments: [{ id: "document-1" }] });
    expect(first.migrationId).toBe(createStorageMigrationId([conversation], [document]));
    expect(JSON.stringify(first)).not.toContain("workspaceId");
    expect(hasLocalStorageMigrationData(first)).toBe(true);
  });

  it("does not migrate a generated empty starter conversation even when initialization already created the local key", () => {
    installStorage({ "enterprise-agent-hub:conversations": "generated-placeholder" });
    mocks.loadConversationStore.mockReturnValue({ data: { activeConversationId: "empty", conversations: [{ ...conversation, id: "empty", messages: [], conversationSummary: undefined }], legacyHistoryMigrated: true } });
    mocks.readUserKnowledgeDocumentsWithStatus.mockReturnValue({ ok: true, data: [] });
    const payload = collectLocalStorageMigration();
    expect(payload.conversations).toEqual([]);
    expect(hasLocalStorageMigrationData(payload)).toBe(false);
  });

  it("treats denied localStorage getters and reads as unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: Object.defineProperty({}, "localStorage", { get: () => { throw new DOMException("denied", "SecurityError"); } }),
    });
    expect(collectLocalStorageMigration()).toMatchObject({ conversations: [], knowledgeDocuments: [] });
    expect(readStorageMigrationMarker()).toBeNull();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => { throw new DOMException("denied", "SecurityError"); } } },
    });
    expect(collectLocalStorageMigration()).toMatchObject({ conversations: [], knowledgeDocuments: [] });
  });

  it("previews, requires confirmation, executes idempotently and only adds a marker", async () => {
    const storage = installStorage({
      "enterprise-agent-hub:conversations": "conversation-backup",
      "enterprise-agent-hub:user-knowledge-documents": "knowledge-backup",
    });
    const payload = collectLocalStorageMigration();
    const result = { migrationId: payload.migrationId, status: "completed", imported: 2, skipped: 0, conflicted: 0, failed: 0 };
    const request = vi.fn().mockResolvedValue(response({ ok: true, result }));

    await expect(previewLocalStorageMigration(payload, request)).resolves.toEqual(result);
    await expect(executeLocalStorageMigration(payload, false as true, request)).rejects.toMatchObject({ code: "migration_confirmation_required" });
    await expect(executeLocalStorageMigration(payload, true, request)).resolves.toEqual(result);

    expect(request).toHaveBeenNthCalledWith(1, "/api/storage/migration/preview", expect.objectContaining({ credentials: "same-origin" }));
    expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).not.toHaveProperty("confirmed");
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toMatchObject({ confirmed: true, migrationId: payload.migrationId });
    expect(storage.get("enterprise-agent-hub:conversations")).toBe("conversation-backup");
    expect(storage.get("enterprise-agent-hub:user-knowledge-documents")).toBe("knowledge-backup");
    expect(readStorageMigrationMarker()).toMatchObject({ version: 1, migrationId: payload.migrationId, imported: 2 });
  });

  it("does not write a completion marker when the server rejects migration", async () => {
    const storage = installStorage({ "enterprise-agent-hub:conversations": "backup" });
    const payload = collectLocalStorageMigration();
    const request = vi.fn().mockResolvedValue(response({ error: "storage_unavailable", message: "服务端暂不可用。" }, false, 503));
    await expect(executeLocalStorageMigration(payload, true, request)).rejects.toEqual(expect.objectContaining<Partial<StorageMigrationClientError>>({ status: 503, code: "storage_unavailable" }));
    expect(storage.has(STORAGE_MIGRATION_MARKER_KEY)).toBe(false);
  });

  it("keeps failed and conflicted migrations retryable without a completion marker", async () => {
    const storage = installStorage({ "enterprise-agent-hub:conversations": "backup" });
    const payload = collectLocalStorageMigration();
    const failed = { migrationId: payload.migrationId, status: "failed", imported: 0, skipped: 0, conflicted: 0, failed: 1 } as const;
    const conflict = { migrationId: payload.migrationId, status: "conflict", imported: 0, skipped: 0, conflicted: 1, failed: 0 } as const;

    await expect(executeLocalStorageMigration(payload, true, vi.fn().mockResolvedValue(response({ ok: true, result: failed })))).resolves.toEqual(failed);
    expect(storage.has(STORAGE_MIGRATION_MARKER_KEY)).toBe(false);
    await expect(executeLocalStorageMigration(payload, true, vi.fn().mockResolvedValue(response({ ok: true, result: conflict })))).resolves.toEqual(conflict);
    expect(storage.has(STORAGE_MIGRATION_MARKER_KEY)).toBe(false);
    expect(isStorageMigrationComplete(failed)).toBe(false);
    expect(isStorageMigrationComplete(conflict)).toBe(false);
  });

  it("rejects unsafe or malformed result counters and markers", async () => {
    installStorage({ [STORAGE_MIGRATION_MARKER_KEY]: JSON.stringify({ version: 1, migrationId: "m", completedAt: "bad", imported: 1, skipped: 0, conflicted: 0, failed: 0 }) });
    expect(readStorageMigrationMarker()).toBeNull();
    expect(sanitizeStorageMigrationResult({ migrationId: "m", status: "completed", imported: -1, skipped: 0, conflicted: 0, failed: 0 })).toBeNull();
    expect(sanitizeStorageMigrationResult({ migrationId: "m", status: "completed", imported: 1, skipped: 0, conflicted: 0, failed: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
