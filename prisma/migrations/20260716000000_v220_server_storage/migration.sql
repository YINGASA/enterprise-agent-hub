-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('default', 'user_upload', 'user_paste');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "StorageMigrationStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'conflict');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "session_token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "title_source" VARCHAR(16) NOT NULL DEFAULT 'auto',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "conversation_summary" JSONB,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("workspace_id", "id")
);

-- CreateTable
CREATE TABLE "messages" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "id" VARCHAR(128) NOT NULL,
    "conversation_id" VARCHAR(128) NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_id" VARCHAR(128),
    "response_mode" VARCHAR(64),
    "intent" VARCHAR(64),
    "scenario" VARCHAR(64),
    "assistant_details" JSONB,
    "message_order" INTEGER NOT NULL,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("workspace_id", "id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "content" TEXT NOT NULL,
    "source_type" "KnowledgeSourceType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "checksum" VARCHAR(128) NOT NULL,
    "category" VARCHAR(160),
    "summary" TEXT,
    "pack_id" VARCHAR(128),
    "original_file_name" VARCHAR(260),
    "imported_at" TIMESTAMPTZ(3),
    "suggested_questions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("workspace_id", "id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "id" VARCHAR(128) NOT NULL,
    "document_id" VARCHAR(128) NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("workspace_id", "id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "id" VARCHAR(128) NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    "document_id" VARCHAR(128),
    "error_code" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("workspace_id", "id")
);

-- CreateTable
CREATE TABLE "storage_migrations" (
    "workspace_id" VARCHAR(64) NOT NULL,
    "migration_id" VARCHAR(128) NOT NULL,
    "status" "StorageMigrationStatus" NOT NULL DEFAULT 'pending',
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "conflicted_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "storage_migrations_pkey" PRIMARY KEY ("workspace_id", "migration_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_session_token_hash_key" ON "workspaces"("session_token_hash");
CREATE INDEX "conversations_workspace_id_updated_at_idx" ON "conversations"("workspace_id", "updated_at");
CREATE UNIQUE INDEX "messages_workspace_id_conversation_id_message_order_key" ON "messages"("workspace_id", "conversation_id", "message_order");
CREATE INDEX "messages_workspace_id_conversation_id_created_at_idx" ON "messages"("workspace_id", "conversation_id", "created_at");
CREATE INDEX "knowledge_documents_workspace_id_enabled_updated_at_idx" ON "knowledge_documents"("workspace_id", "enabled", "updated_at");
CREATE INDEX "knowledge_documents_workspace_id_checksum_idx" ON "knowledge_documents"("workspace_id", "checksum");
CREATE UNIQUE INDEX "knowledge_chunks_workspace_id_document_id_chunk_index_key" ON "knowledge_chunks"("workspace_id", "document_id", "chunk_index");
CREATE INDEX "knowledge_chunks_workspace_id_document_id_idx" ON "knowledge_chunks"("workspace_id", "document_id");
CREATE INDEX "import_jobs_workspace_id_created_at_idx" ON "import_jobs"("workspace_id", "created_at");
CREATE INDEX "storage_migrations_workspace_id_created_at_idx" ON "storage_migrations"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_conversation_id_fkey" FOREIGN KEY ("workspace_id", "conversation_id") REFERENCES "conversations"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_workspace_id_document_id_fkey" FOREIGN KEY ("workspace_id", "document_id") REFERENCES "knowledge_documents"("workspace_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "storage_migrations" ADD CONSTRAINT "storage_migrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
