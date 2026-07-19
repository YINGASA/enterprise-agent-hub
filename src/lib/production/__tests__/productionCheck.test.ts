import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";

function runCheck(extraEnvironment: Record<string, string | undefined> = {}) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(process.cwd(), "scripts/production-check.mjs")], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SERVER_STORAGE_ENABLED: "false",
        DATABASE_URL: "",
        STORAGE_SESSION_SECRET: "",
        AI_API_KEY: "",
        EAH_OPS_TOKEN: "",
        ...extraEnvironment,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

describe("production check script", () => {
  it("passes safe local mode on the exact Node baseline", async () => {
    const result = await runCheck();
    expect(result.code).toBe(0);
    const body = JSON.parse(result.output) as Record<string, unknown>;
    expect(body).toMatchObject({
      healthy: true,
      applicationVersion: "2.2.2",
      nodeCompatible: true,
      nodeVersion: "20.19.5",
      storageMode: "local",
      prismaClientReady: true,
      httpClientReady: true,
      parserReady: true,
      realApiConfigured: false,
      realApiHealthy: null,
    });
    expect(String(body.gitCommit)).toMatch(/^[0-9a-f]{40}$/);
    expect(result.output).not.toMatch(/postgresql:\/\/|api[_-]?key|cookie|prompt|summary|private local path/i);
  }, 20_000);

  it("accepts only a canonical environment commit identifier", async () => {
    const result = await runCheck({
      EAH_GIT_COMMIT: "A".repeat(40),
      GITHUB_SHA: "private-version-marker",
    });
    expect(result.code).toBe(0);
    const body = JSON.parse(result.output) as Record<string, unknown>;
    expect(body.gitCommit).toBe("a".repeat(40));
    expect(result.output).not.toContain("private-version-marker");
  }, 20_000);

  it("fails closed when server storage is enabled without safe configuration", async () => {
    const result = await runCheck({ SERVER_STORAGE_ENABLED: "true" });
    expect(result.code).toBe(1);
    const body = JSON.parse(result.output) as Record<string, unknown>;
    expect(body).toMatchObject({ healthy: false, storageMode: "degraded", sessionSecretReady: false });
  }, 20_000);
});
