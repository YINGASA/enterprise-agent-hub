import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestWorkspace: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/server-storage/workspace", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/workspace")>(),
  resolveRequestWorkspace: mocks.resolveRequestWorkspace,
}));

vi.mock("@/lib/server-storage/knowledgePackRepository", () => ({
  PrismaKnowledgePackRepository: class {
    list = mocks.list;
    get = mocks.get;
    create = mocks.create;
    update = mocks.update;
    remove = mocks.remove;
  },
}));

import { GET as listPacks, POST as createPack } from "@/app/api/storage/knowledge/packs/route";
import { DELETE as deletePack, GET as getPack, PATCH as updatePack } from "@/app/api/storage/knowledge/packs/[id]/route";

const pack = { id: "pack-1", name: "售后制度", status: "active", documentCount: 2, revision: 0, createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" };
const context = { params: Promise.resolve({ id: "pack-1" }) };

function request(path: string, method = "GET", body?: unknown, origin = true) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (origin) headers.set("origin", "http://test.local");
  return new Request(`http://test.local${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveRequestWorkspace.mockResolvedValue({ workspaceId: "ws-1", setCookie: "workspace=signed; HttpOnly" });
  mocks.list.mockResolvedValue([pack]);
  mocks.get.mockResolvedValue(pack);
  mocks.create.mockResolvedValue(pack);
  mocks.update.mockResolvedValue({ ...pack, revision: 1 });
  mocks.remove.mockResolvedValue({ detachedDocumentCount: 2, deletedDocumentCount: 0 });
});

describe("knowledge pack routes", () => {
  it("lists and reads only the resolved workspace without creating one for first-time GET", async () => {
    const listed = await listPacks(request("/api/storage/knowledge/packs"));
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({ packs: [{ id: "pack-1", documentCount: 2 }] });
    expect(mocks.resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });
    expect((await getPack(request("/api/storage/knowledge/packs/pack-1"), context)).status).toBe(200);

    mocks.resolveRequestWorkspace.mockResolvedValueOnce(null);
    const empty = await listPacks(request("/api/storage/knowledge/packs"));
    await expect(empty.json()).resolves.toEqual({ ok: true, packs: [] });
  });

  it("requires same-origin writes and rejects workspace authority and unknown fields", async () => {
    expect((await createPack(request("/api/storage/knowledge/packs", "POST", { name: "制度" }, false))).status).toBe(403);
    expect((await createPack(request("/api/storage/knowledge/packs", "POST", { name: "制度", workspaceId: "other" }))).status).toBe(400);
    expect((await updatePack(request("/api/storage/knowledge/packs/pack-1", "PATCH", { expectedRevision: 0, name: "新制度", revision: 99 }), context)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates, updates and deletes through the CAS repository contract", async () => {
    expect((await createPack(request("/api/storage/knowledge/packs", "POST", { name: "制度", description: "说明" }))).status).toBe(201);
    expect((await updatePack(request("/api/storage/knowledge/packs/pack-1", "PATCH", { expectedRevision: 0, status: "archived" }), context)).status).toBe(200);
    expect((await deletePack(request("/api/storage/knowledge/packs/pack-1", "DELETE", { expectedRevision: 0 }), context)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("pack-1", { expectedRevision: 0, status: "archived" });
    expect(mocks.remove).toHaveBeenCalledWith("pack-1", { expectedRevision: 0 });
  });

  it("requires a second confirmation before deleting package documents", async () => {
    const rejected = await deletePack(request("/api/storage/knowledge/packs/pack-1", "DELETE", { expectedRevision: 0, deleteDocuments: true }), context);
    expect(rejected.status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
    const accepted = await deletePack(request("/api/storage/knowledge/packs/pack-1", "DELETE", { expectedRevision: 0, deleteDocuments: true, confirmation: "DELETE_DOCUMENTS" }), context);
    expect(accepted.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith("pack-1", { expectedRevision: 0, deleteDocuments: true, confirmation: "DELETE_DOCUMENTS" });
  });
});
