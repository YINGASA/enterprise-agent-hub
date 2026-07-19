import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const requiredMigration = "20260718000000_v222_production_hardening";
const expectedNode = "20.19.5";

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function enabled(value) {
  return value === "1" || value?.toLowerCase() === "true";
}

function safeSessionSecret(value) {
  if (!configured(value) || value.trim().length < 32) return false;
  const normalized = value.trim().toLowerCase();
  if (/(replace[_ -]?with|change[_ -]?me|your[_ -]?secret|example|default)/.test(normalized)) return false;
  return new Set(value).size >= 10;
}

function normalizeGitCommit(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(normalized) ? normalized : null;
}

function readGitCommit() {
  for (const key of ["EAH_GIT_COMMIT", "GITHUB_SHA", "VERCEL_GIT_COMMIT_SHA", "GIT_COMMIT"]) {
    const commit = normalizeGitCommit(process.env[key]);
    if (commit) return commit;
  }
  try {
    return normalizeGitCommit(execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
    }));
  } catch {
    return null;
  }
}

async function runtimeDependencyCheck() {
  let PrismaClient;
  let prismaClientReady = false;
  let httpClientReady = false;
  let parserReady = false;

  try {
    const prismaModule = await import("@prisma/client");
    PrismaClient = prismaModule.PrismaClient;
    if (typeof PrismaClient === "function") {
      const prisma = new PrismaClient({ log: [] });
      await prisma.$disconnect();
      prismaClientReady = true;
    }
  } catch {
    PrismaClient = undefined;
  }

  try {
    const undici = await import("undici");
    httpClientReady = typeof undici.fetch === "function" && typeof undici.ProxyAgent === "function";
  } catch {
    httpClientReady = false;
  }

  try {
    await Promise.all([
      import("mammoth"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("yauzl"),
    ]);
    parserReady = true;
  } catch {
    parserReady = false;
  }

  return { PrismaClient, prismaClientReady, httpClientReady, parserReady };
}

async function temporaryDirectoryCheck() {
  let directory;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "eah-production-check-"));
    const file = path.join(directory, "write-check");
    await writeFile(file, "ok", { flag: "wx" });
    await access(file, fsConstants.R_OK | fsConstants.W_OK);
    return true;
  } catch {
    return false;
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function databaseCheck(storageEnabled, PrismaClient) {
  if (!storageEnabled) return { databaseHealthy: false, migrationReady: null, schemaReady: null };
  if (!configured(process.env.DATABASE_URL) || typeof PrismaClient !== "function") {
    return { databaseHealthy: false, migrationReady: false, schemaReady: false };
  }

  const prisma = new PrismaClient({ log: [] });
  try {
    await prisma.$queryRaw`SELECT 1`;
    const migrations = await prisma.$queryRaw`
      SELECT finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${requiredMigration}
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const migration = migrations[0];
    const migrationReady = Boolean(migration?.finished_at && !migration?.rolled_back_at);
    const columns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'knowledge_documents'
        AND column_name IN ('normalized_title', 'normalized_file_name')
    `;
    const schemaReady = columns.length === 2;
    return { databaseHealthy: true, migrationReady, schemaReady };
  } catch {
    return { databaseHealthy: false, migrationReady: false, schemaReady: false };
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

const storageEnabled = enabled(process.env.SERVER_STORAGE_ENABLED);
const nodeCompatible = process.versions.node === expectedNode;
const runtimeDependencies = await runtimeDependencyCheck();
const tempDirectoryWritable = await temporaryDirectoryCheck();
const sessionSecretReady = !storageEnabled || safeSessionSecret(process.env.STORAGE_SESSION_SECRET);
const database = await databaseCheck(storageEnabled, runtimeDependencies.PrismaClient);
const storageReady = !storageEnabled
  || (sessionSecretReady && database.databaseHealthy && database.migrationReady && database.schemaReady);
let undiciVersion = "unavailable";
try {
  undiciVersion = require("undici/package.json").version;
} catch {
  // Kept as a safe status; no resolved local path is printed.
}

const result = {
  applicationVersion: "2.2.3",
  gitCommit: readGitCommit(),
  nodeCompatible,
  nodeVersion: process.versions.node,
  expectedNode,
  undiciVersion,
  prismaClientReady: runtimeDependencies.prismaClientReady,
  httpClientReady: runtimeDependencies.httpClientReady,
  parserReady: runtimeDependencies.parserReady,
  temporaryDirectoryWritable: tempDirectoryWritable,
  storageMode: storageEnabled ? (storageReady ? "server" : "degraded") : "local",
  databaseConfigured: configured(process.env.DATABASE_URL),
  databaseHealthy: database.databaseHealthy,
  migrationReady: database.migrationReady,
  schemaReady: database.schemaReady,
  sessionSecretReady,
  realApiConfigured: configured(process.env.AI_API_KEY),
  // Upstream health is intentionally not probed here; /api/llm/health owns
  // that explicit network check and never runs as part of a release gate.
  realApiHealthy: null,
  opsTokenConfigured: configured(process.env.EAH_OPS_TOKEN),
};

const healthy = nodeCompatible
  && runtimeDependencies.prismaClientReady
  && runtimeDependencies.httpClientReady
  && runtimeDependencies.parserReady
  && tempDirectoryWritable
  && storageReady;
process.stdout.write(`${JSON.stringify({ healthy, ...result }, null, 2)}\n`);
if (!healthy) process.exitCode = 1;
