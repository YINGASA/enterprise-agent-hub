import { describe, expect, it } from "vitest";
import { getServerStorageConfiguration, resolveStorageMode } from "@/lib/server-storage/config";

describe("server storage configuration", () => {
  it("returns local mode when server storage is disabled", () => {
    const configuration = getServerStorageConfiguration({
      SERVER_STORAGE_ENABLED: "false",
      DATABASE_URL: "configured-without-exposing-value",
      STORAGE_SESSION_SECRET: "configured-without-exposing-value",
    });
    expect(resolveStorageMode({ ...configuration, databaseHealthy: true })).toBe("local");
  });

  it("requires database and session configuration before server mode", () => {
    const enabled = { storageEnabled: true, databaseConfigured: true, sessionSecretConfigured: true };
    expect(resolveStorageMode({ ...enabled, databaseHealthy: true })).toBe("server");
    expect(resolveStorageMode({ ...enabled, databaseHealthy: false })).toBe("degraded");
    expect(resolveStorageMode({ ...enabled, databaseConfigured: false, databaseHealthy: true })).toBe("degraded");
    expect(resolveStorageMode({ ...enabled, sessionSecretConfigured: false, databaseHealthy: true })).toBe("degraded");
  });

  it("exposes booleans only and never returns configuration values", () => {
    const configuration = getServerStorageConfiguration({
      SERVER_STORAGE_ENABLED: "1",
      DATABASE_URL: "sensitive-database-value",
      STORAGE_SESSION_SECRET: "sensitive-session-value",
    });
    expect(configuration).toEqual({ storageEnabled: true, databaseConfigured: true, sessionSecretConfigured: true });
    expect(JSON.stringify(configuration)).not.toContain("sensitive");
  });
});
