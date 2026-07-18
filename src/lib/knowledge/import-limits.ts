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
  parserTimeoutMs: 10_000,
  maximumRecoverableJobs: 10,
} as const;

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
