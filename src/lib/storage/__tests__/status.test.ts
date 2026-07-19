import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerConversationRepository } from "@/lib/storage/conversationRepository";
import { clearClientStorageStatusCache, getClientStorageStatus, localStorageStatus } from "@/lib/storage/status";

describe("client storage status", () => {
  afterEach(() => {
    clearClientStorageStatusCache();
    vi.unstubAllGlobals();
  });

  it("accepts only safe aggregate server status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getClientStorageStatus()).resolves.toEqual({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    expect(JSON.stringify(await getClientStorageStatus())).not.toMatch(/url|password|secret|token/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed to degraded when status cannot be verified", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getClientStorageStatus()).resolves.toMatchObject({ configured: true, healthy: false, storageMode: "degraded" });
    await expect(getClientStorageStatus()).resolves.toMatchObject({ configured: true, healthy: true, storageMode: "server" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-reads the latest server revision after degraded storage recovers", async () => {
    const staleCachedRevision = 2;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/storage/status") {
        if (fetchMock.mock.calls.filter(([url]) => String(url) === path).length === 1) throw new Error("offline");
        return Response.json({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
      }
      if (path === "/api/storage/conversations") {
        return Response.json({ conversations: [{ id: "conversation-a", revision: 7 }] });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getClientStorageStatus()).resolves.toMatchObject({ storageMode: "degraded" });
    await expect(getClientStorageStatus()).resolves.toMatchObject({ storageMode: "server" });
    const conversations = await new ServerConversationRepository().list();

    expect(conversations[0]?.revision).toBe(7);
    expect(conversations[0]?.revision).not.toBe(staleCachedRevision);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/api/storage/status",
      "/api/storage/status",
      "/api/storage/conversations",
    ]);
  });

  it("force refreshes a cached healthy status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await getClientStorageStatus();
    await getClientStorageStatus(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes a deterministic local default", () => {
    expect(localStorageStatus()).toEqual({ configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" });
  });
});
