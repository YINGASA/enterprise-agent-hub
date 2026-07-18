import mammoth from "mammoth";
import { fromBuffer as openZipBuffer, validateFileName, type Entry, type ZipFile } from "yauzl";
import { buildKnowledgeImportPreview, type KnowledgeImportPreview } from "@/lib/knowledge/import-quality";
import {
  ENTERPRISE_IMPORT_MIME_TYPES,
  GENERIC_IMPORT_MIME_TYPES,
  knowledgeImportLimits,
  SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS,
  type EnterpriseImportExtension,
} from "@/lib/knowledge/import-limits";

export type KnowledgeFileKind = "txt" | "markdown" | "pdf" | "docx";
export type KnowledgeFileWarningCode = "pdf_low_text_density" | "docx_parser_warning";
export type KnowledgeFileParseErrorCode =
  | "invalid_file_name"
  | "unsupported_file_type"
  | "file_too_large"
  | "mime_mismatch"
  | "signature_mismatch"
  | "empty_content"
  | "invalid_encoding"
  | "abnormal_control_characters"
  | "extracted_content_too_large"
  | "chunk_count_exceeded"
  | "pdf_parse_error"
  | "pdf_page_limit"
  | "pdf_no_extractable_text"
  | "docx_invalid_archive"
  | "docx_unsafe_archive"
  | "docx_missing_structure"
  | "docx_parse_error"
  | "parser_cancelled"
  | "parser_timeout";

export type ParseKnowledgeFileInput = {
  fileName: string;
  mimeType?: string;
  buffer: Buffer | Uint8Array | ArrayBuffer;
  signal?: AbortSignal;
};

export type ParsedKnowledgeFile = {
  text: string;
  mimeType: string;
  title: string;
  fileKind: KnowledgeFileKind;
  warnings: KnowledgeFileWarningCode[];
  quality: KnowledgeImportPreview;
};

export type ParseKnowledgeFileResult =
  | { ok: true; value: ParsedKnowledgeFile }
  | { ok: false; error: { code: KnowledgeFileParseErrorCode; message: string } };

type ParserFailure = { code: KnowledgeFileParseErrorCode; message: string };

const abnormalControlCharacterPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const canonicalMimeType: Readonly<Record<EnterpriseImportExtension, string>> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const fileKindByExtension: Readonly<Record<EnterpriseImportExtension, KnowledgeFileKind>> = {
  ".txt": "txt",
  ".md": "markdown",
  ".pdf": "pdf",
  ".docx": "docx",
};

function failure(code: KnowledgeFileParseErrorCode, message: string): ParserFailure {
  return { code, message };
}

function isParserFailure(value: unknown): value is ParserFailure {
  return Boolean(value && typeof value === "object" && "code" in value && "message" in value);
}

function asBuffer(value: ParseKnowledgeFileInput["buffer"]) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function extensionOf(fileName: string): EnterpriseImportExtension | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = fileName.slice(dot).toLowerCase();
  return SUPPORTED_ENTERPRISE_IMPORT_EXTENSIONS.includes(extension as EnterpriseImportExtension)
    ? extension as EnterpriseImportExtension
    : null;
}

function safeFileName(fileName: string) {
  const trimmed = fileName.trim();
  if (!trimmed || Array.from(trimmed).length > knowledgeImportLimits.maximumFileNameCharacters) return null;
  if (trimmed === "." || trimmed === ".." || /[\/\\\u0000]/u.test(trimmed) || /^[A-Za-z]:/u.test(trimmed)) return null;
  return trimmed;
}

function titleFromFileName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return (dot > 0 ? fileName.slice(0, dot) : fileName).normalize("NFKC").replace(/\s+/gu, " ").trim().slice(0, 160) || "未命名文档";
}

function normalizedMimeType(value: string | undefined) {
  return (value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function mimeMatches(extension: EnterpriseImportExtension, mimeType: string) {
  if (GENERIC_IMPORT_MIME_TYPES.includes(mimeType as (typeof GENERIC_IMPORT_MIME_TYPES)[number])) return true;
  return ENTERPRISE_IMPORT_MIME_TYPES[extension].includes(mimeType);
}

function hasPdfSignature(buffer: Buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasZipSignature(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

function normalizeExtractedText(text: string) {
  return text.replace(/^\ufeff/u, "").replace(/\r\n?/gu, "\n").trim();
}

function validateExtractedText(text: string): ParserFailure | null {
  if (!text) return failure("empty_content", "文件没有可导入的正文。");
  if (text.length > knowledgeImportLimits.maximumExtractedCharacters) {
    return failure("extracted_content_too_large", "提取后的正文超过 120,000 个字符。");
  }
  if (abnormalControlCharacterPattern.test(text)) {
    return failure("abnormal_control_characters", "文件正文包含异常控制字符。");
  }
  return null;
}

function withTimeout<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(failure("parser_cancelled", "文件解析已取消。")));
    const timer = setTimeout(
      () => finish(() => reject(failure("parser_timeout", "文件解析超时，请缩小文件后重试。"))),
      knowledgeImportLimits.parserTimeoutMs,
    );
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

async function parseUtf8(buffer: Buffer) {
  try {
    return normalizeExtractedText(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw failure("invalid_encoding", "文本文件不是有效的 UTF-8 编码。");
  }
}

async function parsePdf(buffer: Buffer, signal?: AbortSignal) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: Uint8Array.from(buffer), isEvalSupported: false, verbosity: 0 });
  try {
    const document = await withTimeout(loadingTask.promise, signal);
    if (document.numPages > knowledgeImportLimits.maximumPdfPages) {
      throw failure("pdf_page_limit", `PDF 页数不能超过 ${knowledgeImportLimits.maximumPdfPages} 页。`);
    }
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await withTimeout(document.getPage(pageNumber), signal);
      const textContent = await withTimeout(page.getTextContent(), signal);
      const parts = textContent.items.flatMap((item) => {
        if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string") return [];
        return [item.str + ("hasEOL" in item && item.hasEOL ? "\n" : " ")];
      });
      pages.push(parts.join("").trim());
      page.cleanup();
      if (pages.reduce((total, value) => total + value.length, 0) > knowledgeImportLimits.maximumExtractedCharacters) {
        throw failure("extracted_content_too_large", "提取后的正文超过 120,000 个字符。");
      }
    }
    const text = normalizeExtractedText(pages.filter(Boolean).join("\n\n"));
    if (!text) throw failure("pdf_no_extractable_text", "PDF 没有可提取文本；扫描型 PDF 暂不支持 OCR。");
    return text;
  } catch (error) {
    if (isParserFailure(error)) throw error;
    throw failure("pdf_parse_error", "PDF 无法解析或文件结构已损坏。");
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function unsafeZipPath(fileName: string) {
  if (!fileName || fileName.includes("\u0000") || fileName.includes("\\") || fileName.startsWith("/") || /^[A-Za-z]:/u.test(fileName)) return true;
  if (fileName.split("/").some((part) => part === "..")) return true;
  return Boolean(validateFileName(fileName));
}

function consumeEntry(zipFile: ZipFile, entry: Entry) {
  return new Promise<void>((resolve, reject) => {
    zipFile.openReadStream(entry, (openError, stream) => {
      if (openError) {
        reject(openError);
        return;
      }
      let bytes = 0;
      stream.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > knowledgeImportLimits.maximumDocxEntryBytes) stream.destroy(new Error("entry limit"));
      });
      stream.once("error", reject);
      stream.once("end", () => resolve());
      stream.resume();
    });
  });
}

export type DocxArchiveInspection = { entryCount: number; uncompressedBytes: number };

/** Reads only ZIP metadata and the two required DOCX XML entries; it never extracts files to disk. */
export function inspectDocxArchive(buffer: Buffer, signal?: AbortSignal): Promise<DocxArchiveInspection> {
  return new Promise((resolve, reject) => {
    let currentZip: ZipFile | undefined;
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const rejectSafely = (error: ParserFailure) => {
      if (settled) return;
      settled = true;
      cleanup();
      currentZip?.close();
      reject(error);
    };
    const onAbort = () => rejectSafely(failure("parser_cancelled", "文件解析已取消。"));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    openZipBuffer(buffer, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true, strictFileNames: true }, (openError, zipFile) => {
      currentZip = zipFile;
      if (settled) {
        zipFile?.close();
        return;
      }
      if (openError) {
        rejectSafely(failure("docx_invalid_archive", "DOCX 压缩结构无效。"));
        return;
      }
      if (zipFile.entryCount > knowledgeImportLimits.maximumDocxEntries) {
        rejectSafely(failure("docx_unsafe_archive", "DOCX 内部文件数量超过安全上限。"));
        return;
      }
      let entryCount = 0;
      let uncompressedBytes = 0;
      const requiredEntries = new Set(["[Content_Types].xml", "word/document.xml"]);
      const seenRequired = new Set<string>();
      zipFile.once("error", () => rejectSafely(failure("docx_invalid_archive", "DOCX 压缩结构无效。")));
      zipFile.on("entry", (entry: Entry) => {
        if (settled) return;
        entryCount += 1;
        const ratio = entry.uncompressedSize === 0 ? 0 : entry.uncompressedSize / Math.max(1, entry.compressedSize);
        const unixMode = (entry.externalFileAttributes >>> 16) & 0o170000;
        const lowerName = entry.fileName.toLowerCase();
        if (
          unsafeZipPath(entry.fileName) || entry.isEncrypted() || ![0, 8].includes(entry.compressionMethod) || unixMode === 0o120000 ||
          lowerName === "word/vbaproject.bin" || lowerName.startsWith("word/embeddings/") || lowerName.startsWith("word/activex/")
        ) {
          rejectSafely(failure("docx_unsafe_archive", "DOCX 包含不允许的内部结构。"));
          return;
        }
        if (
          entry.uncompressedSize > knowledgeImportLimits.maximumDocxEntryBytes ||
          ratio > knowledgeImportLimits.maximumDocxCompressionRatio
        ) {
          rejectSafely(failure("docx_unsafe_archive", "DOCX 解压规模或压缩比超过安全上限。"));
          return;
        }
        uncompressedBytes += entry.uncompressedSize;
        if (uncompressedBytes > knowledgeImportLimits.maximumDocxUncompressedBytes) {
          rejectSafely(failure("docx_unsafe_archive", "DOCX 解压总量超过安全上限。"));
          return;
        }
        if (requiredEntries.has(entry.fileName)) {
          if (seenRequired.has(entry.fileName)) {
            rejectSafely(failure("docx_unsafe_archive", "DOCX 包含重复的关键内部文件。"));
            return;
          }
          seenRequired.add(entry.fileName);
          void consumeEntry(zipFile, entry).then(() => zipFile.readEntry()).catch(() => rejectSafely(failure("docx_invalid_archive", "DOCX 关键内部文件无法读取。")));
          return;
        }
        zipFile.readEntry();
      });
      zipFile.once("end", () => {
        if (settled) return;
        if (seenRequired.size !== requiredEntries.size) {
          rejectSafely(failure("docx_missing_structure", "DOCX 缺少必要的 Word 文档结构。"));
          return;
        }
        settled = true;
        cleanup();
        resolve({ entryCount, uncompressedBytes });
      });
      zipFile.readEntry();
    });
  });
}

async function parseDocx(buffer: Buffer, signal?: AbortSignal) {
  await withTimeout(inspectDocxArchive(buffer, signal), signal);
  try {
    const result = await withTimeout(mammoth.extractRawText({ buffer }), signal);
    return { text: normalizeExtractedText(result.value), warned: result.messages.length > 0 };
  } catch (error) {
    if (isParserFailure(error)) throw error;
    throw failure("docx_parse_error", "DOCX 正文无法解析或文件结构已损坏。");
  }
}

/**
 * Server-side parser for untrusted enterprise knowledge uploads. The returned
 * errors and warnings are stable safe codes; parser stacks and local paths are
 * deliberately discarded.
 */
async function parseKnowledgeFileWithinLimits(input: ParseKnowledgeFileInput): Promise<ParseKnowledgeFileResult> {
  try {
    const fileName = safeFileName(input.fileName);
    if (!fileName) return { ok: false, error: failure("invalid_file_name", "文件名无效或包含路径信息。") };
    const extension = extensionOf(fileName);
    if (!extension) return { ok: false, error: failure("unsupported_file_type", "仅支持 TXT、Markdown、PDF 和 DOCX 文件。") };
    const buffer = asBuffer(input.buffer);
    if (buffer.length === 0) return { ok: false, error: failure("empty_content", "文件为空。") };
    if (buffer.length > knowledgeImportLimits.maximumFileBytes) {
      return { ok: false, error: failure("file_too_large", "单个文件不能超过 5 MB。") };
    }
    const mimeType = normalizedMimeType(input.mimeType);
    if (!mimeMatches(extension, mimeType)) {
      return { ok: false, error: failure("mime_mismatch", "文件扩展名与 MIME 类型不一致。") };
    }
    if ((extension === ".txt" || extension === ".md") && (hasPdfSignature(buffer) || hasZipSignature(buffer))) {
      return { ok: false, error: failure("signature_mismatch", "文本文件的实际结构与扩展名不一致。") };
    }
    if (extension === ".pdf" && !hasPdfSignature(buffer)) {
      return { ok: false, error: failure("signature_mismatch", "文件不是有效的 PDF 结构。") };
    }
    if (extension === ".docx" && !hasZipSignature(buffer)) {
      return { ok: false, error: failure("signature_mismatch", "文件不是有效的 DOCX 结构。") };
    }

    const warnings: KnowledgeFileWarningCode[] = [];
    let text: string;
    if (extension === ".txt" || extension === ".md") text = await parseUtf8(buffer);
    else if (extension === ".pdf") text = await parsePdf(buffer, input.signal);
    else {
      const parsed = await parseDocx(buffer, input.signal);
      text = parsed.text;
      if (parsed.warned) warnings.push("docx_parser_warning");
    }
    const invalidText = validateExtractedText(text);
    if (invalidText) return { ok: false, error: invalidText };
    if (extension === ".pdf" && text.length / buffer.length < 0.002) warnings.push("pdf_low_text_density");

    const title = titleFromFileName(fileName);
    const quality = buildKnowledgeImportPreview({ title, content: text, fileKind: extension, fileSizeBytes: buffer.length });
    if (!quality.canImport) {
      const issue = quality.warnings[0];
      const code = issue?.code === "chunk_count_exceeded" ? "chunk_count_exceeded" : issue?.code === "content_too_long" ? "extracted_content_too_large" : "abnormal_control_characters";
      return { ok: false, error: failure(code, issue?.message ?? "文件正文不符合导入规则。") };
    }
    return {
      ok: true,
      value: { text, mimeType: canonicalMimeType[extension], title, fileKind: fileKindByExtension[extension], warnings, quality },
    };
  } catch (error) {
    if (isParserFailure(error)) return { ok: false, error };
    return { ok: false, error: failure("docx_parse_error", "文件解析失败，请检查文件后重试。") };
  }
}

export async function parseKnowledgeFile(input: ParseKnowledgeFileInput): Promise<ParseKnowledgeFileResult> {
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  if (input.signal?.aborted) {
    return { ok: false, error: failure("parser_cancelled", "文件解析已取消。") };
  }
  input.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, knowledgeImportLimits.parserTimeoutMs);
  try {
    const result = await parseKnowledgeFileWithinLimits({ ...input, signal: controller.signal });
    return timedOut
      ? { ok: false, error: failure("parser_timeout", "文件解析超时，请缩小文件后重试。") }
      : result;
  } catch (error) {
    if (timedOut) return { ok: false, error: failure("parser_timeout", "文件解析超时，请缩小文件后重试。") };
    if (isParserFailure(error)) return { ok: false, error };
    return { ok: false, error: failure("docx_parse_error", "文件解析失败，请检查文件后重试。") };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onExternalAbort);
  }
}
