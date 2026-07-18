-- V2.2.1 adds workspace-scoped enterprise knowledge packs and recoverable
-- batch-import jobs without changing or deleting V2.2.0 knowledge data.

ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'preview_ready' BEFORE 'completed';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'processing' BEFORE 'completed';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'partial_failed' BEFORE 'failed';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'cancelled';

CREATE TYPE "KnowledgePackStatus" AS ENUM ('active', 'archived');
CREATE TYPE "ImportItemStatus" AS ENUM (
  'preview_ready',
  'ready',
  'processing',
  'completed',
  'failed',
  'skipped',
  'conflicted',
  'cancelled'
);

CREATE TABLE "knowledge_packs" (
  "workspace_id" VARCHAR(64) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "normalized_name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000),
  "status" "KnowledgePackStatus" NOT NULL DEFAULT 'active',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "knowledge_packs_pkey" PRIMARY KEY ("workspace_id", "id")
);

ALTER TABLE "knowledge_documents"
  ADD COLUMN "content_checksum" VARCHAR(64),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "knowledge_pack_id" VARCHAR(128),
  ADD COLUMN "mime_type" VARCHAR(160),
  ADD COLUMN "size_bytes" INTEGER,
  ADD COLUMN "import_job_id" VARCHAR(128);

ALTER TABLE "import_jobs"
  ADD COLUMN "knowledge_pack_id" VARCHAR(128),
  ADD COLUMN "idempotency_key" VARCHAR(128),
  ADD COLUMN "total_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completed_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failed_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skipped_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "conflicted_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "duration_ms" INTEGER;

UPDATE "import_jobs"
SET
  "total_items" = 1,
  "completed_items" = CASE WHEN "status" = 'completed' THEN 1 ELSE 0 END,
  "failed_items" = CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END,
  "completed_at" = CASE WHEN "status" IN ('completed', 'failed') THEN "updated_at" ELSE NULL END;

CREATE TABLE "import_items" (
  "workspace_id" VARCHAR(64) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "import_job_id" VARCHAR(128) NOT NULL,
  "item_index" INTEGER NOT NULL,
  "original_file_name" VARCHAR(260) NOT NULL,
  "normalized_title" VARCHAR(240) NOT NULL,
  "mime_type" VARCHAR(160) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "status" "ImportItemStatus" NOT NULL DEFAULT 'preview_ready',
  "conflict_type" VARCHAR(64),
  "conflict_document_id" VARCHAR(128),
  "conflict_document_revision" INTEGER,
  "conflict_resolution" VARCHAR(32),
  "extracted_text" TEXT,
  "preview_metadata" JSONB NOT NULL DEFAULT '{}',
  "chunk_preview" JSONB NOT NULL DEFAULT '[]',
  "document_id" VARCHAR(128),
  "error_code" VARCHAR(64),
  "error_message_safe" VARCHAR(400),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "claim_token" VARCHAR(128),
  "claimed_at" TIMESTAMPTZ(3),
  "lease_expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "import_items_pkey" PRIMARY KEY ("workspace_id", "id")
);

CREATE UNIQUE INDEX "knowledge_packs_workspace_id_normalized_name_key"
  ON "knowledge_packs"("workspace_id", "normalized_name");
CREATE INDEX "knowledge_packs_workspace_id_updated_at_idx"
  ON "knowledge_packs"("workspace_id", "updated_at");
CREATE INDEX "knowledge_documents_workspace_id_content_checksum_idx"
  ON "knowledge_documents"("workspace_id", "content_checksum");
CREATE INDEX "knowledge_documents_workspace_id_knowledge_pack_id_idx"
  ON "knowledge_documents"("workspace_id", "knowledge_pack_id");
CREATE INDEX "knowledge_documents_workspace_id_import_job_id_idx"
  ON "knowledge_documents"("workspace_id", "import_job_id");
CREATE UNIQUE INDEX "import_jobs_workspace_id_idempotency_key_key"
  ON "import_jobs"("workspace_id", "idempotency_key");
CREATE INDEX "import_jobs_workspace_id_status_updated_at_idx"
  ON "import_jobs"("workspace_id", "status", "updated_at");
CREATE UNIQUE INDEX "import_items_workspace_id_import_job_id_item_index_key"
  ON "import_items"("workspace_id", "import_job_id", "item_index");
CREATE INDEX "import_items_workspace_id_import_job_id_status_idx"
  ON "import_items"("workspace_id", "import_job_id", "status");
CREATE INDEX "import_items_workspace_id_checksum_idx"
  ON "import_items"("workspace_id", "checksum");
CREATE INDEX "import_items_workspace_id_conflict_document_id_idx"
  ON "import_items"("workspace_id", "conflict_document_id");
CREATE INDEX "import_items_workspace_id_document_id_idx"
  ON "import_items"("workspace_id", "document_id");

ALTER TABLE "knowledge_packs"
  ADD CONSTRAINT "knowledge_packs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_workspace_id_knowledge_pack_id_fkey"
  FOREIGN KEY ("workspace_id", "knowledge_pack_id")
  REFERENCES "knowledge_packs"("workspace_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_jobs"
  ADD CONSTRAINT "import_jobs_workspace_id_knowledge_pack_id_fkey"
  FOREIGN KEY ("workspace_id", "knowledge_pack_id")
  REFERENCES "knowledge_packs"("workspace_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "import_items"
  ADD CONSTRAINT "import_items_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "import_items"
  ADD CONSTRAINT "import_items_workspace_id_import_job_id_fkey"
  FOREIGN KEY ("workspace_id", "import_job_id")
  REFERENCES "import_jobs"("workspace_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;
