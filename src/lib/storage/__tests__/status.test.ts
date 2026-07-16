import { afterEach, describe, expect, it, vi } from "vitest";
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
