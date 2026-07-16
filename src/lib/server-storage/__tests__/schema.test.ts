import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("PostgreSQL server storage schema", () => {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const migration = readFileSync(join(process.cwd(), "prisma", "migrations", "20260716000000_v220_server_storage", "migration.sql"), "utf8");

  it("defines the required workspace-scoped models", () => {
    for (const model of ["Workspace", "Conversation", "Message", "KnowledgeDocument", "KnowledgeChunk", "ImportJob", "StorageMigration"]) {
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
    expect(migration).toContain("FOREIGN KEY (\"workspace_id\", \"conversation_id\") REFERENCES \"conversations\"(\"workspace_id\", \"id\") ON DELETE CASCADE");
    expect(migration).toContain("FOREIGN KEY (\"workspace_id\", \"document_id\") REFERENCES \"knowledge_documents\"(\"workspace_id\", \"id\") ON DELETE CASCADE");
  });
});
