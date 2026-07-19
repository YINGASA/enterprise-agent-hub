export const knowledgeImportLimits = {
  maximumBatchFiles: 10,
  maximumFileBytes: 5 * 1024 * 1024,
  maximumBatchBytes: 25 * 1024 * 1024,
  maximumFileNameCharacters: 240,
  maximumExtractedCharacters: 120_000,
  maximumChunks: 500,
  maximumChunkPreviews: 40,
  maximumPdfPages: 200,
  maximumDocxEntries: 500,
  maximumDocxUncompressedBytes: 50 * 1024 * 1024,
  maximumDocxEntryBytes: 10 * 1024 * 1024,
  maximumDocxCompressionRatio: 100,
  maximumConcurrentParsers: 2,
  maximumConcurrentPreviewRequestsGlobal: 2,
  maximumConcurrentPreviewRequestsPerWorkspace: 1,
  parserTimeoutMs: 10_000,
  previewTimeoutMs: 60_000,
  itemProcessingTimeoutMs: 20_000,
  processingSessionTimeoutMs: 90_000,
  processingRecoveryPollMs: 2_000,
  maximumProcessingRecoveryPolls: 20,
  transactionMaximumWaitMs: 2_000,
  maximumRetryCount: 3,
  leaseMilliseconds: 30_000,
  leaseRenewalIntervalMs: 10_000,
  maximumActiveJobsPerWorkspace: 20,
  maximumStoredExtractedItemsPerWorkspace: 50,
  previewRetentionMilliseconds: 24 * 60 * 60 * 1_000,
  temporaryExtractedTextRetentionMilliseconds: 24 * 60 * 60 * 1_000,
  idempotencyKeyCharacters: 128,
  safeErrorCharacters: 400,
  maximumRecoverableJobs: 10,
} as const;

/**
 * Durable job limits are kept as a compatibility view while all values live in
 * this module. This prevents the HTTP, parser and database paths from drifting
 * onto different production limits.
 */
export const knowledgeImportJobLimits = {
  idempotencyKeyCharacters: knowledgeImportLimits.idempotencyKeyCharacters,
  leaseMilliseconds: knowledgeImportLimits.leaseMilliseconds,
  leaseRenewalIntervalMs: knowledgeImportLimits.leaseRenewalIntervalMs,
  maximumRetryCount: knowledgeImportLimits.maximumRetryCount,
  maximumActiveJobsPerWorkspace: knowledgeImportLimits.maximumActiveJobsPerWorkspace,
  maximumStoredExtractedItemsPerWorkspace: knowledgeImportLimits.maximumStoredExtractedItemsPerWorkspace,
  previewRetentionMilliseconds: knowledgeImportLimits.previewRetentionMilliseconds,
  temporaryExtractedTextRetentionMilliseconds: knowledgeImportLimits.temporaryExtractedTextRetentionMilliseconds,
  itemProcessingTimeoutMs: knowledgeImportLimits.itemProcessingTimeoutMs,
  transactionMaximumWaitMs: knowledgeImportLimits.transactionMaximumWaitMs,
  safeErrorCharacters: knowledgeImportLimits.safeErrorCharacters,
} as const;

export const knowledgeImportPreviewConcurrencyLimits = {
  maximumGlobal: knowledgeImportLimits.maximumConcurrentPreviewRequestsGlobal,
  maximumPerWorkspace: knowledgeImportLimits.maximumConcurrentPreviewRequestsPerWorkspace,
} as const;

export function validateKnowledgeImportRuntimeLimits() {
  const values = Object.values(knowledgeImportLimits);
  if (values.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error("Knowledge import runtime limits must be positive safe integers.");
  }
  if (knowledgeImportLimits.maximumConcurrentPreviewRequestsGlobal * knowledgeImportLimits.maximumConcurrentParsers > 4) {
    throw new Error("Knowledge import parser concurrency exceeds the process safety boundary.");
  }
  if (knowledgeImportLimits.leaseRenewalIntervalMs >= knowledgeImportLimits.leaseMilliseconds) {
    throw new Error("Knowledge import lease renewal must occur before lease expiry.");
  }
  if (
    knowledgeImportLimits.itemProcessingTimeoutMs + knowledgeImportLimits.transactionMaximumWaitMs
    >= knowledgeImportLimits.leaseMilliseconds
  ) {
    throw new Error("Knowledge import item processing must finish inside its renewed lease.");
  }
  return true;
}

export const KNOWLEDGE_IMPORT_LIMITS = knowledgeImportLimits;

export const SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"] as const;

export type EnterpriseImportExtension = (typeof SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS)[number];

export const ENTERPRISE_IMPORT_MIME_TYPES: Readonly<Record<EnterpriseImportExtension, readonly string[]>> = {
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/x-markdown", "text/plain"],
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

export const GENERIC_IMPORT_MIME_TYPES = ["", "application/octet-stream"] as const;
