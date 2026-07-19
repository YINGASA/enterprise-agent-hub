import { describe, expect, it } from "vitest";
import { classifyStorageFailure, StorageApiError, isPrismaErrorWithCode, toStorageErrorResponse } from "@/lib/server-storage/errors";

describe("storage errors", () => {
  it("returns only an explicitly safe API error shape", () => {
    expect(toStorageErrorResponse(new StorageApiError("revision_conflict", 409, "数据已更新，请刷新后重试。"))).toEqual({
      status: 409,
      body: { ok: false, error: "revision_conflict", message: "数据已更新，请刷新后重试。", retryable: false },
    });
  });

  it("does not expose unknown database errors", () => {
    const response = toStorageErrorResponse(new Error("postgresql://private-connection-value"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response)).not.toContain("private-connection-value");
  });

  it("recognizes Prisma error codes without trusting arbitrary messages", () => {
    expect(isPrismaErrorWithCode({ code: "P2002", message: "private" }, "P2002")).toBe(true);
    expect(isPrismaErrorWithCode({ code: "P2025" }, "P2002")).toBe(false);
  });

  it("classifies database failures without returning private messages or stacks", () => {
    expect(classifyStorageFailure({ code: "P1001", message: "private connection" })).toBe("unavailable");
    expect(classifyStorageFailure({ code: "P1008", message: "private query" })).toBe("timeout");
    expect(classifyStorageFailure({ code: "P2024", message: "private pool" })).toBe("pool_exhausted");
    expect(classifyStorageFailure({ code: "P2028", message: "private transaction" })).toBe("transaction_failed");
    expect(classifyStorageFailure({ code: "P2034", message: "private conflict" })).toBe("conflict");
    expect(classifyStorageFailure(new Error("postgresql://private"))).toBe("unknown_storage_error");
    expect(JSON.stringify([
      classifyStorageFailure({ code: "P1001", message: "postgresql://private" }),
      classifyStorageFailure(new Error("postgresql://private")),
    ])).not.toContain("private");
  });
});
