import { describe, expect, it, vi } from "vitest";
import { copyAnswerText } from "@/lib/chat/messageActions";

describe("message actions", () => {
  it("copies only the supplied answer body through Clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(copyAnswerText("回答正文\n第二行", { writeText }, undefined)).resolves.toEqual({ ok: true });
    expect(writeText).toHaveBeenCalledWith("回答正文\n第二行");
  });

  it("uses a plain-text fallback when Clipboard API is unavailable", async () => {
    const textarea = { value: "", style: {} as CSSStyleDeclaration, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() } as unknown as HTMLTextAreaElement;
    const copyDocument = {
      body: { appendChild: vi.fn() } as unknown as HTMLElement,
      createElement: vi.fn(() => textarea),
      execCommand: vi.fn(() => true),
    } as unknown as Pick<Document, "body" | "createElement" | "execCommand">;
    await expect(copyAnswerText("原始安全正文", undefined, copyDocument)).resolves.toEqual({ ok: true });
    expect(textarea.value).toBe("原始安全正文");
    expect(copyDocument.execCommand).toHaveBeenCalledWith("copy");
    expect(textarea.remove).toHaveBeenCalled();
  });

  it("returns a safe, non-blocking failure", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard detail"));
    await expect(copyAnswerText("正文", { writeText }, undefined)).resolves.toEqual({ ok: false, error: "复制失败，请手动选择回答文本。" });
  });

  it("cleans up fallback nodes even when the legacy copy command throws", async () => {
    const textarea = { value: "", style: {} as CSSStyleDeclaration, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() } as unknown as HTMLTextAreaElement;
    const copyDocument = {
      body: { appendChild: vi.fn() } as unknown as HTMLElement,
      createElement: vi.fn(() => textarea),
      execCommand: vi.fn(() => { throw new Error("copy blocked"); }),
    } as unknown as Pick<Document, "body" | "createElement" | "execCommand">;
    await expect(copyAnswerText("正文", undefined, copyDocument)).resolves.toEqual({ ok: false, error: "复制失败，请手动选择回答文本。" });
    expect(textarea.remove).toHaveBeenCalled();
  });
});
