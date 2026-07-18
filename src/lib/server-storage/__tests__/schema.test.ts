import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readTextFixture(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8").replace(/\r\n?/g, "\n");
}

describe("PostgreSQL server storage schema", () => {
  const schema = readTextFixture("prisma", "schema.prisma");
  const v220Migration = readTextFixture("prisma", "migrations", "20260716000000_v220_server_storage", "migration.sql");
  const v221Migration = readTextFixture("prisma", "migrations", "20260717000000_v221_knowledge_pack_import", "migration.sql");

  it("defines the required workspace-scoped models", () => {
    for (const model of [
      "Workspace",
      "Conversation",
      "Message",
      "KnowledgeDocument",
      "KnowledgeChunk",
      "KnowledgePack",
      "ImportJob",
      "ImportItem",
      "StorageMigration",
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
    expect(schema).toContain("provider = \"postgresql\"");
    expect(schema).toMatch(/revision\s+Int\s+@default\(0\)/);
  });

  it("uses compound workspace relations for messages and chunks", () => {
    expect(schema).toContain("@@unique([workspaceId, conversationId, messageOrder])");
    expect(schema).toContain("@relation(fields: [workspaceId, conversationId], references: [workspaceId, id], onDelete: Cascade)");
    expect(schema).toContain("@@unique([workspaceId, documentId, chunkIndex])");
    expect(schema).toContain("@relation(fields: [workspaceId, documentId], references: [workspaceId, id], onDelete: Cascade)");
  });

  it("ships equivalent composite foreign keys in the SQL migration", () => {
    expect(v220Migration).toContain("FOREIGN KEY (\"workspace_id\", \"conversation_id\") REFERENCES \"conversations\"(\"workspace_id\", \"id\") ON DELETE CASCADE");
    expect(v220Migration).toContain("FOREIGN KEY (\"workspace_id\", \"document_id\") REFERENCES \"knowledge_documents\"(\"workspace_id\", \"id\") ON DELETE CASCADE");
  });

  it("models knowledge packs and import items with workspace-scoped relations", () => {
    expect(schema).toContain("@@unique([workspaceId, normalizedName])");
    expect(schema).toContain("@relation(fields: [workspaceId, knowledgePackId], references: [workspaceId, id], onDelete: Restrict)");
    expect(schema).toContain("@@unique([workspaceId, importJobId, itemIndex])");
    expect(schema).toContain("@relation(fields: [workspaceId, importJobId], references: [workspaceId, id], onDelete: Cascade)");
    expect(schema).toMatch(/model KnowledgePack \{[\s\S]*?revision\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/model ImportJob \{[\s\S]*?revision\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(/model ImportItem \{[\s\S]*?revision\s+Int\s+@default\(0\)/);
    expect(v221Migration.match(/"updated_at" TIMESTAMPTZ\(3\) NOT NULL,/g)).toHaveLength(2);
    expect(v221Migration).not.toContain('"updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT');
  });

  it("upgrades the V2.2.0 tables without destructive knowledge-data operations", () => {
    expect(v220Migration).toContain('CREATE TABLE "knowledge_documents"');
    expect(v220Migration).toContain('CREATE TABLE "knowledge_chunks"');
    expect(v220Migration).toContain('CREATE TABLE "import_jobs"');
    expect(v221Migration).not.toContain('CREATE TABLE "knowledge_documents"');
    expect(v221Migration).not.toContain('CREATE TABLE "knowledge_chunks"');
    expect(v221Migration).not.toContain('CREATE TABLE "import_jobs"');
    expect(v221Migration).toContain('ALTER TABLE "knowledge_documents"');
    expect(v221Migration).toContain('ADD COLUMN "content_checksum" VARCHAR(64)');
    expect(v221Migration).toContain('ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0');
    expect(v221Migration).toContain('ALTER TABLE "import_jobs"');
    expect(v221Migration).toContain('UPDATE "import_jobs"');
    expect(v221Migration).toContain('"total_items" = 1');
    expect(v221Migration).toContain('"completed_items" = CASE WHEN "status" = \'completed\' THEN 1 ELSE 0 END');
    expect(v221Migration).toContain('"failed_items" = CASE WHEN "status" = \'failed\' THEN 1 ELSE 0 END');
    expect(v221Migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
    expect(v221Migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(v221Migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("preserves explicit pack deletion semantics and cascades import items only with their owning job", () => {
    expect(v221Migration).toContain(
      'FOREIGN KEY ("workspace_id", "knowledge_pack_id")\n  REFERENCES "knowledge_packs"("workspace_id", "id")\n  ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(v221Migration).toContain(
      'FOREIGN KEY ("workspace_id", "import_job_id")\n  REFERENCES "import_jobs"("workspace_id", "id")\n  ON DELETE CASCADE ON UPDATE CASCADE',
    );
    expect(v221Migration).not.toMatch(/knowledge_documents_workspace_id_knowledge_pack_id_fkey[\s\S]{0,240}ON DELETE CASCADE/);
    expect(v221Migration).not.toMatch(/import_jobs_workspace_id_knowledge_pack_id_fkey[\s\S]{0,240}ON DELETE CASCADE/);
  });

  it("keeps legacy import-job states while adding recoverable batch states", () => {
    for (const status of ["pending", "running", "preview_ready", "processing", "completed", "partial_failed", "failed", "cancelled"]) {
      expect(schema).toContain(`@map("${status}")`);
    }
    for (const status of ["preview_ready", "processing", "partial_failed", "cancelled"]) {
      expect(v221Migration).toContain(`ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS '${status}'`);
    }
    expect(v221Migration).toContain("'preview_ready' BEFORE 'completed'");
    expect(v221Migration).toContain("'processing' BEFORE 'completed'");
    expect(v221Migration).toContain("'partial_failed' BEFORE 'failed'");
  });
});
