import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  ImportItemStatus,
  ImportJobStatus,
  KnowledgePackStatus,
  Prisma,
  type ImportItem,
  type ImportJob,
} from "@prisma/client";
import { parseKnowledgeFile } from "@/lib/knowledge/file-parser";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";
import { sanitizeSafeMetadata } from "@/lib/knowledge/safe-metadata";
import { agentRequestLimits } from "@/lib/ops/securityLimits";
import { getPrismaClient } from "@/lib/server-storage/prisma";
import {
  createKnowledgeContentChecksum,
  knowledgeChunkCreateData,
  knowledgeDocumentCreateData,
} from "@/lib/server-storage/knowledgeRepository";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";
import type {
  ImportedKnowledgeDocument,
  KnowledgeConflictResolution,
  KnowledgeDuplicateType,
  KnowledgeImportItem as PublicImportItem,
  KnowledgeImportJob as PublicImportJob,
  KnowledgeImportJobItemConfirmation,
  KnowledgeImportPreviewMetadata,
  KnowledgeImportQualityLevel,
} from "@/types";

export const knowledgeImportJobLimits = {
  idempotencyKeyCharacters: 128,
  leaseMilliseconds: 30_000,
  maximumActiveJobsPerWorkspace: 20,
  maximumStoredExtractedItemsPerWorkspace: 50,
  previewRetentionMilliseconds: 24 * 60 * 60 * 1_000,
  safeErrorCharacters: 400,
} as const;

const maximumDatabaseRevision = 2_147_483_646;
const maximumDatabaseDurationMilliseconds = 2_147_483_647;
const retryableImportErrorCodes = ["knowledge_import_item_failed"] as const;
const recoverableImportJobStatuses = [
  ImportJobStatus.PREVIEW_READY,
  ImportJobStatus.PENDING,
  ImportJobStatus.RUNNING,
  ImportJobStatus.PROCESSING,
  ImportJobStatus.PARTIAL_FAILED,
  ImportJobStatus.FAILED,
] as const;

export type KnowledgeUploadFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

type JobWithItems = ImportJob & { items: ImportItem[] };

type StoredPreviewMetadata = KnowledgeImportPreviewMetadata & {
  extractedCharacterCount: number;
  estimatedChunkCount: number;
  qualityLevel: KnowledgeImportQualityLevel;
  qualityLabel: PublicImportItem["qualityLabel"];
  warnings: string[];
};

function normalizeTitle(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").trim();
}

function comparableBigrams(value: string) {
  const normalized = normalizeTitle(value);
  if (normalized.length < 2) return new Set(normalized ? [normalized] : []);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
  return result;
}

function titleSimilarity(left: string, right: string) {
  const leftBigrams = comparableBigrams(left);
  const rightBigrams = comparableBigrams(right);
  if (!leftBigrams.size || !rightBigrams.size) return 0;
  let overlap = 0;
  for (const value of leftBigrams) if (rightBigrams.has(value)) overlap += 1;
  return overlap / (leftBigrams.size + rightBigrams.size - overlap);
}

function normalizedFileName(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function safeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

const duplicateTypes = ["none", "exact_content", "same_title", "same_file_name", "possible_duplicate"] as const;
const qualityLevels = ["excellent", "usable", "needs_attention", "blocked"] as const;
const resolutions = ["skip", "replace", "import_as_new"] as const;

function jobStatus(status: ImportJobStatus): PublicImportJob["status"] {
  if (status === ImportJobStatus.PREVIEW_READY) return "preview_ready";
  if (status === ImportJobStatus.COMPLETED) return "completed";
  if (status === ImportJobStatus.PARTIAL_FAILED) return "partial_failed";
  if (status === ImportJobStatus.FAILED) return "failed";
  if (status === ImportJobStatus.CANCELLED) return "cancelled";
  if (status === ImportJobStatus.PROCESSING || status === ImportJobStatus.RUNNING) return "processing";
  return "pending";
}

function itemStatus(status: ImportItemStatus): PublicImportItem["status"] {
  return status.toLowerCase() as PublicImportItem["status"];
}

function readStoredMetadata(value: unknown): StoredPreviewMetadata {
  const safe = sanitizeSafeMetadata(value) ?? {};
  const title = typeof safe.title === "string" ? safe.title : "未命名文档";
  const tags = Array.isArray(safe.tags) ? safe.tags.filter((item): item is string => typeof item === "string") : [];
  const suggestedQuestions = Array.isArray(safe.suggestedQuestions)
    ? safe.suggestedQuestions.filter((item): item is string => typeof item === "string")
    : [];
  const warnings = Array.isArray(safe.warnings) ? safe.warnings.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  const nestedMetadata = sanitizeSafeMetadata(safe.metadata) ?? {};
  return {
    title,
    category: typeof safe.category === "string" ? safe.category : "用户导入",
    tags,
    sourceType: safe.sourceType === "user_paste" ? "user_paste" : "user_upload",
    enabled: safe.enabled !== false,
    suggestedQuestions,
    knowledgePackId: safe.knowledgePackId === null
      ? null
      : typeof safe.knowledgePackId === "string" ? safe.knowledgePackId : undefined,
    metadata: nestedMetadata,
    extractedCharacterCount: typeof safe.extractedCharacterCount === "number" ? safe.extractedCharacterCount : 0,
    estimatedChunkCount: typeof safe.estimatedChunkCount === "number" ? safe.estimatedChunkCount : 0,
    qualityLevel: safeEnum(safe.qualityLevel, qualityLevels, "needs_attention"),
    qualityLabel: safe.qualityLabel === "优秀" || safe.qualityLabel === "可用" || safe.qualityLabel === "需处理" || safe.qualityLabel === "无法导入"
      ? safe.qualityLabel
      : "需处理",
    warnings,
  };
}

function publicItem(record: ImportItem): PublicImportItem {
  const metadata = readStoredMetadata(record.previewMetadata);
  const chunkPreview = Array.isArray(record.chunkPreview) ? record.chunkPreview : [];
  return {
    id: record.id,
    importJobId: record.importJobId,
    itemIndex: record.itemIndex,
    originalFileName: record.originalFileName,
    normalizedTitle: record.normalizedTitle,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    status: itemStatus(record.status),
    duplicateType: safeEnum(record.conflictType, duplicateTypes, "none"),
    conflictDocumentId: record.conflictDocumentId ?? undefined,
    conflictResolution: typeof record.conflictResolution === "string" && resolutions.includes(record.conflictResolution as KnowledgeConflictResolution)
      ? record.conflictResolution as KnowledgeConflictResolution
      : undefined,
    extractedCharacterCount: metadata.extractedCharacterCount,
    estimatedChunkCount: metadata.estimatedChunkCount,
    checksumStatus: "computed",
    qualityLevel: metadata.qualityLevel,
    qualityLabel: metadata.qualityLabel,
    warnings: metadata.warnings,
    metadata: {
      title: metadata.title,
      category: metadata.category,
      tags: metadata.tags,
      sourceType: metadata.sourceType,
      enabled: metadata.enabled,
      suggestedQuestions: metadata.suggestedQuestions,
      knowledgePackId: metadata.knowledgePackId,
      metadata: metadata.metadata,
    },
    chunkPreview: chunkPreview as PublicImportItem["chunkPreview"],
    documentId: record.documentId ?? undefined,
    errorCode: record.errorCode ?? undefined,
    errorMessageSafe: record.errorMessageSafe ?? undefined,
    retryable: record.status === ImportItemStatus.FAILED
      && record.extractedText !== null
      && retryableImportErrorCodes.includes(record.errorCode as (typeof retryableImportErrorCodes)[number]),
    retryCount: record.retryCount,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toPublicImportJob(record: JobWithItems): PublicImportJob {
  return {
    id: record.id,
    knowledgePackId: record.knowledgePackId ?? undefined,
    status: jobStatus(record.status),
    totalItems: record.totalItems,
    completedItems: record.completedItems,
    failedItems: record.failedItems,
    skippedItems: record.skippedItems,
    conflictedItems: record.conflictedItems,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString(),
    items: [...record.items].sort((left, right) => left.itemIndex - right.itemIndex).map(publicItem),
  };
}

function validIdentifier(value: unknown, maximum = 128): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function stringList(value: unknown, maximumItems: number, maximumCharacters: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximumItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.length > maximumCharacters) return null;
    result.push(item.trim());
  }
  return result;
}

export function sanitizeImportPreviewMetadata(value: unknown): KnowledgeImportPreviewMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["title", "category", "tags", "sourceType", "enabled", "suggestedQuestions", "knowledgePackId", "metadata"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > agentRequestLimits.documentTitleChars) return null;
  if (typeof input.category !== "string" || !input.category.trim() || input.category.length > agentRequestLimits.documentCategoryChars) return null;
  if ((input.sourceType !== "user_upload" && input.sourceType !== "user_paste") || typeof input.enabled !== "boolean") return null;
  const tags = stringList(input.tags, agentRequestLimits.documentTags, agentRequestLimits.documentTagChars);
  const suggestedQuestions = stringList(input.suggestedQuestions, agentRequestLimits.documentSuggestedQuestions, agentRequestLimits.documentSuggestedQuestionChars);
  const metadata = sanitizeSafeMetadata(input.metadata);
  if (!tags || !suggestedQuestions || !metadata) return null;
  if (input.knowledgePackId !== undefined && input.knowledgePackId !== null && !validIdentifier(input.knowledgePackId)) return null;
  return {
    title: input.title.trim(),
    category: input.category.trim(),
    tags,
    sourceType: input.sourceType,
    enabled: input.enabled,
    suggestedQuestions,
    knowledgePackId: input.knowledgePackId === null
      ? null
      : typeof input.knowledgePackId === "string" ? input.knowledgePackId.trim() : undefined,
    metadata,
  };
}

export function sanitizeJobConfirmation(value: unknown): {
  expectedRevision: number;
  knowledgePackId?: string;
  items: KnowledgeImportJobItemConfirmation[];
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(["expectedRevision", "knowledgePackId", "items"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  if (!Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0 || (input.expectedRevision as number) > maximumDatabaseRevision) return null;
  if (input.knowledgePackId !== undefined && !validIdentifier(input.knowledgePackId)) return null;
  if (!Array.isArray(input.items) || input.items.length > knowledgeImportLimits.maximumBatchFiles) return null;
  const items: KnowledgeImportJobItemConfirmation[] = [];
  for (const value of input.items) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).some((key) => !new Set(["itemId", "expectedRevision", "metadata", "conflictResolution"]).has(key))) return null;
    if (!validIdentifier(item.itemId) || !Number.isSafeInteger(item.expectedRevision) || (item.expectedRevision as number) < 0 || (item.expectedRevision as number) > maximumDatabaseRevision) return null;
    if (!resolutions.includes(item.conflictResolution as KnowledgeConflictResolution)) return null;
    const metadata = sanitizeImportPreviewMetadata(item.metadata);
    if (!metadata) return null;
    items.push({
      itemId: item.itemId.trim(),
      expectedRevision: item.expectedRevision as number,
      metadata,
      conflictResolution: item.conflictResolution as KnowledgeConflictResolution,
    });
  }
  return {
    expectedRevision: input.expectedRevision as number,
    knowledgePackId: typeof input.knowledgePackId === "string" ? input.knowledgePackId.trim() : undefined,
    items,
  };
}

export function sanitizeExpectedRevision(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 1 || !Object.prototype.hasOwnProperty.call(input, "expectedRevision")) return null;
  return Number.isSafeInteger(input.expectedRevision)
    && (input.expectedRevision as number) >= 0
    && (input.expectedRevision as number) <= maximumDatabaseRevision
    ? input.expectedRevision as number
    : null;
}

type SanitizedJobConfirmation = Exclude<ReturnType<typeof sanitizeJobConfirmation>, null>;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  maximumConcurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(maximumConcurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function storedMetadata(metadata: KnowledgeImportPreviewMetadata, metrics: Omit<StoredPreviewMetadata, keyof KnowledgeImportPreviewMetadata>): Prisma.InputJsonValue {
  return { ...metadata, ...metrics } as Prisma.InputJsonValue;
}

function duplicateFor(
  candidate: { title: string; fileName: string; checksum: string },
  documents: Array<{ id: string; title: string; originalFileName: string | null; content: string; contentChecksum: string | null; revision: number }>,
): { type: KnowledgeDuplicateType; documentId?: string; documentRevision?: number } {
  const exact = documents.find((document) => (document.contentChecksum ?? createKnowledgeContentChecksum(document.content)) === candidate.checksum);
  if (exact) return { type: "exact_content", documentId: exact.id, documentRevision: exact.revision };
  const normalizedTitleCandidate = normalizeTitle(candidate.title);
  const sameTitle = documents.find((document) => normalizeTitle(document.title) === normalizedTitleCandidate);
  if (sameTitle) return { type: "same_title", documentId: sameTitle.id, documentRevision: sameTitle.revision };
  const sameFileName = documents.find((document) => document.originalFileName && normalizedFileName(document.originalFileName) === normalizedFileName(candidate.fileName));
  if (sameFileName) return { type: "same_file_name", documentId: sameFileName.id, documentRevision: sameFileName.revision };
  const possible = documents
    .map((document) => ({ document, score: titleSimilarity(document.title, candidate.title) }))
    .filter((entry) => entry.score >= 0.75)
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))[0];
  return possible ? { type: "possible_duplicate", documentId: possible.document.id, documentRevision: possible.document.revision } : { type: "none" };
}

function sameIdempotentPreviewPayload(
  existing: JobWithItems,
  parsed: Array<{ file: Pick<KnowledgeUploadFile, "fileName">; checksum: string }>,
  requestedKnowledgePackId?: string,
) {
  return (existing.knowledgePackId ?? undefined) === requestedKnowledgePackId
    && existing.items.length === parsed.length && existing.items
    .slice()
    .sort((left, right) => left.itemIndex - right.itemIndex)
    .every((item, index) => (
      item.originalFileName === parsed[index]?.file.fileName
      && item.checksum === parsed[index]?.checksum
    ));
}

function confirmationAlreadyApplied(job: JobWithItems, input: SanitizedJobConfirmation) {
  if (job.status === ImportJobStatus.PREVIEW_READY || (job.knowledgePackId ?? undefined) !== input.knowledgePackId) return false;
  const appliedItems = job.items.filter((item) => item.conflictResolution !== null);
  if (appliedItems.length !== input.items.length) return false;
  const confirmationIds = new Set(input.items.map((item) => item.itemId));
  if (confirmationIds.size !== input.items.length || appliedItems.some((item) => !confirmationIds.has(item.id))) return false;
  return input.items.every((confirmation) => {
    const item = appliedItems.find((candidate) => candidate.id === confirmation.itemId);
    if (!item || item.revision <= confirmation.expectedRevision || item.conflictResolution !== confirmation.conflictResolution) return false;
    const stored = readStoredMetadata(item.previewMetadata);
    const expectedKnowledgePackId = confirmation.metadata.knowledgePackId === undefined
      ? input.knowledgePackId
      : confirmation.metadata.knowledgePackId;
    return stored.title === confirmation.metadata.title
      && stored.category === confirmation.metadata.category
      && stored.sourceType === confirmation.metadata.sourceType
      && stored.enabled === confirmation.metadata.enabled
      && stored.knowledgePackId === expectedKnowledgePackId
      && isDeepStrictEqual(stored.tags, confirmation.metadata.tags)
      && isDeepStrictEqual(stored.suggestedQuestions, confirmation.metadata.suggestedQuestions)
      && isDeepStrictEqual(stored.metadata, confirmation.metadata.metadata);
  });
}

function translateError(error: unknown): never {
  if (error instanceof KnowledgeRepositoryError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new KnowledgeRepositoryError("导入请求已存在或与当前数据冲突。", 409, "knowledge_import_conflict");
    if (error.code === "P2025") throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
    if (error.code === "P2034") throw new KnowledgeRepositoryError("导入任务已被其他请求更新，请刷新后重试。", 409, "knowledge_import_revision_conflict");
  }
  throw new KnowledgeRepositoryError("企业知识导入服务暂不可用，请稍后重试。", 503, "server_storage_unavailable");
}

function statusCounts(statuses: ImportItemStatus[]) {
  const completed = statuses.filter((status) => status === ImportItemStatus.COMPLETED).length;
  const failed = statuses.filter((status) => status === ImportItemStatus.FAILED).length;
  const skipped = statuses.filter((status) => status === ImportItemStatus.SKIPPED).length;
  const active = statuses.filter((status) => status === ImportItemStatus.READY || status === ImportItemStatus.PROCESSING).length;
  const preview = statuses.filter((status) => status === ImportItemStatus.PREVIEW_READY || status === ImportItemStatus.CONFLICTED).length;
  let status: ImportJobStatus = ImportJobStatus.PROCESSING;
  if (!active && !preview) {
    if (failed === 0 && (completed > 0 || skipped > 0)) status = ImportJobStatus.COMPLETED;
    else if (completed > 0 || skipped > 0) status = ImportJobStatus.PARTIAL_FAILED;
    else status = ImportJobStatus.FAILED;
  }
  return { completed, failed, skipped, active, preview, status };
}

function boundedDurationMilliseconds(createdAt: Date, completedAt: Date) {
  return Math.min(maximumDatabaseDurationMilliseconds, Math.max(0, completedAt.getTime() - createdAt.getTime()));
}

export class PrismaKnowledgeImportRepository {
  constructor(private readonly workspaceId: string, private readonly prisma = getPrismaClient()) {}

  private async packExists(
    packId: string | undefined,
    client: Pick<Prisma.TransactionClient, "knowledgePack"> = this.prisma,
    requireActive = true,
  ) {
    if (!packId) return;
    const pack = await client.knowledgePack.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: packId } } });
    if (!pack) throw new KnowledgeRepositoryError("知识包不存在或不属于当前工作区。", 404, "knowledge_pack_not_found");
    if (requireActive && pack.status !== KnowledgePackStatus.ACTIVE) {
      throw new KnowledgeRepositoryError("已归档的知识包不能接收新的导入内容。", 409, "knowledge_pack_archived");
    }
  }

  private async loadJob(id: string): Promise<JobWithItems> {
    const record = await this.prisma.importJob.findUnique({
      where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
      include: { items: { orderBy: { itemIndex: "asc" } } },
    });
    if (!record) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
    return record;
  }

  async getJob(id: string) {
    return toPublicImportJob(await this.loadJob(id));
  }

  async listRecoverableJobs() {
    const records = await this.prisma.importJob.findMany({
      where: {
        workspaceId: this.workspaceId,
        status: { in: [...recoverableImportJobStatuses] },
      },
      include: { items: { orderBy: { itemIndex: "asc" } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: knowledgeImportLimits.maximumRecoverableJobs,
    });
    return records.map(toPublicImportJob);
  }

  async preview(input: { files: KnowledgeUploadFile[]; knowledgePackId?: string; idempotencyKey: string; signal?: AbortSignal }) {
    if (input.signal?.aborted) throw new KnowledgeRepositoryError("导入预览已取消。", 499, "knowledge_import_cancelled");
    if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > knowledgeImportLimits.maximumBatchFiles) {
      throw new KnowledgeRepositoryError(`每批最多选择 ${knowledgeImportLimits.maximumBatchFiles} 个文件。`, 400, "invalid_import_batch");
    }
    if (input.knowledgePackId !== undefined && !validIdentifier(input.knowledgePackId)) {
      throw new KnowledgeRepositoryError("知识包标识无效。", 400, "invalid_knowledge_pack_id");
    }
    if (!validIdentifier(input.idempotencyKey, knowledgeImportJobLimits.idempotencyKeyCharacters)) {
      throw new KnowledgeRepositoryError("幂等标识无效。", 400, "invalid_idempotency_key");
    }
    const totalBytes = input.files.reduce((sum, file) => sum + file.sizeBytes, 0);
    if (totalBytes > knowledgeImportLimits.maximumBatchBytes || input.files.some((file) => file.sizeBytes !== file.bytes.byteLength || file.sizeBytes > knowledgeImportLimits.maximumFileBytes)) {
      throw new KnowledgeRepositoryError("上传文件数量或大小超过安全限制。", 413, "knowledge_import_payload_too_large");
    }
    const rawFingerprints = input.files.map((file) => ({
      file: { fileName: file.fileName },
      checksum: createHash("sha256").update(file.bytes).digest("hex"),
    }));
    const existing = await this.prisma.importJob.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId: this.workspaceId, idempotencyKey: input.idempotencyKey } },
      include: { items: { orderBy: { itemIndex: "asc" } } },
    });
    if (existing) {
      if (!sameIdempotentPreviewPayload(existing, rawFingerprints, input.knowledgePackId)) {
        throw new KnowledgeRepositoryError("该幂等标识已用于另一批文件。", 409, "knowledge_import_idempotency_conflict");
      }
      return toPublicImportJob(existing);
    }
    const expiredPreviewBeforeParsing = new Date(Date.now() - knowledgeImportJobLimits.previewRetentionMilliseconds);
    await this.prisma.importJob.deleteMany({
      where: { workspaceId: this.workspaceId, status: ImportJobStatus.PREVIEW_READY, updatedAt: { lt: expiredPreviewBeforeParsing } },
    });
    const [activeJobsBeforeParsing, storedExtractedItemsBeforeParsing] = await Promise.all([
      this.prisma.importJob.count({
        where: {
          workspaceId: this.workspaceId,
          status: { in: [ImportJobStatus.PREVIEW_READY, ImportJobStatus.PENDING, ImportJobStatus.RUNNING, ImportJobStatus.PROCESSING] },
        },
      }),
      this.prisma.importItem.count({ where: { workspaceId: this.workspaceId, extractedText: { not: null } } }),
    ]);
    if (activeJobsBeforeParsing >= knowledgeImportJobLimits.maximumActiveJobsPerWorkspace
      || storedExtractedItemsBeforeParsing >= knowledgeImportJobLimits.maximumStoredExtractedItemsPerWorkspace) {
      throw new KnowledgeRepositoryError("当前工作区待处理的导入预览过多，请完成或取消已有任务后重试。", 429, "knowledge_import_workspace_quota");
    }
    await this.packExists(input.knowledgePackId);

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { id: "asc" },
      select: { id: true, title: true, originalFileName: true, content: true, contentChecksum: true, revision: true },
    });
    const parsedCandidates = await mapWithConcurrency(input.files, knowledgeImportLimits.maximumConcurrentParsers, async (file, itemIndex) => {
      if (input.signal?.aborted) throw new KnowledgeRepositoryError("导入预览已取消。", 499, "knowledge_import_cancelled");
      const rawChecksum = rawFingerprints[itemIndex]!.checksum;
      const result = await parseKnowledgeFile({ fileName: file.fileName, mimeType: file.mimeType, buffer: file.bytes, signal: input.signal });
      if (input.signal?.aborted) throw new KnowledgeRepositoryError("导入预览已取消。", 499, "knowledge_import_cancelled");
      if (!result.ok) {
        return {
          itemIndex,
          file,
          resolvedMimeType: file.mimeType || "application/octet-stream",
          checksum: rawChecksum,
          status: ImportItemStatus.FAILED,
          conflict: { type: "none" as const },
          contentChecksum: null,
          extractedText: null,
          previewMetadata: storedMetadata({
            title: file.fileName.replace(/\.[^.]+$/u, "").slice(0, agentRequestLimits.documentTitleChars) || "未命名文档",
            category: "用户导入", tags: [], sourceType: "user_upload", enabled: true, suggestedQuestions: [],
            knowledgePackId: input.knowledgePackId, metadata: {},
          }, {
            extractedCharacterCount: 0, estimatedChunkCount: 0, qualityLevel: "blocked", qualityLabel: "无法导入", warnings: [result.error.message],
          }),
          chunkPreview: [] as Prisma.InputJsonValue,
          errorCode: result.error.code,
          errorMessageSafe: result.error.message.slice(0, knowledgeImportJobLimits.safeErrorCharacters),
        };
      }
      const contentChecksum = createKnowledgeContentChecksum(result.value.text);
      const conflict = duplicateFor({ title: result.value.title, fileName: file.fileName, checksum: contentChecksum }, documents);
      const qualityLevel: KnowledgeImportQualityLevel = result.value.quality.qualityLevel === "cannot_import"
        ? "blocked"
        : result.value.quality.qualityLevel;
      const qualityLabel: PublicImportItem["qualityLabel"] = qualityLevel === "excellent" ? "优秀" : qualityLevel === "usable" ? "可用" : qualityLevel === "blocked" ? "无法导入" : "需处理";
      const metadata: KnowledgeImportPreviewMetadata = {
        title: result.value.title,
        category: "用户导入",
        tags: [],
        sourceType: "user_upload",
        enabled: true,
        suggestedQuestions: [],
        knowledgePackId: input.knowledgePackId,
        metadata: {},
      };
      const chunkPreview = result.value.quality.chunkPreview.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        characterCount: chunk.characterCount,
        approximateTokens: chunk.approximateTokens,
        keywords: chunk.keywords,
        contentPreview: chunk.contentPreview,
        tooShort: chunk.tooShort,
        tooLong: chunk.tooLong,
        possibleDuplicate: chunk.duplicate,
        lowInformation: chunk.lowInformation,
        qualityLevel: chunk.tooLong || chunk.duplicate || chunk.lowInformation ? "needs_attention" : "usable",
      })) as Prisma.InputJsonValue;
      return {
        itemIndex,
        file,
        resolvedMimeType: result.value.mimeType,
        checksum: rawChecksum,
        status: ImportItemStatus.PREVIEW_READY,
        conflict,
        contentChecksum,
        extractedText: result.value.text,
        previewMetadata: storedMetadata(metadata, {
          extractedCharacterCount: result.value.text.length,
          estimatedChunkCount: result.value.quality.chunkCount,
          qualityLevel,
          qualityLabel,
          warnings: [...result.value.warnings, ...result.value.quality.warnings.map((warning) => warning.message)].slice(0, 20),
        }),
        chunkPreview,
        errorCode: null,
        errorMessageSafe: null,
      };
    });
    const parsed = parsedCandidates.map((item, itemIndex, allItems) => {
      if (item.status !== ImportItemStatus.PREVIEW_READY || item.conflict.type !== "none" || !item.contentChecksum) return item;
      const earlier = allItems.slice(0, itemIndex).filter((candidate) => (
        candidate.status === ImportItemStatus.PREVIEW_READY && candidate.contentChecksum
      ));
      const exact = earlier.find((candidate) => candidate.contentChecksum === item.contentChecksum);
      if (exact) return { ...item, conflict: { type: "exact_content" as const } };
      const sameTitle = earlier.find((candidate) => (
        normalizeTitle(readStoredMetadata(candidate.previewMetadata).title)
        === normalizeTitle(readStoredMetadata(item.previewMetadata).title)
      ));
      if (sameTitle) return { ...item, conflict: { type: "same_title" as const } };
      const sameFileName = earlier.find((candidate) => (
        normalizedFileName(candidate.file.fileName) === normalizedFileName(item.file.fileName)
      ));
      return sameFileName ? { ...item, conflict: { type: "same_file_name" as const } } : item;
    });

    if (input.signal?.aborted) throw new KnowledgeRepositoryError("导入预览已取消。", 499, "knowledge_import_cancelled");
    const now = new Date();
    const id = `knowledge-import-${randomUUID()}`;
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const previewExpiry = new Date(now.getTime() - knowledgeImportJobLimits.previewRetentionMilliseconds);
        await tx.importJob.deleteMany({
          where: { workspaceId: this.workspaceId, status: ImportJobStatus.PREVIEW_READY, updatedAt: { lt: previewExpiry } },
        });
        const [activeJobs, storedExtractedItems] = await Promise.all([
          tx.importJob.count({
            where: {
              workspaceId: this.workspaceId,
              status: { in: [ImportJobStatus.PREVIEW_READY, ImportJobStatus.PENDING, ImportJobStatus.RUNNING, ImportJobStatus.PROCESSING] },
            },
          }),
          tx.importItem.count({ where: { workspaceId: this.workspaceId, extractedText: { not: null } } }),
        ]);
        const parsedExtractedItems = parsed.filter((item) => item.extractedText !== null).length;
        if (activeJobs >= knowledgeImportJobLimits.maximumActiveJobsPerWorkspace
          || storedExtractedItems + parsedExtractedItems > knowledgeImportJobLimits.maximumStoredExtractedItemsPerWorkspace) {
          throw new KnowledgeRepositoryError("当前工作区待处理的导入预览过多，请完成或取消已有任务后重试。", 429, "knowledge_import_workspace_quota");
        }
        return tx.importJob.create({ data: {
          id,
          workspaceId: this.workspaceId,
          knowledgePackId: input.knowledgePackId,
          idempotencyKey: input.idempotencyKey,
          status: ImportJobStatus.PREVIEW_READY,
          totalItems: parsed.length,
          failedItems: parsed.filter((item) => item.status === ImportItemStatus.FAILED).length,
          conflictedItems: parsed.filter((item) => item.conflict.type !== "none").length,
          createdAt: now,
          updatedAt: now,
          items: {
            create: parsed.map((item) => ({
              id: `knowledge-import-item-${randomUUID()}`,
              itemIndex: item.itemIndex,
              originalFileName: item.file.fileName,
              normalizedTitle: readStoredMetadata(item.previewMetadata).title,
              mimeType: item.resolvedMimeType,
              sizeBytes: item.file.sizeBytes,
              checksum: item.checksum,
              status: item.status,
              conflictType: item.conflict.type,
              conflictDocumentId: "documentId" in item.conflict ? item.conflict.documentId : undefined,
              conflictDocumentRevision: "documentRevision" in item.conflict ? item.conflict.documentRevision : undefined,
              extractedText: item.extractedText,
              previewMetadata: item.previewMetadata,
              chunkPreview: item.chunkPreview,
              errorCode: item.errorCode,
              errorMessageSafe: item.errorMessageSafe,
              createdAt: now,
              updatedAt: now,
            })),
          },
        }, include: { items: { orderBy: { itemIndex: "asc" } } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toPublicImportJob(record);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        try {
          const existing = await this.prisma.importJob.findUnique({
            where: { workspaceId_idempotencyKey: { workspaceId: this.workspaceId, idempotencyKey: input.idempotencyKey } },
            include: { items: { orderBy: { itemIndex: "asc" } } },
          });
          if (existing && sameIdempotentPreviewPayload(existing, parsed, input.knowledgePackId)) return toPublicImportJob(existing);
          if (existing) {
            throw new KnowledgeRepositoryError("该幂等标识已用于另一批文件。", 409, "knowledge_import_idempotency_conflict");
          }
        } catch (recoveryError) {
          return translateError(recoveryError);
        }
      }
      return translateError(error);
    }
  }

  async confirmJob(id: string, input: SanitizedJobConfirmation) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const job = await tx.importJob.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } }, include: { items: true } });
        if (!job) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
        if (job.status !== ImportJobStatus.PREVIEW_READY || job.revision !== input.expectedRevision) {
          if (confirmationAlreadyApplied(job, input)) return job;
          throw new KnowledgeRepositoryError("导入预览已发生变化，请刷新后重试。", 409, "knowledge_import_revision_conflict");
        }
        await this.packExists(input.knowledgePackId, tx);
        const eligible = job.items.filter((item) => item.status === ImportItemStatus.PREVIEW_READY);
        if (eligible.length !== input.items.length || new Set(input.items.map((item) => item.itemId)).size !== input.items.length) {
          throw new KnowledgeRepositoryError("导入确认项与当前预览不一致。", 409, "knowledge_import_items_conflict");
        }
        for (const confirmation of input.items) {
          const item = eligible.find((candidate) => candidate.id === confirmation.itemId);
          if (!item || item.revision !== confirmation.expectedRevision) {
            throw new KnowledgeRepositoryError("导入项已发生变化，请刷新后重试。", 409, "knowledge_import_item_revision_conflict");
          }
          const duplicateType = safeEnum(item.conflictType, duplicateTypes, "none");
          if (confirmation.conflictResolution === "replace" && (duplicateType === "none" || !item.conflictDocumentId)) {
            throw new KnowledgeRepositoryError("没有可替换的冲突文档。", 400, "invalid_conflict_resolution");
          }
          const knowledgePackId = confirmation.metadata.knowledgePackId === undefined
            ? input.knowledgePackId
            : confirmation.metadata.knowledgePackId;
          await this.packExists(knowledgePackId ?? undefined, tx);
          const previous = readStoredMetadata(item.previewMetadata);
          await tx.importItem.update({
            where: { workspaceId_id: { workspaceId: this.workspaceId, id: item.id } },
            data: {
              normalizedTitle: confirmation.metadata.title,
              previewMetadata: storedMetadata({ ...confirmation.metadata, knowledgePackId }, {
                extractedCharacterCount: previous.extractedCharacterCount,
                estimatedChunkCount: previous.estimatedChunkCount,
                qualityLevel: previous.qualityLevel,
                qualityLabel: previous.qualityLabel,
                warnings: previous.warnings,
              }),
              conflictResolution: confirmation.conflictResolution,
              status: ImportItemStatus.READY,
              revision: { increment: 1 },
            },
          });
        }
        const hasReady = eligible.length > 0;
        return tx.importJob.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          data: {
            knowledgePackId: input.knowledgePackId,
            status: hasReady ? ImportJobStatus.PENDING : ImportJobStatus.FAILED,
            completedAt: hasReady ? null : new Date(),
            revision: { increment: 1 },
          },
          include: { items: { orderBy: { itemIndex: "asc" } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toPublicImportJob(record);
    } catch (error) {
      return translateError(error);
    }
  }

  private async updateJobAfterItem(tx: Prisma.TransactionClient, jobId: string) {
    const job = await tx.importJob.findUnique({
      where: { workspaceId_id: { workspaceId: this.workspaceId, id: jobId } },
      select: { createdAt: true },
    });
    if (!job) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
    const statuses = (await tx.importItem.findMany({ where: { workspaceId: this.workspaceId, importJobId: jobId }, select: { status: true } })).map((item) => item.status);
    const counts = statusCounts(statuses);
    const terminal = counts.status === ImportJobStatus.COMPLETED || counts.status === ImportJobStatus.PARTIAL_FAILED || counts.status === ImportJobStatus.FAILED;
    const completedAt = terminal ? new Date() : null;
    return tx.importJob.update({
      where: { workspaceId_id: { workspaceId: this.workspaceId, id: jobId } },
      data: {
        status: counts.status,
        completedItems: counts.completed,
        failedItems: counts.failed,
        skippedItems: counts.skipped,
        completedAt,
        durationMs: completedAt ? boundedDurationMilliseconds(job.createdAt, completedAt) : null,
        revision: { increment: 1 },
      },
      include: { items: { orderBy: { itemIndex: "asc" } } },
    });
  }

  private async claimNext(id: string, expectedRevision: number) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
      if (!job) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
      if (job.revision !== expectedRevision || (job.status !== ImportJobStatus.PENDING && job.status !== ImportJobStatus.PROCESSING)) {
        throw new KnowledgeRepositoryError("导入任务已发生变化，请刷新后重试。", 409, "knowledge_import_revision_conflict");
      }
      const now = new Date();
      const candidate = await tx.importItem.findFirst({
        where: {
          workspaceId: this.workspaceId,
          importJobId: id,
          OR: [
            { status: ImportItemStatus.READY },
            { status: ImportItemStatus.PROCESSING, leaseExpiresAt: { lt: now } },
          ],
        },
        orderBy: { itemIndex: "asc" },
      });
      if (!candidate) return null;
      const claimToken = randomUUID();
      const claimed = await tx.importItem.updateMany({
        where: {
          workspaceId: this.workspaceId,
          id: candidate.id,
          revision: candidate.revision,
          OR: [
            { status: ImportItemStatus.READY },
            { status: ImportItemStatus.PROCESSING, leaseExpiresAt: { lt: now } },
          ],
        },
        data: {
          status: ImportItemStatus.PROCESSING,
          claimToken,
          claimedAt: now,
          leaseExpiresAt: new Date(now.getTime() + knowledgeImportJobLimits.leaseMilliseconds),
          revision: { increment: 1 },
        },
      });
      const updatedJob = await tx.importJob.updateMany({
        where: { workspaceId: this.workspaceId, id, revision: expectedRevision },
        data: { status: ImportJobStatus.PROCESSING, revision: { increment: 1 } },
      });
      if (claimed.count !== 1 || updatedJob.count !== 1) throw new KnowledgeRepositoryError("导入项已由其他处理器领取。", 409, "knowledge_import_claim_conflict");
      return { itemId: candidate.id, claimToken };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async completeClaim(jobId: string, itemId: string, claimToken: string) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.importJob.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: jobId } } });
      const item = await tx.importItem.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id: itemId } } });
      if (!job || !item || item.importJobId !== jobId || item.status !== ImportItemStatus.PROCESSING || item.claimToken !== claimToken) {
        throw new KnowledgeRepositoryError("导入项领取已失效。", 409, "knowledge_import_claim_conflict");
      }
      if (job.status === ImportJobStatus.CANCELLED) throw new KnowledgeRepositoryError("导入任务已取消。", 409, "knowledge_import_cancelled");
      if (!item.extractedText) throw new KnowledgeRepositoryError("该导入项没有可用的解析正文，请重新上传。", 400, "knowledge_import_content_missing");
      const metadata = readStoredMetadata(item.previewMetadata);
      const knowledgePackId = metadata.knowledgePackId === undefined
        ? job.knowledgePackId ?? undefined
        : metadata.knowledgePackId;
      await this.packExists(knowledgePackId ?? undefined, tx, false);
      const resolution = safeEnum(item.conflictResolution, resolutions, "import_as_new");
      if (resolution === "skip") {
        await tx.importItem.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id: item.id } },
          data: { status: ImportItemStatus.SKIPPED, extractedText: null, claimToken: null, claimedAt: null, leaseExpiresAt: null, revision: { increment: 1 } },
        });
        return this.updateJobAfterItem(tx, jobId);
      }

      const now = new Date();
      let documentId = `knowledge-${randomUUID()}`;
      let createdAt = now.toISOString();
      let revision = 0;
      if (resolution === "replace") {
        if (!item.conflictDocumentId || item.conflictDocumentRevision === null) {
          throw new KnowledgeRepositoryError("冲突文档信息已失效，请重新预览。", 409, "knowledge_import_conflict_stale");
        }
        const existing = await tx.knowledgeDocument.findUnique({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id: item.conflictDocumentId } },
        });
        if (!existing || existing.revision !== item.conflictDocumentRevision) {
          throw new KnowledgeRepositoryError("待替换文档已发生变化，请重新预览。", 409, "knowledge_import_conflict_stale");
        }
        documentId = existing.id;
        createdAt = existing.createdAt.toISOString();
        revision = existing.revision + 1;
      } else {
        const documentCount = await tx.knowledgeDocument.count({ where: { workspaceId: this.workspaceId } });
        if (documentCount >= agentRequestLimits.userDocuments) {
          throw new KnowledgeRepositoryError(`知识文档最多保存 ${agentRequestLimits.userDocuments} 篇。`, 409, "knowledge_document_capacity");
        }
      }

      const document: ImportedKnowledgeDocument = {
        id: documentId,
        title: metadata.title,
        category: metadata.category,
        tags: metadata.tags,
        summary: item.extractedText.slice(0, agentRequestLimits.documentSummaryChars),
        content: item.extractedText,
        createdAt,
        updatedAt: now.toISOString(),
        importedAt: now.toISOString(),
        source: metadata.sourceType === "user_upload" ? "企业知识批量上传" : "企业知识批量录入",
        owner: "用户导入",
        isDefault: false,
        sourceType: metadata.sourceType,
        enabled: metadata.enabled,
        suggestedQuestions: metadata.suggestedQuestions,
        knowledgePackId: knowledgePackId ?? undefined,
        originalFileName: item.originalFileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        importJobId: jobId,
        revision,
        metadata: metadata.metadata,
      };
      const data = knowledgeDocumentCreateData(this.workspaceId, document);
      if (resolution === "replace") {
        const updated = await tx.knowledgeDocument.updateMany({
          where: { workspaceId: this.workspaceId, id: documentId, revision: item.conflictDocumentRevision! },
          data: {
            title: data.title,
            content: data.content,
            sourceType: data.sourceType,
            enabled: data.enabled,
            tags: data.tags,
            metadata: data.metadata,
            checksum: data.checksum,
            contentChecksum: data.contentChecksum,
            revision,
            category: data.category,
            summary: data.summary,
            packId: data.packId,
            knowledgePackId: data.knowledgePackId,
            originalFileName: data.originalFileName,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            importJobId: jobId,
            importedAt: data.importedAt,
            suggestedQuestions: data.suggestedQuestions,
            updatedAt: now,
          },
        });
        if (updated.count !== 1) throw new KnowledgeRepositoryError("待替换文档已发生变化，请重新预览。", 409, "knowledge_import_conflict_stale");
        await tx.knowledgeChunk.deleteMany({ where: { workspaceId: this.workspaceId, documentId } });
      } else {
        await tx.knowledgeDocument.create({ data });
      }
      const chunks = knowledgeChunkCreateData(this.workspaceId, document);
      if (chunks.length > knowledgeImportLimits.maximumChunks) throw new KnowledgeRepositoryError("文档分块数量超过安全上限。", 400, "knowledge_import_chunk_limit");
      if (chunks.length) await tx.knowledgeChunk.createMany({ data: chunks });
      await tx.importItem.update({
        where: { workspaceId_id: { workspaceId: this.workspaceId, id: item.id } },
        data: {
          status: ImportItemStatus.COMPLETED,
          documentId,
          extractedText: null,
          claimToken: null,
          claimedAt: null,
          leaseExpiresAt: null,
          errorCode: null,
          errorMessageSafe: null,
          revision: { increment: 1 },
        },
      });
      return this.updateJobAfterItem(tx, jobId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async failClaim(jobId: string, itemId: string, claimToken: string, error: unknown) {
    const code = error instanceof KnowledgeRepositoryError ? error.code : "knowledge_import_item_failed";
    const message = error instanceof KnowledgeRepositoryError ? error.message : "该文件导入失败，请稍后重试。";
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.importItem.updateMany({
          where: { workspaceId: this.workspaceId, id: itemId, importJobId: jobId, status: ImportItemStatus.PROCESSING, claimToken },
          data: {
            status: ImportItemStatus.FAILED,
            errorCode: code.slice(0, 64),
            errorMessageSafe: message.slice(0, knowledgeImportJobLimits.safeErrorCharacters),
            claimToken: null,
            claimedAt: null,
            leaseExpiresAt: null,
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new KnowledgeRepositoryError("导入项领取已失效。", 409, "knowledge_import_claim_conflict");
        return this.updateJobAfterItem(tx, jobId);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (failure) {
      return translateError(failure);
    }
  }

  async processNext(id: string, expectedRevision: number) {
    let claim: { itemId: string; claimToken: string } | null;
    try {
      claim = await this.claimNext(id, expectedRevision);
      if (!claim) return this.getJob(id);
    } catch (error) {
      return translateError(error);
    }
    try {
      return toPublicImportJob(await this.completeClaim(id, claim.itemId, claim.claimToken));
    } catch (error) {
      return toPublicImportJob(await this.failClaim(id, claim.itemId, claim.claimToken, error));
    }
  }

  async retryFailed(id: string, expectedRevision: number) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const job = await tx.importJob.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
        if (!job) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
        if (job.revision !== expectedRevision || (job.status !== ImportJobStatus.FAILED && job.status !== ImportJobStatus.PARTIAL_FAILED)) {
          throw new KnowledgeRepositoryError("导入任务已发生变化，请刷新后重试。", 409, "knowledge_import_revision_conflict");
        }
        const retryable = await tx.importItem.updateMany({
          where: {
            workspaceId: this.workspaceId,
            importJobId: id,
            status: ImportItemStatus.FAILED,
            extractedText: { not: null },
            errorCode: { in: [...retryableImportErrorCodes] },
          },
          data: {
            status: ImportItemStatus.READY,
            retryCount: { increment: 1 },
            errorCode: null,
            errorMessageSafe: null,
            claimToken: null,
            claimedAt: null,
            leaseExpiresAt: null,
            revision: { increment: 1 },
          },
        });
        if (retryable.count === 0) throw new KnowledgeRepositoryError("没有可重试的失败项；解析失败的文件需要重新上传。", 400, "knowledge_import_nothing_to_retry");
        return tx.importJob.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          data: { status: ImportJobStatus.PENDING, failedItems: { decrement: retryable.count }, completedAt: null, revision: { increment: 1 } },
          include: { items: { orderBy: { itemIndex: "asc" } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toPublicImportJob(record);
    } catch (error) {
      return translateError(error);
    }
  }

  async cancel(id: string, expectedRevision: number) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const job = await tx.importJob.findUnique({ where: { workspaceId_id: { workspaceId: this.workspaceId, id } } });
        if (!job) throw new KnowledgeRepositoryError("导入任务不存在。", 404, "knowledge_import_not_found");
        if (job.revision !== expectedRevision || job.status === ImportJobStatus.COMPLETED || job.status === ImportJobStatus.CANCELLED) {
          throw new KnowledgeRepositoryError("导入任务已发生变化或已结束。", 409, "knowledge_import_revision_conflict");
        }
        await tx.importItem.updateMany({
          where: {
            workspaceId: this.workspaceId,
            importJobId: id,
            status: { in: [ImportItemStatus.PREVIEW_READY, ImportItemStatus.READY, ImportItemStatus.PROCESSING, ImportItemStatus.CONFLICTED, ImportItemStatus.FAILED] },
          },
          data: { status: ImportItemStatus.CANCELLED, extractedText: null, claimToken: null, claimedAt: null, leaseExpiresAt: null, revision: { increment: 1 } },
        });
        const completedAt = new Date();
        return tx.importJob.update({
          where: { workspaceId_id: { workspaceId: this.workspaceId, id } },
          data: {
            status: ImportJobStatus.CANCELLED,
            completedAt,
            durationMs: boundedDurationMilliseconds(job.createdAt, completedAt),
            revision: { increment: 1 },
          },
          include: { items: { orderBy: { itemIndex: "asc" } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return toPublicImportJob(record);
    } catch (error) {
      return translateError(error);
    }
  }
}
