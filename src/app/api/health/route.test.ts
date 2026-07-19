import { beforeEach, describe, expect, it, vi } from "vitest";

const getSafeApplicationHealth = vi.fn();
vi.mock("@/lib/production/health", () => ({ getSafeApplicationHealth }));

describe("GET /api/health", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the safe aggregate health contract", async () => {
    getSafeApplicationHealth.mockResolvedValue({
      applicationHealthy: true,
      databaseConfigured: true,
      databaseHealthy: true,
      migrationReady: true,
      storageMode: "server",
      realApiConfigured: false,
      realApiHealthy: null,
      parserReady: true,
      nodeCompatible: true,
      version: "2.2.3",
    });
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ storageMode: "server", version: "2.2.3", migrationReady: true });
    expect(JSON.stringify(body)).not.toMatch(/database_url|api_key|secret|cookie|prompt|summary/i);
  });

  it("returns 503 for a safe degraded state", async () => {
    getSafeApplicationHealth.mockResolvedValue({
      applicationHealthy: false,
      databaseConfigured: true,
      databaseHealthy: false,
      migrationReady: false,
      storageMode: "degraded",
      realApiConfigured: true,
      realApiHealthy: null,
      parserReady: true,
      nodeCompatible: true,
      version: "2.2.3",
    });
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(503);
  });
});
