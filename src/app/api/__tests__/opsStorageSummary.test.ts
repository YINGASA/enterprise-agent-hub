import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isOpsTokenConfigured: vi.fn(),
  validateOpsToken: vi.fn(),
  getOpsSummary: vi.fn(),
  getSafeStorageStatus: vi.fn(),
  getSafeWorkspaceStorageMetrics: vi.fn(),
  resolveRequestWorkspace: vi.fn(),
}));

vi.mock("@/lib/ops/auth", () => ({
  isOpsTokenConfigured: mocks.isOpsTokenConfigured,
  validateOpsToken: mocks.validateOpsToken,
}));
vi.mock("@/lib/ops/storage", () => ({ getOpsSummary: mocks.getOpsSummary }));
vi.mock("@/lib/llm", () => ({ getLlmConfig: () => ({ isConfigured: false }) }));
vi.mock("@/lib/server-storage/prisma", () => ({ getPrismaClient: () => ({ safe: true }) }));
vi.mock("@/lib/server-storage/workspace", () => ({ resolveRequestWorkspace: mocks.resolveRequestWorkspace }));
vi.mock("@/lib/server-storage/status", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-storage/status")>();
  return {
    ...actual,
    getSafeStorageStatus: mocks.getSafeStorageStatus,
    getSafeWorkspaceStorageMetrics: mocks.getSafeWorkspaceStorageMetrics,
  };
});

import { GET } from "@/app/api/ops/summary/route";

const request = () => new Request("http://test.local/api/ops/summary", { headers: { authorization: "Bearer safe-test-token" } });

describe("GET /api/ops/summary storage status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isOpsTokenConfigured.mockReturnValue(true);
    mocks.validateOpsToken.mockReturnValue(true);
    mocks.getSafeStorageStatus.mockResolvedValue({ configured: true, healthy: true, storageMode: "server", databaseType: "postgresql" });
    mocks.resolveRequestWorkspace.mockResolvedValue({ workspaceId: "workspace-1", setCookie: "opaque-workspace-cookie" });
    mocks.getSafeWorkspaceStorageMetrics.mockResolvedValue({
      storageMode: "server",
      databaseConfigured: true,
      databaseHealthy: true,
      conversationCount: 2,
      messageCount: 8,
      knowledgeDocumentCount: 3,
      migrationCount: 1,
      storageErrorCount: 0,
    });
    mocks.getOpsSummary.mockImplementation(async (_configured: boolean, serverStorage: unknown) => ({ totalRuns: 0, serverStorage }));
  });

  it("preserves Ops authentication boundaries", async () => {
    mocks.isOpsTokenConfigured.mockReturnValueOnce(false);
    const unconfigured = await GET(request());
    expect(unconfigured.status).toBe(401);
    expect(unconfigured.headers.get("cache-control")).toBe("private, no-store");
    mocks.isOpsTokenConfigured.mockReturnValue(true);
    mocks.validateOpsToken.mockReturnValueOnce(false);
    const invalid = await GET(request());
    expect(invalid.status).toBe(401);
    expect(invalid.headers.get("vary")).toContain("x-ops-token");
    expect(mocks.getSafeStorageStatus).not.toHaveBeenCalled();
  });

  it("returns only workspace-scoped aggregate storage fields", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBe("opaque-workspace-cookie");
    const body = await response.json();
    expect(body.summary.serverStorage).toEqual(expect.objectContaining({ storageMode: "server", conversationCount: 2, messageCount: 8, knowledgeDocumentCount: 3 }));
    expect(JSON.stringify(body)).not.toMatch(/database[_-]?url|password|secret|summary text|message body/i);
  });

  it("degrades safely when workspace metrics cannot be read", async () => {
    mocks.getSafeWorkspaceStorageMetrics.mockRejectedValueOnce(new Error("private database failure"));
    const response = await GET(request());
    const body = await response.json();
    expect(body.summary.serverStorage).toEqual(expect.objectContaining({ storageMode: "degraded", databaseHealthy: false, storageErrorCount: 1 }));
    expect(JSON.stringify(body)).not.toContain("private database failure");
  });
});
