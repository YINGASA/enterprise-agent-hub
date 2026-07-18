import { createHash, randomUUID } from "node:crypto";
import { ImportJobStatus, KnowledgeSourceType, Prisma, type KnowledgeDocument as KnowledgeDocumentRecord, type KnowledgeChunk as KnowledgeChunkRecord } from "@prisma/client";
import { splitDocument } from "@/lib/rag";
import { sanitizeSafeMetadata } from "@/lib/knowledge/safe-metadata";
import { sanitizeImportedKnowledgeDocument } from "@/lib/knowledge/storage";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import { KnowledgeRepositoryError, sanitizeKnowledgeDocumentUpdate, type KnowledgeDocumentUpdate, type KnowledgeRepository } from "@/lib/storage/knowledgeRepository";
import type { ImportedKnowledgeDocument, KnowledgeChunk } from "@/types";

type Metadata = Record<string, unknown> & { source?: string; owner?: string };

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function metadata(value: Prisma.JsonValue): Metadata {
  return sanitizeSafeMetadata(value) ?? {};
}

export function createKnowledgeContentChecksum(content: string) {
  const normalized = content.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function createKnowledgeChecksum(document: ImportedKnowledgeDocument) {
  const normalized = JSON.stringify({
    title: document.title.normalize("NFKC").trim(),
    content: document.content.normalize("NFKC").replace(/\r\n/g, "\n").trim(),
    category: document.category.normalize("NFKC").trim(),
    tags: (document.tags ?? []).map((tag) => tag.normalize("NFKC").trim()),
    summary: document.summary?.normalize("NFKC").trim() ?? null,
    sourceType: document.sourceType,
    enabled: document.enabled !== false,
    packId: document.packId?.normalize("NFKC").trim() ?? null,
    knowledgePackId: document.knowledgePackId?.normalize("NFKC").trim() ?? null,
    originalFileName: document.originalFileName?.normalize("NFKC").trim() ?? null,
    mimeType: document.mimeType?.normalize("NFKC").trim().toLowerCase() ?? null,
    sizeBytes: document.sizeBytes ?? null,
    importJobId: document.importJobId ?? null,
    metadata: sanitizeSafeMetadata(document.metadata) ?? {},
    suggestedQuestions: (document.suggestedQuestions ?? []).map((question) => question.normalize("NFKC").trim()),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    importedAt: document.importedAt ?? null,
    source: document.source?.normalize("NFKC").trim() ?? null,
    owner: document.owner?.normalize("NFKC").trim() ?? null,
    isDefault: document.isDefault,
  });
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function toDocument(record: KnowledgeDocumentRecord): ImportedKnowledgeDocument {
  const extra = metadata(record.metadata);
  return {
    id: record.id,
    packId: record.packId ?? undefined,
    knowledgePackId: record.knowledgePackId ?? undefined,
    title: record.title,
    category: record.category ?? "用户导入",
    tags: stringArray(record.tags),
    summary: record.summary ?? undefined,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    source: extra.source,
    owner: extra.owner,
    isDefault: false,
    sourceType: record.sourceType === KnowledgeSourceType.USER_UPLOAD ? "user_upload" : "user_paste",
    originalFileName: record.originalFileName ?? undefined,
    mimeType: record.mimeType ?? undefined,
    sizeBytes: record.sizeBytes ?? undefined,
    importJobId: record.importJobId ?? undefined,
    revision: record.revision,
    metadata: extra,
    importedAt: record.importedAt?.toISOString() ?? record.createdAt.toISOString(),
    enabled: record.enabled,
    suggestedQuestions: stringArray(record.suggestedQuestions),
  };
}

export function knowledgeDocumentCreateData(workspaceId: string, document: ImportedKnowledgeDocument) {
  return {
    id: document.id,
    workspaceId,
    title: document.title,
    content: document.content,
    sourceType: document.sourceType === "user_upload" ? KnowledgeSourceType.USER_UPLOAD : KnowledgeSourceType.USER_PASTE,
    enabled: document.enabled !== false,
    tags: (document.tags ?? []) as Prisma.InputJsonValue,
    metadata: {
      ...(sanitizeSafeMetadata(document.metadata) ?? {}),
      source: document.source ?? null,
      owner: document.owner ?? null,
    } as Prisma.InputJsonValue,
    checksum: createKnowledgeChecksum(document),
    contentChecksum: createKnowledgeContentChecksum(document.content),
    revision: document.revision ?? 0,
    category: document.category,
    summary: document.summary,
    packId: document.packId,
    knowledgePackId: document.knowledgePackId,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    importJobId: document.importJobId,
    importedAt: new Date(document.importedAt),
    suggestedQuestions: (document.suggestedQuestions ?? []) as Prisma.InputJsonValue,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

export function knowledgeChunkCreateData(workspaceId: string, document: ImportedKnowledgeDocument) {
  return splitDocument(document).map((chunk) => ({
    id: `knowledge-chunk-${createHash("sha256").update(JSON.stringify([document.id, chunk.chunkIndex]), "utf8").digest("hex")}`,
    workspaceId,
    documentId: document.id,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    keywords: chunk.keywords as Prisma.InputJsonValue,
    createdAt: new Date(document.updatedAt),
  }));
}

function toChunk(record: KnowledgeChunkRecord, document: ImportedKnowledgeDocument): KnowledgeChunk {
  return {
    id: record.id,
    documentId: record.documentId,
    packId: document.packId,
    knowledgePackId: document.knowledgePackId,
    sourceTitle: document.title,
    category: document.category,
    tags: document.tags,
    sourceType: document.sourceType,
    originalFileName: document.originalFileName,
    chunkIndex: record.chunkIndex,
    content: record.content,
    keywords: stringArray(record.keywords),
  };
}

function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new KnowledgeRepositoryError("知识文档 ID 已存在。", 409, "knowledge_document_conflict");
    if (error.code === "P2034") throw new KnowledgeRepositoryError("知识文档已发生并发更改，请重试。", 409, "knowledge_document_write_conflict");
    if (error.code === "P2025") throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    if (error.code === "P2003") throw new KnowledgeRepositoryError("关联的企业知识包不存在或不属于当前工作区。", 409, "knowledge_pack_not_found");
  }
  if (error instanceof KnowledgeRepositoryError) throw error;
  throw new KnowledgeRepositoryError("服务端知识存储暂不可用。", 503, "server_storage_unavailable");
}

export class PrismaKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly workspaceId: string, private readonly prisma = getPrismaClient()) {}

  async list() {
    const records = await this.prisma.knowledgeDocument.findMany({ where: { workspaceId: this.workspaceId }, orderBy: { updatedAt: "desc" } });
    return records.map(toDocument);
  }

  async get(id: string) {
    const record = await this.prisma.knowledgeDocument.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
    return record ? toDocument(record) : null;
  }

  async create(input: ImportedKnowledgeDocument) {
    const document = sanitizeImportedKnowledgeDocument(input);
    if (!document) throw new KnowledgeRepositoryError("知识文档不符合存储规则。", 400, "invalid_knowledge_document");
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const documentCount = await tx.knowledgeDocument.count({ where: { workspaceId: this.workspaceId } });
        if (documentCount >= agentRequestLimits.userDocuments) {
          throw new KnowledgeRepositoryError(`知识文档最多保存 ${agentRequestLimits.userDocuments} 篇。`, 409, "knowledge_document_capacity");
        }
        const created = await tx.knowledgeDocument.create({ data: knowledgeDocumentCreateData(this.workspaceId, document) });
        const chunks = knowledgeChunkCreateData(this.workspaceId, document);
        if (chunks.length) await tx.knowledgeChunk.createMany({ data: chunks });
        await tx.importJob.create({
          data: {
            id: `import-${randomUUID()}`, workspaceId: this.workspaceId, status: ImportJobStatus.COMPLETED,
            documentId: document.id, totalItems: 1, completedItems: 1, completedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
          },
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toDocument(record);
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async update(id: string, update: KnowledgeDocumentUpdate) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentRecord = await tx.knowledgeDocument.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
        if (!currentRecord) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
        const current = toDocument(currentRecord);
        const safeUpdate = sanitizeKnowledgeDocumentUpdate(update);
        if (!safeUpdate) throw new KnowledgeRepositoryError("知识文档更新不符合规则。", 400, "invalid_knowledge_update");
        const document = sanitizeImportedKnowledgeDocument({ ...current, ...safeUpdate, id, updatedAt: new Date().toISOString() });
        if (!document) throw new KnowledgeRepositoryError("知识文档不符合存储规则。", 400, "invalid_knowledge_document");
        const createData = knowledgeDocumentCreateData(this.workspaceId, document);
        const data: Prisma.KnowledgeDocumentUncheckedUpdateInput = {
          checksum: createData.checksum,
          contentChecksum: createData.contentChecksum,
          revision: { increment: 1 },
          updatedAt: createData.updatedAt,
        };
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "title")) data.title = createData.title;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "content")) data.content = createData.content;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "enabled")) data.enabled = createData.enabled;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "tags")) data.tags = createData.tags;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "category")) data.category = createData.category;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "summary")) data.summary = createData.summary ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "packId")) data.packId = createData.packId ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "knowledgePackId")) data.knowledgePackId = createData.knowledgePackId ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "originalFileName")) data.originalFileName = createData.originalFileName ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "mimeType")) data.mimeType = createData.mimeType ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "sizeBytes")) data.sizeBytes = createData.sizeBytes ?? null;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "suggestedQuestions")) data.suggestedQuestions = createData.suggestedQuestions;
        if (Object.prototype.hasOwnProperty.call(safeUpdate, "metadata")) data.metadata = createData.metadata;
        const updated = await tx.knowledgeDocument.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          data,
        });
        const rebuildChunks = ["title", "content", "tags", "category", "summary", "packId", "knowledgePackId", "originalFileName"]
          .some((field) => Object.prototype.hasOwnProperty.call(safeUpdate, field));
        if (rebuildChunks) {
          await tx.knowledgeChunk.deleteMany({ where: { workspaceId: this.workspaceId, documentId: id } });
          const chunks = knowledgeChunkCreateData(this.workspaceId, document);
          if (chunks.length) await tx.knowledgeChunk.createMany({ data: chunks });
        }
        return toDocument(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.knowledgeDocument.delete({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
    } catch (error) {
      return translatePrismaError(error);
    }
  }

  async listChunks(id: string) {
    const record = await this.prisma.knowledgeDocument.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
    if (!record) throw new KnowledgeRepositoryError("知识文档不存在。", 404, "knowledge_document_not_found");
    const document = toDocument(record);
    const chunks = await this.prisma.knowledgeChunk.findMany({ where: { workspaceId: this.workspaceId, documentId: id }, orderBy: { chunkIndex: "asc" } });
    return chunks.map((chunk) => toChunk(chunk, document));
  }

  async listEnabledWithChunks() {
    const records = await this.prisma.knowledgeDocument.findMany({
      where: { workspaceId: this.workspaceId, enabled: true },
      include: { chunks: { orderBy: { chunkIndex: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    const documents = records.map(toDocument);
    const chunks = records.flatMap((record, index) => record.chunks.map((chunk) => toChunk(chunk, documents[index]!)));
    return { documents, chunks };
  }

  async replaceAll(input: ImportedKnowledgeDocument[]) {
    if (!Array.isArray(input) || input.length > agentRequestLimits.userDocuments) {
      throw new KnowledgeRepositoryError(`知识文档最多保存 ${agentRequestLimits.userDocuments} 篇。`, 400, "invalid_knowledge_document");
    }
    const documents = input.map((value) => sanitizeImportedKnowledgeDocument(value));
    if (documents.some((document) => !document)) {
      throw new KnowledgeRepositoryError("知识库备份包含无效文档。", 400, "invalid_knowledge_document");
    }
    const safeDocuments = documents as ImportedKnowledgeDocument[];
    if (new Set(safeDocuments.map((document) => document.id)).size !== safeDocuments.length) {
      throw new KnowledgeRepositoryError("知识库备份包含重复文档标识。", 400, "invalid_knowledge_document");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.knowledgeDocument.deleteMany({ where: { workspaceId: this.workspaceId } });
        const records: KnowledgeDocumentRecord[] = [];
        for (const document of safeDocuments) {
          const record = await tx.knowledgeDocument.create({ data: knowledgeDocumentCreateData(this.workspaceId, document) });
          const chunks = knowledgeChunkCreateData(this.workspaceId, document);
          if (chunks.length) await tx.knowledgeChunk.createMany({ data: chunks });
          await tx.importJob.create({
            data: {
              id: `restore-${randomUUID()}`, workspaceId: this.workspaceId, status: ImportJobStatus.COMPLETED,
              documentId: document.id, totalItems: 1, completedItems: 1, completedAt: new Date(),
            },
          });
          records.push(record);
        }
        return records.map(toDocument);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      return translatePrismaError(error);
    }
  }
}
