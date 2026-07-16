import { beforeEach, describe, expect, it, vi } from "vitest";

const getSafeStorageStatus = vi.fn();
const resolveRequestWorkspace = vi.fn();

vi.mock("@/lib/server-storage/status", () => ({ getSafeStorageStatus }));
vi.mock("@/lib/server-storage/workspace", () => ({ resolveRequestWorkspace }));

describe("GET /api/storage/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns local status without creating a workspace", async () => {
    getSafeStorageStatus.mockResolvedValue({ configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://hub.example/api/storage/status"));
    expect(await response.json()).toEqual({ configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(resolveRequestWorkspace).not.toHaveBeenCalled();
  });

  it("checks an existing workspace without creating or setting one from a status GET", async () => {
    getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    resolveRequestWorkspace.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new Request("https://hub.example/api/storage/status"));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(resolveRequestWorkspace).toHaveBeenCalledWith(expect.any(Request), { createIfMissing: false });
  });

  it("reports degraded status without exposing workspace errors", async () => {
    getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    resolveRequestWorkspace.mockRejectedValue(new Error("private database detail"));
    const { GET } = await import("./route");
    const response = await GET(new Request("https://hub.example/api/storage/status"));
    const body = await response.json();
    expect(body).toEqual({ configured: true, healthy: false, storageMode: "degraded", databaseType: "postgresql" });
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });
});
