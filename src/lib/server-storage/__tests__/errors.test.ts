import { describe, expect, it } from "vitest";
import { StorageApiError, isPrismaErrorWithCode, toStorageErrorResponse } from "@/lib/server-storage/errors";

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
});
