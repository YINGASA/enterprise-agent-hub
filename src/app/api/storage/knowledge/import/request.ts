import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";
import { knowledgeImportJobLimits, type KnowledgeUploadFile } from "@/lib/server-storage/knowledgeImportRepository";
import { KnowledgeRepositoryError } from "@/lib/storage/knowledgeRepository";

export const KNOWLEDGE_IMPORT_JSON_BODY_CHARS = 120_000;

// Multipart boundaries and per-part headers add a small amount of transport
// overhead. The document bytes themselves remain constrained to 25 MiB.
const MULTIPART_OVERHEAD_BYTES = 512 * 1024;
const MAXIMUM_MULTIPART_BYTES = knowledgeImportLimits.maximumBatchBytes + MULTIPART_OVERHEAD_BYTES;
const MAXIMUM_MIME_TYPE_CHARACTERS = 160;

function invalidRequest(message: string, code = "invalid_knowledge_import_request"): never {
  throw new KnowledgeRepositoryError(message, 400, code);
}

function payloadTooLarge(message: string): never {
  throw new KnowledgeRepositoryError(message, 413, "knowledge_import_payload_too_large");
}

function safeOptionalIdentifier(value: FormDataEntryValue | null, label: string, maximumCharacters: number) {
  if (value === null) return undefined;
  if (typeof value !== "string") invalidRequest(`${label}格式无效。`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximumCharacters || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    invalidRequest(`${label}格式无效。`);
  }
  return normalized;
}

export function sanitizeImportJobId(value: unknown) {
  if (typeof value !== "string") invalidRequest("导入任务标识无效。", "invalid_knowledge_import_id");
  const id = value.trim();
  if (!id || id.length > 128 || /[\u0000-\u001f\u007f]/u.test(id)) {
    invalidRequest("导入任务标识无效。", "invalid_knowledge_import_id");
  }
  return id;
}

export async function readKnowledgeImportMultipart(request: Request): Promise<{
  files: KnowledgeUploadFile[];
  knowledgePackId?: string;
  idempotencyKey: string;
}> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;") || !contentType.includes("boundary=")) {
    invalidRequest("批量导入请求必须使用 multipart/form-data。", "invalid_import_content_type");
  }

  const suppliedLength = request.headers.get("content-length");
  if (suppliedLength === null) {
    invalidRequest("上传请求缺少有效大小标记。", "invalid_content_length");
  }
  const announcedBytes = Number(suppliedLength);
  if (!Number.isSafeInteger(announcedBytes) || announcedBytes <= 0) {
    invalidRequest("上传请求大小标记无效。", "invalid_content_length");
  }
  if (announcedBytes > MAXIMUM_MULTIPART_BYTES) payloadTooLarge("单批上传总大小不能超过 25MB。");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    invalidRequest("无法读取批量导入文件。", "invalid_import_multipart");
  }

  const allowedFields = new Set(["files", "knowledgePackId", "idempotencyKey"]);
  for (const key of form.keys()) {
    if (!allowedFields.has(key)) {
      invalidRequest(key === "workspaceId" ? "工作区由服务端会话确定。" : "批量导入请求包含未知字段。");
    }
  }

  if (form.getAll("knowledgePackId").length > 1 || form.getAll("idempotencyKey").length > 1) {
    invalidRequest("批量导入请求包含重复字段。");
  }

  const rawFiles = form.getAll("files");
  if (rawFiles.length === 0 || rawFiles.length > knowledgeImportLimits.maximumBatchFiles) {
    invalidRequest(`单批必须包含 1 至 ${knowledgeImportLimits.maximumBatchFiles} 个文件。`, "invalid_import_batch");
  }

  const files: KnowledgeUploadFile[] = [];
  let totalBytes = 0;
  for (const rawFile of rawFiles) {
    if (!(rawFile instanceof File)) invalidRequest("批量导入的 files 字段必须是文件。", "invalid_import_file");
    if (
      !rawFile.name
      || rawFile.name.length > knowledgeImportLimits.maximumFileNameCharacters
      || /[\\/\u0000-\u001f\u007f]/u.test(rawFile.name)
    ) {
      invalidRequest("文件名无效或包含路径字符。", "invalid_import_file_name");
    }
    if (rawFile.type.length > MAXIMUM_MIME_TYPE_CHARACTERS || /[\u0000-\u001f\u007f]/u.test(rawFile.type)) {
      invalidRequest("文件 MIME 类型无效。", "invalid_import_mime_type");
    }
    if (rawFile.size > knowledgeImportLimits.maximumFileBytes) payloadTooLarge("单个文件不能超过 5MB。");
    totalBytes += rawFile.size;
    if (totalBytes > knowledgeImportLimits.maximumBatchBytes) payloadTooLarge("单批上传总大小不能超过 25MB。");
    const bytes = new Uint8Array(await rawFile.arrayBuffer());
    if (bytes.byteLength !== rawFile.size) invalidRequest("文件读取不完整，请重新选择文件。", "invalid_import_file");
    files.push({ fileName: rawFile.name, mimeType: rawFile.type, sizeBytes: rawFile.size, bytes });
  }

  const idempotencyKey = safeOptionalIdentifier(
    form.get("idempotencyKey"),
    "幂等标识",
    knowledgeImportJobLimits.idempotencyKeyCharacters,
  );
  if (!idempotencyKey) invalidRequest("批量导入请求缺少幂等标识。", "invalid_idempotency_key");

  return {
    files,
    knowledgePackId: safeOptionalIdentifier(form.get("knowledgePackId"), "知识包标识", 128),
    idempotencyKey,
  };
}
