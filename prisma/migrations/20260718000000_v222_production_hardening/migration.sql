-- V2.2.2 hardens workspace-scoped query paths without deleting business data.
-- Normalized columns remain nullable so legacy rows can be handled safely if a
-- future PostgreSQL normalization rule differs from the application runtime.

ALTER TABLE "knowledge_documents"
  ADD COLUMN "normalized_title" VARCHAR(240),
  ADD COLUMN "normalized_file_name" VARCHAR(260);

UPDATE "knowledge_documents"
SET
  "normalized_title" = LOWER(
    REGEXP_REPLACE(NORMALIZE("title", NFKC), '[^[:alnum:]]+', '', 'g')
  ),
  "normalized_file_name" = CASE
    WHEN "original_file_name" IS NULL THEN NULL
    ELSE LOWER(BTRIM(REGEXP_REPLACE(NORMALIZE("original_file_name", NFKC), '[[:space:]]+', ' ', 'g')))
  END;

DROP INDEX "conversations_workspace_id_updated_at_idx";
CREATE INDEX "conversations_active_updated_idx"
  ON "conversations"("workspace_id", "deleted_at", "updated_at", "id");

CREATE INDEX "messages_run_id_lookup_idx"
  ON "messages"("workspace_id", "conversation_id", "role", "run_id");

CREATE INDEX "knowledge_documents_normalized_title_idx"
  ON "knowledge_documents"("workspace_id", "normalized_title");
CREATE INDEX "knowledge_documents_normalized_file_name_idx"
  ON "knowledge_documents"("workspace_id", "normalized_file_name");

DROP INDEX "import_jobs_workspace_id_status_updated_at_idx";
CREATE INDEX "import_jobs_status_updated_idx"
  ON "import_jobs"("workspace_id", "status", "updated_at", "id");

DROP INDEX "import_items_workspace_id_import_job_id_status_idx";
CREATE INDEX "import_items_job_status_order_idx"
  ON "import_items"("workspace_id", "import_job_id", "status", "item_index");
CREATE INDEX "import_items_claim_queue_idx"
  ON "import_items"("workspace_id", "import_job_id", "status", "lease_expires_at", "item_index");
CREATE INDEX "import_items_workspace_status_idx"
  ON "import_items"("workspace_id", "status");
CREATE INDEX "import_items_workspace_error_idx"
  ON "import_items"("workspace_id", "error_code");
CREATE INDEX "import_items_workspace_conflict_idx"
  ON "import_items"("workspace_id", "conflict_type");
