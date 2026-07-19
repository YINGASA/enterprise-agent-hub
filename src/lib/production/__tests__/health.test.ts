import { describe, expect, it, vi } from "vitest";
import {
  areKnowledgeParsersReady,
  expectedProductionNodeVersion,
  getSafeApplicationHealth,
  isNode20Compatible,
  isProductionMigrationReady,
  requiredProductionMigration,
} from "@/lib/production/health";

describe("production health", () => {
  it("accepts only the supported Node 20 baseline", () => {
    expect(expectedProductionNodeVersion).toBe("20.19.5");
    expect(isNode20Compatible("20.19.0")).toBe(false);
    expect(isNode20Compatible("20.19.5")).toBe(true);
    expect(isNode20Compatible("20.20.0")).toBe(false);
    expect(isNode20Compatible("20.18.9")).toBe(false);
    expect(isNode20Compatible("22.0.0")).toBe(false);
    expect(isNode20Compatible("not-a-version")).toBe(false);
  });

  it("checks the required successful migration without exposing database metadata", async () => {
    const queryRaw = vi.fn(async () => [{ finished_at: new Date(), rolled_back_at: null }]);
    expect(await isProductionMigrationReady({ $queryRaw: queryRaw } as never)).toBe(true);
    expect(requiredProductionMigration).toBe("20260718000000_v222_production_hardening");
    expect(await isProductionMigrationReady({ $queryRaw: vi.fn(async () => []) } as never)).toBe(false);
    expect(await isProductionMigrationReady({ $queryRaw: vi.fn(async () => { throw new Error("private url"); }) } as never)).toBe(false);
  });

  it("reports parser load failures as a safe scalar", async () => {
    expect(await areKnowledgeParsersReady(async () => undefined)).toBe(true);
    expect(await areKnowledgeParsersReady(async () => { throw new Error("private local path"); })).toBe(false);
  });

  it("keeps local mode healthy and marks degraded storage unhealthy", async () => {
    const local = await getSafeApplicationHealth({
      storageStatus: { configured: false, healthy: false, storageMode: "local", databaseType: "postgresql" },
      parserReady: true,
      migrationReady: null,
      nodeVersion: "20.19.5",
      realApiConfigured: false,
    });
    expect(local).toEqual({
      applicationHealthy: true,
      databaseConfigured: false,
      databaseHealthy: false,
      migrationReady: null,
      storageMode: "local",
      realApiConfigured: false,
      realApiHealthy: null,
      parserReady: true,
      nodeCompatible: true,
      version: "2.2.3",
    });

    const degraded = await getSafeApplicationHealth({
      storageStatus: { configured: true, healthy: false, storageMode: "degraded", databaseType: "postgresql" },
      parserReady: true,
      migrationReady: false,
      nodeVersion: "20.19.5",
    });
    expect(degraded.applicationHealthy).toBe(false);
    expect(JSON.stringify(degraded)).not.toMatch(/url|secret|cookie|prompt|summary/i);
  });
});
