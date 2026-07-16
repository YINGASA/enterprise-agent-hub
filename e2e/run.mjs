import { spawn, spawnSync } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const workspace = process.cwd();
const server = spawn(process.execPath, [path.join(workspace, "e2e", "server.mjs")], { cwd: workspace, stdio: "inherit" });

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`E2E server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch("http://127.0.0.1:3100", { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the isolated E2E server.");
}

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolve) => {
    const runner = spawn(process.execPath, [path.join(workspace, "node_modules", "@playwright", "test", "cli.js"), "test"], { cwd: workspace, stdio: "inherit" });
    runner.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
  for (const entry of await readdir(workspace, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(".eah-e2e-app-")) {
      await rm(path.join(workspace, entry.name), { recursive: true, force: true }).catch(() => undefined);
    }
  }
  await rm(path.join(workspace, "test-results"), { recursive: true, force: true }).catch(() => undefined);
  await rm(path.join(workspace, "playwright-report"), { recursive: true, force: true }).catch(() => undefined);
}

process.exit(exitCode);
