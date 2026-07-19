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

export type SafeStorageFailureCategory =
  | "unavailable"
  | "timeout"
  | "conflict"
  | "transaction_failed"
  | "pool_exhausted"
  | "unknown_storage_error";

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

/**
 * Converts database failures to a small, log-safe category. Database messages
 * and stacks are deliberately ignored because they may contain connection or
 * schema details.
 */
export function classifyStorageFailure(error: unknown): SafeStorageFailureCategory {
  if (error instanceof StorageApiError) {
    if (error.code === "revision_conflict" || error.code === "id_conflict") return "conflict";
    if (error.code === "storage_unavailable" || error.code === "storage_misconfigured") return "unavailable";
    return "unknown_storage_error";
  }
  if (typeof error !== "object" || error === null || !("code" in error)) return "unknown_storage_error";
  const code = (error as { code?: unknown }).code;
  if (code === "P2024") return "pool_exhausted";
  if (code === "P1002" || code === "P1008") return "timeout";
  if (code === "P2034" || code === "P2002") return "conflict";
  if (code === "P2028") return "transaction_failed";
  if (code === "P1000" || code === "P1001" || code === "P1017") return "unavailable";
  return "unknown_storage_error";
}
