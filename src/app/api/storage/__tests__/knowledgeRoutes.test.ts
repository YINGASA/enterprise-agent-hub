import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestWorkspace: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  listChunks: vi.fn(),
  replaceAll: vi.fn(),
  previewStorageMigration: vi.fn(),
  executeStorageMigration: vi.fn(),
  getStorageMigrationResult: vi.fn(),
}));

vi.mock("@/lib/server-storage/workspace", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/workspace")>(),
  resolveRequestWorkspace: mocks.resolveRequestWorkspace,
}));

vi.mock("@/lib/server-storage/knowledgeRepository", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/knowledgeRepository")>(),
  PrismaKnowledgeRepository: class {
    list = mocks.list;
    get = mocks.get;
    create = mocks.create;
    update = mocks.update;
    remove = mocks.remove;
    listChunks = mocks.listChunks;
    replaceAll = mocks.replaceAll;
  },
}));

vi.mock("@/lib/server-storage/migration", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server-storage/migration")>(),
  previewStorageMigration: mocks.previewStorageMigration,
  executeStorageMigration: mocks.executeStorageMigration,
  getStorageMigrationResult: mocks.getStorageMigrationResult,
}));

import { GET as listKnowledge, POST as createKnowledge } from "@/app/api/storage/knowledge/route";
import { DELETE as deleteKnowledge, PATCH as updateKnowledge } from "@/app/api/storage/knowledge/[id]/route";
import { GET as listChunks } from "@/app/api/storage/knowledge/[id]/chunks/route";
import { POST as restoreKnowledge } from "@/app/api/storage/knowledge/restore/route";
import { POST as previewMigration } from "@/app/api/storage/migration/preview/route";
import { GET as getMigration, POST as executeMigration } from "@/app/api/storage/migration/route";

const now = "2026-07-16T00:00:00.000Z";
const document = {
  id: "doc-1", title: "退款规则", category: "售后", tags: ["退款"], summary: "退款摘要", content: "订单签收后 7 天内可以申请退款。",
  createdAt: now, updatedAt: now, importedAt: now, sourceType: "user_paste", isDefault: false, enabled: true,
};

function request(path: string, method = "GET", body?: unknown, origin = true) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  if (origin) headers.set("origin", "http://test.local");
  return new Request(`http://test.local${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveRequestWorkspace.mockResolvedValue({ workspaceId: "ws-1", setCookie: "workspace=signed; HttpOnly" });
  mocks.list.mockResolvedValue([document]);
  mocks.get.mockResolvedValue(document);
  mocks.create.mockResolvedValue(document);
  mocks.update.mockResolvedValue({ ...document, enabled: false });
  mocks.remove.mockResolvedValue(undefined);
  mocks.listChunks.mockResolvedValue([]);
  mocks.replaceAll.mockResolvedValue([document]);
  mocks.previewStorageMigration.mockResolvedValue({ imported: 1, skipped: 0, conflicted: 0, failed: 0 });
  mocks.executeStorageMigration.mockResolvedValue({ migrationId: "migration-1", imported: 1, skipped: 0, conflicted: 0, failed: 0, idempotent: false });
  mocks.getStorageMigrationResult.mockResolvedValue({ migrationId: "migration-1", imported: 1 });
});

describe("knowledge storage routes", () => {
  it("lists workspace-scoped documents and forwards only the opaque cookie", async () => {
    const response = await listKnowledge(request("/api/storage/knowledge"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("workspace=signed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    await expect(response.json()).resolves.toMatchObject({ documents: [{ id: "doc-1" }] });
    expect(mocks.resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });
  });

  it("returns an empty knowledge list without creating a workspace for a first-time GET", async () => {
    mocks.resolveRequestWorkspace.mockResolvedValueOnce(null);
    const response = await listKnowledge(request("/api/storage/knowledge"));
    await expect(response.json()).resolves.toEqual({ ok: true, documents: [] });
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("requires same-origin writes and rejects client workspace authority", async () => {
    expect((await createKnowledge(request("/api/storage/knowledge", "POST", { document }, false))).status).toBe(403);
    const response = await createKnowledge(request("/api/storage/knowledge", "POST", { document, workspaceId: "other" }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates, updates, deletes and reads chunks through one repository contract", async () => {
    expect((await createKnowledge(request("/api/storage/knowledge", "POST", { document }))).status).toBe(201);
    expect((await updateKnowledge(request("/api/storage/knowledge/doc-1", "PATCH", { update: { enabled: false } }), { params: Promise.resolve({ id: "doc-1" }) })).status).toBe(200);
    expect((await listChunks(request("/api/storage/knowledge/doc-1/chunks"), { params: Promise.resolve({ id: "doc-1" }) })).status).toBe(200);
    expect((await deleteKnowledge(request("/api/storage/knowledge/doc-1", "DELETE"), { params: Promise.resolve({ id: "doc-1" }) })).status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ id: "doc-1" }));
    expect(mocks.update).toHaveBeenCalledWith("doc-1", expect.objectContaining({ enabled: false }));
    expect(mocks.remove).toHaveBeenCalledWith("doc-1");
  });

  it("restores a complete knowledge backup through one workspace-scoped transaction", async () => {
    const response = await restoreKnowledge(request("/api/storage/knowledge/restore", "POST", { documents: [document] }));
    expect(response.status).toBe(200);
    expect(mocks.replaceAll).toHaveBeenCalledWith([expect.objectContaining({ id: "doc-1" })]);
    await expect(response.json()).resolves.toMatchObject({ documents: [{ id: "doc-1" }] });
    expect((await restoreKnowledge(request("/api/storage/knowledge/restore", "POST", { documents: [document], workspaceId: "other" }))).status).toBe(400);
  });
});

describe("storage migration routes", () => {
  it("previews a sanitized package and requires explicit confirmation to execute", async () => {
    const payload = { migrationId: "migration-1", conversations: [], knowledgeDocuments: [document] };
    expect((await previewMigration(request("/api/storage/migration/preview", "POST", payload))).status).toBe(200);
    expect((await executeMigration(request("/api/storage/migration", "POST", payload))).status).toBe(400);
    expect((await executeMigration(request("/api/storage/migration", "POST", { ...payload, confirmed: true }))).status).toBe(200);
    expect(mocks.executeStorageMigration).toHaveBeenCalledWith("ws-1", expect.objectContaining({ migrationId: "migration-1" }));
  });

  it("returns an idempotent result without exposing migrated bodies", async () => {
    const response = await getMigration(request("/api/storage/migration?migrationId=migration-1"));
    expect(response.status).toBe(200);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("migration-1");
    expect(body).not.toContain("订单签收");
  });
});
