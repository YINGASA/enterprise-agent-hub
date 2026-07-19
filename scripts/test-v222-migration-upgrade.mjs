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
  process.stdout.write("V2.2.1 -> V2.2.2 PostgreSQL migration test skipped (isolated test database not configured).\n");
  process.exit(0);
}

const databaseName = `eah_v222_upgrade_${Date.now()}_${randomBytes(4).toString("hex")}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
databaseUrl.search = "";
const isolatedUrl = databaseUrl.toString();
const admin = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
let testClient;
let tempRoot;

function safeCliError(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`
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
  tempRoot = await mkdtemp(path.join(tmpdir(), "eah-v222-upgrade-"));
  const oldPrismaRoot = path.join(tempRoot, "prisma");
  await mkdir(path.join(oldPrismaRoot, "migrations"), { recursive: true });
  await cp(path.join(workspace, "prisma", "schema.prisma"), path.join(oldPrismaRoot, "schema.prisma"));
  await cp(path.join(workspace, "prisma", "migrations", "migration_lock.toml"), path.join(oldPrismaRoot, "migrations", "migration_lock.toml"));
  for (const migration of ["20260716000000_v220_server_storage", "20260717000000_v221_knowledge_pack_import"]) {
    await cp(
      path.join(workspace, "prisma", "migrations", migration),
      path.join(oldPrismaRoot, "migrations", migration),
      { recursive: true },
    );
  }

  migrate(path.join(oldPrismaRoot, "schema.prisma"), isolatedUrl);
  testClient = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  const workspaceId = `upgrade-${randomBytes(8).toString("hex")}`;
  const documentId = `document-${randomBytes(8).toString("hex")}`;
  const conversationId = `conversation-${randomBytes(8).toString("hex")}`;
  const jobId = `job-${randomBytes(8).toString("hex")}`;
  const itemId = `item-${randomBytes(8).toString("hex")}`;
  const now = new Date("2026-07-18T00:00:00.000Z");
  await testClient.$executeRawUnsafe(
    `INSERT INTO "workspaces" ("id", "name", "session_token_hash", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $4)`,
    workspaceId, "V2.2.1 upgrade fixture", randomBytes(32).toString("hex"), now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "knowledge_documents" ("workspace_id", "id", "title", "content", "source_type", "checksum", "content_checksum", "original_file_name", "created_at", "updated_at") VALUES ($1, $2, $3, $4, 'user_upload', $5, $6, $7, $8, $8)`,
    workspaceId, documentId, "Ｒｅｆｕｎｄ—Policy 2026！", "Existing V2.2.1 knowledge remains readable.", randomBytes(32).toString("hex"), randomBytes(32).toString("hex"), "  Policy\t Guide .DOCX ", now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "conversations" ("workspace_id", "id", "title", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $4)`,
    workspaceId, conversationId, "Retained conversation", now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "import_jobs" ("workspace_id", "id", "status", "total_items", "created_at", "updated_at") VALUES ($1, $2, 'processing', 1, $3, $3)`,
    workspaceId, jobId, now,
  );
  await testClient.$executeRawUnsafe(
    `INSERT INTO "import_items" ("workspace_id", "id", "import_job_id", "item_index", "original_file_name", "normalized_title", "mime_type", "size_bytes", "checksum", "status", "lease_expires_at", "created_at", "updated_at") VALUES ($1, $2, $3, 0, 'policy.txt', 'policy', 'text/plain', 10, $4, 'processing', $5, $6, $6)`,
    workspaceId, itemId, jobId, randomBytes(32).toString("hex"), new Date(now.getTime() - 1_000), now,
  );
  await testClient.$disconnect();
  testClient = undefined;

  migrate(path.join(workspace, "prisma", "schema.prisma"), isolatedUrl);
  // A second deploy must be a no-op. This exercises the exact command used by
  // production releases without resetting or rewriting migration history.
  migrate(path.join(workspace, "prisma", "schema.prisma"), isolatedUrl);
  testClient = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  const [documents, retained, indexes] = await Promise.all([
    testClient.$queryRawUnsafe(
      `SELECT "title", "content", "normalized_title", "normalized_file_name" FROM "knowledge_documents" WHERE "workspace_id" = $1 AND "id" = $2`,
      workspaceId, documentId,
    ),
    testClient.$queryRawUnsafe(
      `SELECT
        (SELECT COUNT(*)::int FROM "conversations" WHERE "workspace_id" = $1 AND "id" = $2) AS "conversation_count",
        (SELECT COUNT(*)::int FROM "import_jobs" WHERE "workspace_id" = $1 AND "id" = $3) AS "job_count",
        (SELECT COUNT(*)::int FROM "import_items" WHERE "workspace_id" = $1 AND "id" = $4) AS "item_count"`,
      workspaceId, conversationId, jobId, itemId,
    ),
    testClient.$queryRawUnsafe(
      `SELECT "indexname" FROM "pg_indexes"
       WHERE "schemaname" = current_schema()
         AND "indexname" IN (
           'conversations_active_updated_idx',
           'messages_run_id_lookup_idx',
           'knowledge_documents_normalized_title_idx',
           'knowledge_documents_normalized_file_name_idx',
           'import_jobs_status_updated_idx',
           'import_items_job_status_order_idx',
           'import_items_claim_queue_idx',
           'import_items_workspace_status_idx',
           'import_items_workspace_error_idx',
           'import_items_workspace_conflict_idx'
         )
       ORDER BY "indexname"`,
    ),
  ]);
  const document = documents[0];
  const counts = retained[0];
  if (!document
    || document.title !== "Ｒｅｆｕｎｄ—Policy 2026！"
    || document.content !== "Existing V2.2.1 knowledge remains readable."
    || document.normalized_title !== "refundpolicy2026"
    || document.normalized_file_name !== "policy guide .docx") {
    throw new Error("V2.2.1 knowledge data or V2.2.2 normalized backfill changed unexpectedly.");
  }
  if (!counts || counts.conversation_count !== 1 || counts.job_count !== 1 || counts.item_count !== 1) {
    throw new Error("V2.2.1 conversation or import task data did not survive V2.2.2 migration.");
  }
  if (indexes.length !== 10) throw new Error("V2.2.2 production query indexes are incomplete.");
  process.stdout.write("V2.2.1 -> V2.2.2 PostgreSQL migration test passed (retained data, NFKC backfill, 10 query indexes).\n");
} finally {
  await testClient?.$disconnect().catch(() => undefined);
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
  await admin.$disconnect().catch(() => undefined);
  if (tempRoot) await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
}
