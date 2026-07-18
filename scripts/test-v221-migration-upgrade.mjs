import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = process.env.TEST_DATABASE_URL;
if (process.env.RUN_POSTGRES_INTEGRATION !== "1" || !sourceUrl) {
  process.stdout.write("V2.2.0 -> V2.2.1 PostgreSQL migration test skipped (isolated test database not configured).\n");
  process.exit(0);
}

const databaseName = `eah_v221_upgrade_${Date.now()}_${randomBytes(4).toString("hex")}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
databaseUrl.search = "";
const isolatedUrl = databaseUrl.toString();
const admin = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
let testClient;
let tempRoot;

function safeCliError(result) {
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return output
    .replaceAll(sourceUrl, "[REDACTED_DATABASE_URL]")
    .replaceAll(isolatedUrl, "[REDACTED_TEST_DATABASE_URL]")
    .slice(-4_000);
}

function migrate(schemaPath, url) {
  const cli = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [cli, "migrate", "deploy", "--schema", schemaPath], {
    cwd: workspace,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`Prisma migration deploy failed.\n${safeCliError(result)}`);
}

try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  tempRoot = await mkdtemp(path.join(tmpdir(), "eah-v221-upgrade-"));
  const oldPrismaRoot = path.join(tempRoot, "prisma");
  await mkdir(path.join(oldPrismaRoot, "migrations"), { recursive: true });
  await cp(path.join(workspace, "prisma", "schema.prisma"), path.join(oldPrismaRoot, "schema.prisma"));
  await cp(path.join(workspace, "prisma", "migrations", "migration_lock.toml"), path.join(oldPrismaRoot, "migrations", "migration_lock.toml"));
  await cp(
    path.join(workspace, "prisma", "migrations", "20260716000000_v220_server_storage"),
    path.join(oldPrismaRoot, "migrations", "20260716000000_v220_server_storage"),
    { recursive: true },
  );

  migrate(path.join(oldPrismaRoot, "schema.prisma"), isolatedUrl);
  testClient = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  const workspaceId = `upgrade-${randomBytes(8).toString("hex")}`;
  const documentId = `document-${randomBytes(8).toString("hex")}`;
  const jobId = `job-${randomBytes(8).toString("hex")}`;
  const now = new Date("2026-07-18T00:00:00.000Z");
  await testClient.$executeRawUnsafe(
    `INSERT INTO "workspaces" ("id", "name", "session_token_hash", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $4)`,
    workspaceId, "V2.2.0 upgrade fixture", randomBytes(32).toString("hex"), now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "knowledge_documents" ("workspace_id", "id", "title", "content", "source_type", "checksum", "created_at", "updated_at") VALUES ($1, $2, $3, $4, 'user_upload', $5, $6, $6)`,
    workspaceId, documentId, "V2.2.0 knowledge", "Existing data must survive V2.2.1 migration.", randomBytes(32).toString("hex"), now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "knowledge_chunks" ("workspace_id", "id", "document_id", "chunk_index", "content", "created_at") VALUES ($1, $2, $3, 0, $4, $5)`,
    workspaceId, `chunk-${randomBytes(8).toString("hex")}`, documentId, "Existing chunk remains readable.", now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "import_jobs" ("workspace_id", "id", "status", "document_id", "created_at", "updated_at") VALUES ($1, $2, 'completed', $3, $4, $4)`,
    workspaceId, jobId, documentId, now,
  );
  await testClient.$disconnect();
  testClient = undefined;

  migrate(path.join(workspace, "prisma", "schema.prisma"), isolatedUrl);
  testClient = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  const [documents, jobs, chunks] = await Promise.all([
    testClient.$queryRawUnsafe(
      `SELECT "title", "content", "revision", "knowledge_pack_id", "content_checksum" FROM "knowledge_documents" WHERE "workspace_id" = $1 AND "id" = $2`,
      workspaceId, documentId,
    ),
    testClient.$queryRawUnsafe(
      `SELECT "status"::text AS "status", "total_items", "completed_items", "failed_items", "revision", "completed_at" FROM "import_jobs" WHERE "workspace_id" = $1 AND "id" = $2`,
      workspaceId, jobId,
    ),
    testClient.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "count" FROM "knowledge_chunks" WHERE "workspace_id" = $1 AND "document_id" = $2`,
      workspaceId, documentId,
    ),
  ]);
  const document = documents[0];
  const job = jobs[0];
  const chunk = chunks[0];
  if (!document || document.title !== "V2.2.0 knowledge" || document.revision !== 0 || document.knowledge_pack_id !== null || document.content_checksum !== null) {
    throw new Error("V2.2.0 knowledge data or V2.2.1 defaults changed during migration.");
  }
  if (!job || job.status !== "completed" || job.total_items !== 1 || job.completed_items !== 1 || job.failed_items !== 0 || job.revision !== 0 || !(job.completed_at instanceof Date)) {
    throw new Error("V2.2.0 import job was not backfilled correctly.");
  }
  if (!chunk || chunk.count !== 1) throw new Error("V2.2.0 knowledge chunks did not survive migration.");
  process.stdout.write("V2.2.0 -> V2.2.1 PostgreSQL migration test passed (1 workspace, 1 document, 1 chunk, 1 import job).\n");
} finally {
  await testClient?.$disconnect().catch(() => undefined);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
  await admin.$disconnect().catch(() => undefined);
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
}
