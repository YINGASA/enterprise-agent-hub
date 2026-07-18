import { describe, expect, it } from "vitest";
import { inspectDocxArchive, parseKnowledgeFile } from "@/lib/knowledge/file-parser";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";
import { createDocxFixture, createPdfFixture, createStoredZip } from "@/lib/knowledge/__tests__/importFixtures";

describe("enterprise knowledge file parser", () => {
  it("parses UTF-8 text, BOM and Markdown deterministically", async () => {
    await expect(parseKnowledgeFile({ fileName: "policy.txt", mimeType: "text/plain", buffer: Buffer.from("\ufeffPolicy\r\nSecond line") })).resolves.toMatchObject({ ok: true, value: { text: "Policy\nSecond line", fileKind: "txt", title: "policy" } });
    const input = { fileName: "guide.md", mimeType: "text/markdown", buffer: Buffer.from("# Guide\n\nSafe content") };
    expect(await parseKnowledgeFile(input)).toEqual(await parseKnowledgeFile(input));
  });

  it("rejects encoding, control, name, type, signature and size attacks", async () => {
    await expect(parseKnowledgeFile({ fileName: "bad.txt", mimeType: "text/plain", buffer: Buffer.from([0xc3, 0x28]) })).resolves.toMatchObject({ ok: false, error: { code: "invalid_encoding" } });
    await expect(parseKnowledgeFile({ fileName: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("safe\u0000bad") })).resolves.toMatchObject({ ok: false, error: { code: "abnormal_control_characters" } });
    await expect(parseKnowledgeFile({ fileName: "../bad.txt", mimeType: "text/plain", buffer: Buffer.from("safe") })).resolves.toMatchObject({ ok: false, error: { code: "invalid_file_name" } });
    await expect(parseKnowledgeFile({ fileName: "bad.exe", mimeType: "application/octet-stream", buffer: Buffer.from("safe") })).resolves.toMatchObject({ ok: false, error: { code: "unsupported_file_type" } });
    await expect(parseKnowledgeFile({ fileName: "bad.pdf", mimeType: "text/plain", buffer: createPdfFixture("safe") })).resolves.toMatchObject({ ok: false, error: { code: "mime_mismatch" } });
    await expect(parseKnowledgeFile({ fileName: "fake.txt", mimeType: "text/plain", buffer: createPdfFixture("safe") })).resolves.toMatchObject({ ok: false, error: { code: "signature_mismatch" } });
    await expect(parseKnowledgeFile({ fileName: "large.txt", mimeType: "text/plain", buffer: Buffer.alloc(knowledgeImportLimits.maximumFileBytes + 1, 0x61) })).resolves.toMatchObject({ ok: false, error: { code: "file_too_large" } });
    await expect(parseKnowledgeFile({ fileName: "long.txt", mimeType: "text/plain", buffer: Buffer.from("a".repeat(knowledgeImportLimits.maximumExtractedCharacters + 1)) })).resolves.toMatchObject({ ok: false, error: { code: "extracted_content_too_large" } });
  });

  it("extracts text PDFs and reports scanned or corrupt PDFs", async () => {
    await expect(parseKnowledgeFile({ fileName: "policy.pdf", mimeType: "application/pdf", buffer: createPdfFixture("Enterprise policy text") })).resolves.toMatchObject({ ok: true, value: { text: expect.stringContaining("Enterprise policy text"), fileKind: "pdf" } });
    await expect(parseKnowledgeFile({ fileName: "scan.pdf", mimeType: "application/pdf", buffer: createPdfFixture() })).resolves.toMatchObject({ ok: false, error: { code: "pdf_no_extractable_text" } });
    await expect(parseKnowledgeFile({ fileName: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-broken") })).resolves.toMatchObject({ ok: false, error: { code: "pdf_parse_error" } });
  });

  it("preflights DOCX and extracts raw text", async () => {
    const docx = createDocxFixture();
    await expect(inspectDocxArchive(docx)).resolves.toMatchObject({ entryCount: 3 });
    await expect(parseKnowledgeFile({ fileName: "policy.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx })).resolves.toMatchObject({ ok: true, value: { text: expect.stringContaining("Enterprise knowledge import works."), fileKind: "docx" } });
    await expect(parseKnowledgeFile({ fileName: "bad.docx", mimeType: "application/octet-stream", buffer: Buffer.from("PK\u0003\u0004broken", "binary") })).resolves.toMatchObject({ ok: false, error: { code: "docx_invalid_archive" } });
  });

  it("rejects unsafe, incomplete and excessive DOCX archives", async () => {
    const mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await expect(parseKnowledgeFile({ fileName: "unsafe.docx", mimeType, buffer: createDocxFixture("safe", [{ name: "../secret", content: "x" }]) })).resolves.toMatchObject({ ok: false, error: { code: expect.stringMatching(/docx_(unsafe_archive|invalid_archive)/) } });
    await expect(parseKnowledgeFile({ fileName: "macro.docx", mimeType, buffer: createDocxFixture("safe", [{ name: "word/vbaProject.bin", content: "x" }]) })).resolves.toMatchObject({ ok: false, error: { code: "docx_unsafe_archive" } });
    await expect(parseKnowledgeFile({ fileName: "missing.docx", mimeType, buffer: createStoredZip([{ name: "[Content_Types].xml", content: "x" }]) })).resolves.toMatchObject({ ok: false, error: { code: "docx_missing_structure" } });
    const extras = Array.from({ length: knowledgeImportLimits.maximumDocxEntries + 1 }, (_, index) => ({ name: `safe/${index}.txt`, content: "" }));
    await expect(parseKnowledgeFile({ fileName: "many.docx", mimeType, buffer: createDocxFixture("safe", extras) })).resolves.toMatchObject({ ok: false, error: { code: "docx_unsafe_archive" } });
  });
});
