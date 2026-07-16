import { describe, expect, it } from "vitest";
import {
  WORKSPACE_COOKIE_NAME,
  resolveAnonymousWorkspace,
  resolveRequestWorkspace,
  type AnonymousWorkspaceRepository,
} from "@/lib/server-storage/workspace";

function memoryRepository() {
  const records = new Map<string, { id: string }>();
  const repository: AnonymousWorkspaceRepository = {
    async findBySessionTokenHash(hash) { return records.get(hash) ?? null; },
    async create(input) { const record = { id: input.id }; records.set(input.sessionTokenHash, record); return record; },
  };
  return { repository, records };
}

function cookieValue(setCookie: string): string {
  return decodeURIComponent(setCookie.split(";")[0]!.slice(`${WORKSPACE_COOKIE_NAME}=`.length));
}

describe("anonymous workspace isolation", () => {
  it("creates an opaque signed cookie and resolves the same workspace again", async () => {
    const { repository, records } = memoryRepository();
    const options = {
      sessionSecret: "s".repeat(32),
      secureCookie: true,
      generateToken: () => "t".repeat(43),
      generateWorkspaceId: () => "workspace-internal-id",
    };
    const first = await resolveAnonymousWorkspace(undefined, repository, options);
    expect(first.workspaceId).toBe("workspace-internal-id");
    expect(first.setCookie).toContain("HttpOnly");
    expect(first.setCookie).toContain("SameSite=Lax");
    expect(first.setCookie).toContain("Secure");
    expect(first.setCookie).not.toContain("workspace-internal-id");
    expect(records.size).toBe(1);

    const second = await resolveAnonymousWorkspace(cookieValue(first.setCookie!), repository, options);
    expect(second).toEqual({ workspaceId: "workspace-internal-id", setCookie: undefined });
    expect(records.size).toBe(1);
  });

  it("does not trust an unsigned client workspace identifier", async () => {
    const { repository } = memoryRepository();
    const result = await resolveAnonymousWorkspace("workspace-from-client", repository, {
      sessionSecret: "s".repeat(32),
      secureCookie: false,
      generateToken: () => "n".repeat(43),
      generateWorkspaceId: () => "workspace-created-server-side",
    });
    expect(result.workspaceId).toBe("workspace-created-server-side");
    expect(result.setCookie).toBeDefined();
  });

  it("requires a sufficiently long session secret at the request boundary", async () => {
    const { repository } = memoryRepository();
    const request = new Request("https://hub.example/api/storage/status");
    await expect(resolveRequestWorkspace(request, { repository, storageEnabled: true, sessionSecret: "short" })).rejects.toMatchObject({
      code: "storage_misconfigured",
      status: 503,
    });
  });

  it("rejects disabled server storage before reading or creating a workspace", async () => {
    const { repository, records } = memoryRepository();
    const request = new Request("https://hub.example/api/storage/conversations");
    await expect(resolveRequestWorkspace(request, {
      repository,
      storageEnabled: false,
      sessionSecret: "s".repeat(32),
    })).rejects.toMatchObject({ code: "storage_unavailable", status: 503 });
    expect(records.size).toBe(0);
  });

  it("does not create a database workspace for a read-only request without a valid cookie", async () => {
    const { repository, records } = memoryRepository();
    const request = new Request("https://hub.example/api/storage/conversations");
    await expect(resolveRequestWorkspace(request, {
      repository,
      storageEnabled: true,
      sessionSecret: "s".repeat(32),
      createIfMissing: false,
    })).resolves.toBeNull();
    expect(records.size).toBe(0);
  });
});
