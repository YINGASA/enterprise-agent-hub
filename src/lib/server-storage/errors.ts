export type StorageErrorCode =
  | "storage_unavailable"
  | "storage_misconfigured"
  | "forbidden_origin"
  | "invalid_request"
  | "not_found"
  | "revision_conflict"
  | "id_conflict"
  | "payload_too_large"
  | "internal_storage_error";

export class StorageApiError extends Error {
  readonly code: StorageErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: StorageErrorCode, status: number, message: string, retryable = false) {
    super(message);
    this.name = "StorageApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export type SafeStorageErrorResponse = {
  status: number;
  body: { ok: false; error: StorageErrorCode; message: string; retryable: boolean };
};

export function toStorageErrorResponse(error: unknown): SafeStorageErrorResponse {
  if (error instanceof StorageApiError) {
    return { status: error.status, body: { ok: false, error: error.code, message: error.message, retryable: error.retryable } };
  }
  return {
    status: 500,
    body: { ok: false, error: "internal_storage_error", message: "服务端存储操作失败，请稍后重试。", retryable: true },
  };
}

export function isPrismaErrorWithCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return (error as { code?: unknown }).code === code;
}
