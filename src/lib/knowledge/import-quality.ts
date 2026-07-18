import { estimateTextTokens } from "@/lib/conversation/token-estimator";
import { assessKnowledgeDocument } from "@/lib/knowledge/quality";
import { splitDocument } from "@/lib/rag";
import { knowledgeImportLimits, type EnterpriseImportExtension } from "@/lib/knowledge/import-limits";
import type { KnowledgeDocument } from "@/types";

export type KnowledgeImportQualityLevel = "excellent" | "usable" | "needs_attention" | "cannot_import";
export type KnowledgeImportQualityLabel = "优秀" | "可用" | "需处理" | "无法导入";
export type KnowledgeImportWarningCode =
  | "empty_content"
  | "content_too_short"
  | "content_too_long"
  | "abnormal_control_characters"
  | "chunk_count_high"
  | "chunk_count_exceeded"
  | "chunk_too_short"
  | "chunk_too_long"
  | "duplicate_chunks"
  | "low_information"
  | "title_duplicates_content"
  | "pdf_low_text_density";

export type KnowledgeImportWarning = {
  code: KnowledgeImportWarningCode;
  severity: "warning" | "error";
  message: string;
};

export type KnowledgeImportChunkPreview = {
  chunkIndex: number;
  characterCount: number;
  approximateTokens: number;
  keywords: string[];
  contentPreview: string;
  tooShort: boolean;
  tooLong: boolean;
  duplicate: boolean;
  lowInformation: boolean;
};

export type BuildKnowledgeImportPreviewInput = {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  suggestedQuestions?: string[];
  packId?: string;
  enabled?: boolean;
  fileKind?: EnterpriseImportExtension;
  fileSizeBytes?: number;
};

export type KnowledgeImportPreview = {
  canImport: boolean;
  qualityLevel: KnowledgeImportQualityLevel;
  label: KnowledgeImportQualityLabel;
  score: number;
  characterCount: number;
  approximateTokens: number;
  chunkCount: number;
  chunkPreview: KnowledgeImportChunkPreview[];
  chunkPreviewTruncated: boolean;
  warnings: KnowledgeImportWarning[];
};

const abnormalControlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

function normalizeComparable(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "").trim();
}

function resultWithoutChunks(
  input: BuildKnowledgeImportPreviewInput,
  warning: KnowledgeImportWarning,
  chunkCount = 0,
): KnowledgeImportPreview {
  return {
    canImport: false,
    qualityLevel: "cannot_import",
    label: "无法导入",
    score: 0,
    characterCount: input.content.trim().length,
    approximateTokens: estimateTextTokens(input.content),
    chunkCount,
    chunkPreview: [],
    chunkPreviewTruncated: false,
    warnings: [warning],
  };
}

/**
 * Builds a deterministic preview from extracted plain text. It intentionally
 * reuses the production RAG chunker so a confirmed import sees the same chunk
 * boundaries as its preview.
 */
export function buildKnowledgeImportPreview(input: BuildKnowledgeImportPreviewInput): KnowledgeImportPreview {
  const content = input.content.trim();
  if (!content) {
    return resultWithoutChunks(input, { code: "empty_content", severity: "error", message: "文件没有可导入的正文。" });
  }
  if (content.length > knowledgeImportLimits.maximumExtractedCharacters) {
    return resultWithoutChunks(input, { code: "content_too_long", severity: "error", message: "提取后的正文超过允许长度。" });
  }
  if (abnormalControlCharacterPattern.test(content)) {
    return resultWithoutChunks(input, { code: "abnormal_control_characters", severity: "error", message: "正文包含异常控制字符。" });
  }

  // Avoid invoking keyword extraction tens of thousands of times for an input
  // deliberately made of tiny lines. The final check below still uses the real
  // chunker for every input inside this coarse safety boundary.
  const paragraphCount = content.split(/\n+/).filter((paragraph) => paragraph.trim()).length;
  if (paragraphCount > knowledgeImportLimits.maximumChunks) {
    return resultWithoutChunks(input, { code: "chunk_count_exceeded", severity: "error", message: "预计分块数量超过安全上限。" }, paragraphCount);
  }

  const document: KnowledgeDocument = {
    id: "knowledge-import-preview",
    title: input.title.trim() || "未命名文档",
    category: input.category?.trim() || "用户导入",
    tags: input.tags ?? [],
    suggestedQuestions: input.suggestedQuestions ?? [],
    packId: input.packId,
    content,
    enabled: input.enabled !== false,
    sourceType: "user_upload",
    isDefault: false,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  };
  const chunks = splitDocument(document);
  if (chunks.length > knowledgeImportLimits.maximumChunks) {
    return resultWithoutChunks(input, { code: "chunk_count_exceeded", severity: "error", message: "预计分块数量超过安全上限。" }, chunks.length);
  }

  const seenContent = new Set<string>();
  let shortChunkCount = 0;
  let longChunkCount = 0;
  let duplicateChunkCount = 0;
  let lowInformationChunkCount = 0;
  const previews = chunks.map((chunk): KnowledgeImportChunkPreview => {
    const characterCount = chunk.content.trim().length;
    const normalized = normalizeComparable(chunk.content);
    const duplicate = Boolean(normalized) && seenContent.has(normalized);
    if (normalized) seenContent.add(normalized);
    const tooShort = characterCount < 80;
    const tooLong = characterCount > 600;
    const lowInformation = chunk.keywords.length < 3;
    if (tooShort) shortChunkCount += 1;
    if (tooLong) longChunkCount += 1;
    if (duplicate) duplicateChunkCount += 1;
    if (lowInformation) lowInformationChunkCount += 1;
    return {
      chunkIndex: chunk.chunkIndex,
      characterCount,
      approximateTokens: estimateTextTokens(chunk.content),
      keywords: chunk.keywords.slice(0, 12),
      contentPreview: chunk.content.slice(0, 240),
      tooShort,
      tooLong,
      duplicate,
      lowInformation,
    };
  });

  const warnings: KnowledgeImportWarning[] = [];
  if (content.length < 100) warnings.push({ code: "content_too_short", severity: "warning", message: "正文较短，可能缺少独立检索价值。" });
  if (chunks.length > 100) warnings.push({ code: "chunk_count_high", severity: "warning", message: "分块数量较多，建议按主题拆分文档。" });
  if (shortChunkCount > 0) warnings.push({ code: "chunk_too_short", severity: "warning", message: "部分分块过短。" });
  if (longChunkCount > 0) warnings.push({ code: "chunk_too_long", severity: "warning", message: "部分分块过长。" });
  if (duplicateChunkCount > 0) warnings.push({ code: "duplicate_chunks", severity: "warning", message: "检测到重复分块。" });
  if (lowInformationChunkCount > 0) warnings.push({ code: "low_information", severity: "warning", message: "部分分块的有效关键词不足。" });
  if (normalizeComparable(content) === normalizeComparable(document.title)) {
    warnings.push({ code: "title_duplicates_content", severity: "warning", message: "标题与正文内容完全重复。" });
  }
  if (input.fileKind === ".pdf" && input.fileSizeBytes && content.length / input.fileSizeBytes < 0.002) {
    warnings.push({ code: "pdf_low_text_density", severity: "warning", message: "PDF 可提取文本密度较低，可能主要由图片构成。" });
  }

  const base = assessKnowledgeDocument(document, chunks);
  const duplicatePenalty = duplicateChunkCount > Math.max(1, Math.floor(chunks.length * 0.2)) ? 15 : 0;
  const lowInformationPenalty = lowInformationChunkCount > Math.max(1, Math.floor(chunks.length * 0.5)) ? 10 : 0;
  const repetitionPenalty = warnings.some((warning) => warning.code === "title_duplicates_content") ? 20 : 0;
  const score = Math.max(0, base.score - duplicatePenalty - lowInformationPenalty - repetitionPenalty);
  const qualityLevel: KnowledgeImportQualityLevel = score >= 85 ? "excellent" : score >= 60 ? "usable" : "needs_attention";
  const label: KnowledgeImportQualityLabel = qualityLevel === "excellent" ? "优秀" : qualityLevel === "usable" ? "可用" : "需处理";

  return {
    canImport: true,
    qualityLevel,
    label,
    score,
    characterCount: content.length,
    approximateTokens: estimateTextTokens(content),
    chunkCount: chunks.length,
    chunkPreview: previews.slice(0, knowledgeImportLimits.maximumChunkPreviews),
    chunkPreviewTruncated: previews.length > knowledgeImportLimits.maximumChunkPreviews,
    warnings,
  };
}
