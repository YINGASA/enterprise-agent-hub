import { describe, expect, it, vi } from "vitest";
import {
  ServerKnowledgePackRepository,
  normalizeKnowledgePackName,
  sanitizeCreateKnowledgePackInput,
  sanitizeDeleteKnowledgePackInput,
  sanitizeUpdateKnowledgePackInput,
} from "@/lib/storage/knowledgePackRepository";

const pack = {
  id: "pack-1",
  name: "售后制度",
  status: "active" as const,
  documentCount: 2,
  revision: 0,
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
};

describe("knowledge pack repository contract", () => {
  it("normalizes names and strictly sanitizes create/update/delete inputs", () => {
    expect(normalizeKnowledgePackName("  ＡＢＣ  制度 ")).toBe("abc 制度");
    expect(sanitizeCreateKnowledgePackInput({ name: " 售后制度 ", description: " 流程说明 " })).toEqual({ name: "售后制度", description: "流程说明" });
    expect(sanitizeCreateKnowledgePackInput({ name: "制度", workspaceId: "other" })).toBeNull();
    expect(sanitizeCreateKnowledgePackInput({ name: "制度", description: "ﬀ".repeat(501) })).toBeNull();
    expect(sanitizeUpdateKnowledgePackInput({ expectedRevision: 0, status: "archived" })).toEqual({ expectedRevision: 0, status: "archived" });
    expect(sanitizeUpdateKnowledgePackInput({ expectedRevision: -1, name: "制度" })).toBeNull();
    expect(sanitizeDeleteKnowledgePackInput({ expectedRevision: 0, deleteDocuments: true })).toBeNull();
    expect(sanitizeDeleteKnowledgePackInput({ expectedRevision: 0, deleteDocuments: true, confirmation: "DELETE_DOCUMENTS" })).toEqual({ expectedRevision: 0, deleteDocuments: true, confirmation: "DELETE_DOCUMENTS" });
  });

  it("uses the workspace-cookie REST API contract", async () => {
    const request = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if (init?.method === "POST") return Response.json({ pack }, { status: 201 });
      if (init?.method === "PATCH") return Response.json({ pack: { ...pack, revision: 1 } });
      if (init?.method === "DELETE") return Response.json({ result: { detachedDocumentCount: 2, deletedDocumentCount: 0 } });
      if (path.endsWith("/pack-1")) return Response.json({ pack });
      return Response.json({ packs: [pack] });
    });
    const repository = new ServerKnowledgePackRepository(request as typeof fetch);
    await expect(repository.list()).resolves.toEqual([pack]);
    await expect(repository.get("pack-1")).resolves.toEqual(pack);
    await expect(repository.create({ name: "售后制度" })).resolves.toEqual(pack);
    await expect(repository.update("pack-1", { expectedRevision: 0, status: "archived" })).resolves.toMatchObject({ revision: 1 });
    await expect(repository.remove("pack-1", { expectedRevision: 0 })).resolves.toEqual({ detachedDocumentCount: 2, deletedDocumentCount: 0 });
    expect(request).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "same-origin" }));
  });
});
