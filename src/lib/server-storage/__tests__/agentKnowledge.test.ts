import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedKnowledgeDocument, KnowledgeChunk } from "@/types";

const mocks = vi.hoisted(() => ({
  getSafeStorageStatus: vi.fn(),
  resolveRequestWorkspace: vi.fn(),
  listEnabledWithChunks: vi.fn(),
}));

vi.mock("@/lib/server-storage/status", () => ({ getSafeStorageStatus: mocks.getSafeStorageStatus }));
vi.mock("@/lib/server-storage/workspace", () => ({ resolveRequestWorkspace: mocks.resolveRequestWorkspace }));
vi.mock("@/lib/server-storage/prisma", () => ({ getPrismaClient: () => ({}) }));
vi.mock("@/lib/server-storage/knowledgeRepository", () => ({
  PrismaKnowledgeRepository: class {
    listEnabledWithChunks = mocks.listEnabledWithChunks;
  },
}));

import { resolveAgentKnowledge } from "@/lib/server-storage/agentKnowledge";

const document: ImportedKnowledgeDocument = {
  id: "doc-1",
  title: "退款规则",
  category: "售后",
  content: "订单签收后七天内可申请退款。",
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
  importedAt: "2026-07-16T00:00:00.000Z",
  sourceType: "user_paste",
  isDefault: false,
  enabled: true,
};

const chunk: KnowledgeChunk = {
  id: "doc-1-chunk-1",
  documentId: "doc-1",
  sourceTitle: "退款规则",
  category: "售后",
  sourceType: "user_paste",
  chunkIndex: 1,
  content: document.content,
  keywords: ["退款"],
};

describe("Agent workspace knowledge resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestWorkspace.mockResolvedValue({ workspaceId: "workspace-1", setCookie: "workspace-cookie" });
    mocks.listEnabledWithChunks.mockResolvedValue({ documents: [document], chunks: [chunk] });
  });

  it("uses validated browser documents only in local mode", async () => {
    mocks.getSafeStorageStatus.mockResolvedValue({ configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" });
    await expect(resolveAgentKnowledge(new Request("http://test.local/api/agent"), [document])).resolves.toEqual({ documents: [document], source: "local" });
    expect(mocks.resolveRequestWorkspace).not.toHaveBeenCalled();
  });

  it("loads enabled documents and their persisted chunks from the cookie workspace", async () => {
    mocks.getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    const result = await resolveAgentKnowledge(new Request("http://test.local/api/agent"), []);
    expect(result).toEqual({ documents: [document], chunks: [chunk], setCookie: "workspace-cookie", source: "server" });
    expect(mocks.listEnabledWithChunks).toHaveBeenCalledTimes(1);
  });

  it("fails explicitly instead of silently dropping workspace knowledge", async () => {
    mocks.getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: false, storageMode: "degraded", databaseType: "postgresql" });
    await expect(resolveAgentKnowledge(new Request("http://test.local/api/agent"), [])).rejects.toMatchObject({ code: "storage_unavailable", status: 503, retryable: true });

    mocks.getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    mocks.listEnabledWithChunks.mockRejectedValueOnce(new Error("database body must stay private"));
    await expect(resolveAgentKnowledge(new Request("http://test.local/api/agent"), [])).rejects.toMatchObject({ code: "storage_unavailable", status: 503, retryable: true });
  });
});
