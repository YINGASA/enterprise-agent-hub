import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const workspace = process.cwd();
const tempRoot = await mkdtemp(path.join(workspace, ".eah-e2e-app-"));
const runtimeEnv = {};
for (const key of ["APPDATA", "ComSpec", "LOCALAPPDATA", "NUMBER_OF_PROCESSORS", "PATH", "PATHEXT", "PROCESSOR_ARCHITECTURE", "SystemRoot", "TEMP", "TMP", "USERPROFILE", "WINDIR"]) {
  if (process.env[key] !== undefined) runtimeEnv[key] = process.env[key];
}
for (const entry of ["src", "package.json", "package-lock.json", "next-env.d.ts", "tsconfig.json", "postcss.config.mjs", "tailwind.config.ts"]) {
  await cp(path.join(workspace, entry), path.join(tempRoot, entry), { recursive: true });
}
await writeFile(path.join(tempRoot, "next.config.mjs"), "export default { outputFileTracingRoot: process.cwd() };\n", "utf8");
await symlink(path.join(workspace, "node_modules"), path.join(tempRoot, "node_modules"), "junction");

const child = spawn(process.execPath, [path.join(workspace, "node_modules", "next", "dist", "bin", "next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: tempRoot,
  env: { ...runtimeEnv, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: "inherit",
});

let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill("SIGTERM");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(tempRoot, { recursive: true, force: true });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
child.on("exit", (code) => void shutdown(code ?? 0));
