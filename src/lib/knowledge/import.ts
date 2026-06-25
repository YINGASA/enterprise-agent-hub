import type { ImportedKnowledgeDocument, KnowledgeImportResult, KnowledgeSourceType } from "@/types";

export const MAX_IMPORT_FILE_SIZE = 1024 * 1024;
export const SUPPORTED_IMPORT_EXTENSIONS = [".txt", ".md", ".json", ".csv"] as const;

type ImportInput = {
  title: string;
  category: string;
  tags: string[];
  packId: string;
  content: string;
  sourceType: Extract<KnowledgeSourceType, "user_upload" | "user_paste">;
  originalFileName?: string;
};

function extensionOf(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function summarizeContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? normalized.slice(0, 120) + "..." : normalized;
}

function formatJsonValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parseCsvToText(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const headers = lines[0].split(",").map((item) => item.trim()).filter(Boolean);
  const rows = lines.slice(1, 21).map((line, rowIndex) => {
    const cells = line.split(",").map((item) => item.trim());
    const pairs = headers.length
      ? headers.map((header, index) => `${header}: ${cells[index] ?? ""}`).join("; ")
      : cells.join("; ");
    return `第 ${rowIndex + 1} 行：${pairs}`;
  });
  return [`CSV 表头：${headers.join("、") || "无表头"}`, ...rows].join("\n");
}

export function parseImportedContent(raw: string, fileName = "document.txt") {
  const extension = extensionOf(fileName);
  const content = raw.trim();
  if (!content) {
    return { ok: false as const, error: { code: "empty_content" as const, message: "文件或粘贴内容为空，请补充正文后再导入。" } };
  }
  if (!extension || extension === ".txt" || extension === ".md") return { ok: true as const, content };
  if (extension === ".json") {
    try {
      const parsed = JSON.parse(content) as unknown;
      return { ok: true as const, content: formatJsonValue(parsed) };
    } catch {
      return { ok: false as const, error: { code: "parse_error" as const, message: "JSON 解析失败，请确认文件内容是合法 JSON。" } };
    }
  }
  if (extension === ".csv") {
    const parsed = parseCsvToText(content);
    return parsed
      ? { ok: true as const, content: parsed }
      : { ok: false as const, error: { code: "parse_error" as const, message: "CSV 解析失败，请确认文件包含表头或有效行。" } };
  }
  return { ok: false as const, error: { code: "unsupported_file_type" as const, message: "仅支持 .txt / .md / .json / .csv 文件。" } };
}

export async function readKnowledgeFile(file: File) {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { ok: false as const, error: { code: "file_too_large" as const, message: "文件大小不能超过 1MB。" } };
  }
  const extension = extensionOf(file.name);
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(extension as (typeof SUPPORTED_IMPORT_EXTENSIONS)[number])) {
    return { ok: false as const, error: { code: "unsupported_file_type" as const, message: "仅支持 .txt / .md / .json / .csv 文件。" } };
  }
  try {
    const raw = await file.text();
    return parseImportedContent(raw, file.name);
  } catch {
    return { ok: false as const, error: { code: "parse_error" as const, message: "文件读取失败，请换一个文本格式文件重试。" } };
  }
}

export function createImportedKnowledgeDocument(input: ImportInput): KnowledgeImportResult {
  if (!input.title.trim()) {
    return { ok: false, error: { code: "missing_title", message: "请填写文档标题。" } };
  }
  if (!input.content.trim()) {
    return { ok: false, error: { code: "empty_content", message: "请粘贴正文或选择有效文件。" } };
  }
  const now = new Date().toISOString();
  const document: ImportedKnowledgeDocument = {
    id: `user-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    packId: input.packId,
    title: input.title.trim(),
    category: input.category.trim() || "用户导入",
    tags: input.tags,
    summary: summarizeContent(input.content),
    content: input.content.trim(),
    createdAt: now,
    updatedAt: now.slice(0, 10),
    source: input.sourceType === "user_upload" ? "local file" : "pasted text",
    owner: "用户导入",
    isDefault: false,
    sourceType: input.sourceType,
    originalFileName: input.originalFileName,
    importedAt: now,
  };
  return { ok: true, document };
}
