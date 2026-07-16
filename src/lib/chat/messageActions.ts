export type CopyAnswerResult = { ok: true } | { ok: false; error: string };

type ClipboardLike = { writeText: (value: string) => Promise<void> };
type CopyDocument = Pick<Document, "body" | "createElement" | "execCommand">;

export async function copyAnswerText(
  answer: string,
  clipboard: ClipboardLike | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
  copyDocument: CopyDocument | undefined = typeof document === "undefined" ? undefined : document,
): Promise<CopyAnswerResult> {
  if (!answer) return { ok: false, error: "回答内容为空，无法复制。" };
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(answer);
      return { ok: true };
    } catch {
      // Continue to the isolated plain-text fallback when the browser denies Clipboard API access.
    }
  }
  if (!copyDocument) return { ok: false, error: "复制失败，请手动选择回答文本。" };
  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = copyDocument.createElement("textarea");
    textarea.value = answer;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    copyDocument.body.appendChild(textarea);
    textarea.select();
    const copied = copyDocument.execCommand("copy");
    return copied ? { ok: true } : { ok: false, error: "复制失败，请手动选择回答文本。" };
  } catch {
    return { ok: false, error: "复制失败，请手动选择回答文本。" };
  } finally {
    textarea?.remove();
  }
}
