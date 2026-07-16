import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalKnowledgeRepository, ServerKnowledgeRepository } from "@/lib/storage/knowledgeRepository";
import type { ImportedKnowledgeDocument } from "@/types";

const now = "2026-07-16T00:00:00.000Z";

function document(id = "doc-1"): ImportedKnowledgeDocument {
  return {
    id,
    title: "退款规则",
    category: "售后",
    tags: ["退款"],
    summary: "退款政策摘要",
    content: "订单签收后 7 天内可以申请退款。",
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    sourceType: "user_paste",
    isDefault: false,
    enabled: true,
  };
}

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  vi.unstubAllGlobals();
});

describe("knowledge repositories", () => {
  it("keeps local list/get/create/update/delete and chunk semantics consistent", async () => {
    installStorage();
    const repository = new LocalKnowledgeRepository();
    await expect(repository.list()).resolves.toEqual([]);
    await expect(repository.create(document())).resolves.toMatchObject({ id: "doc-1" });
    await expect(repository.get("doc-1")).resolves.toMatchObject({ title: "退款规则" });
    await expect(repository.update("doc-1", { enabled: false })).resolves.toMatchObject({ enabled: false });
    await expect(repository.listChunks("doc-1")).resolves.toEqual([expect.objectContaining({ documentId: "doc-1", chunkIndex: 1 })]);
    await repository.remove("doc-1");
    await expect(repository.list()).resolves.toEqual([]);
    await expect(repository.replaceAll([{ ...document("doc-2"), summary: "", packId: undefined, originalFileName: undefined }])).resolves.toEqual([
      expect.objectContaining({ id: "doc-2", summary: "", owner: "用户导入", packId: undefined, originalFileName: undefined }),
    ]);
  });

  it("rejects local ID conflicts instead of overwriting", async () => {
    installStorage();
    const repository = new LocalKnowledgeRepository();
    await repository.create(document());
    await expect(repository.create(document())).rejects.toMatchObject({ status: 409, code: "knowledge_document_conflict" });
  });

  it("uses the server REST contract without sending a workspace id", async () => {
    const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/chunks")) return Response.json({ chunks: [] });
      if (String(url).endsWith("/restore")) return Response.json({ documents: [document("doc-2")] });
      if (init?.method === "POST") return Response.json({ document: document() });
      return Response.json({ documents: [document()] });
    });
    const repository = new ServerKnowledgeRepository(request as typeof fetch);
    await repository.list();
    await repository.create(document());
    await repository.listChunks("doc-1");
    await expect(repository.replaceAll([document("doc-2")])).resolves.toEqual([expect.objectContaining({ id: "doc-2" })]);
    expect(request).toHaveBeenCalledTimes(4);
    expect(request).toHaveBeenLastCalledWith("/api/storage/knowledge/restore", expect.objectContaining({ method: "POST" }));
    expect(JSON.stringify(request.mock.calls)).not.toContain("workspaceId");
  });

  it("uses the native fetch function without an illegal receiver", async () => {
    const request = vi.fn(async () => Response.json({ documents: [] }));
    vi.stubGlobal("fetch", request);
    const repository = new ServerKnowledgeRepository();

    await expect(repository.list()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith("/api/storage/knowledge", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("maps safe server errors without exposing response internals", async () => {
    const repository = new ServerKnowledgeRepository(vi.fn(async () => Response.json({ error: "storage_degraded", message: "服务端暂不可用" }, { status: 503 })) as typeof fetch);
    await expect(repository.list()).rejects.toMatchObject({ status: 503, code: "storage_degraded", message: "服务端暂不可用" });
  });
});
