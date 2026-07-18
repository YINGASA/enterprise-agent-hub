import { describe, expect, it } from "vitest";
import { buildKnowledgeImportPreview } from "@/lib/knowledge/import-quality";
import { knowledgeImportLimits } from "@/lib/knowledge/import-limits";

describe("enterprise knowledge import quality", () => {
  it("returns stable token and chunk previews", () => {
    const input = { title: "退款流程", content: "退款流程适用于已签收订单。客户提交订单编号后，客服应核对付款状态、签收日期与退款原因。\n\n审批通过后，退款将在五个工作日内原路退回。", tags: ["退款", "售后", "订单"], suggestedQuestions: ["如何退款？"] };
    const result = buildKnowledgeImportPreview(input);
    expect(result).toEqual(buildKnowledgeImportPreview(input));
    expect(result).toMatchObject({ canImport: true, chunkCount: 2, approximateTokens: expect.any(Number) });
    expect(result.chunkPreview[0]).toEqual(expect.objectContaining({ chunkIndex: 1, approximateTokens: expect.any(Number) }));
    expect(Number.isFinite(result.approximateTokens)).toBe(true);
  });

  it("uses safe warnings for short, repeated and low-information chunks", () => {
    const result = buildKnowledgeImportPreview({ title: "模板", content: "模板\n\n模板\n\n模板" });
    expect(result.qualityLevel).toBe("needs_attention");
    expect(result.warnings.map((item) => item.code)).toEqual(expect.arrayContaining(["content_too_short", "duplicate_chunks", "low_information"]));
    expect(JSON.stringify(result.warnings)).not.toContain("模板");
  });

  it("rejects empty, control, oversized and excessive-chunk text", () => {
    expect(buildKnowledgeImportPreview({ title: "empty", content: "" })).toMatchObject({ canImport: false, warnings: [{ code: "empty_content" }] });
    expect(buildKnowledgeImportPreview({ title: "control", content: "safe\u0000bad" })).toMatchObject({ canImport: false, warnings: [{ code: "abnormal_control_characters" }] });
    expect(buildKnowledgeImportPreview({ title: "long", content: "x".repeat(knowledgeImportLimits.maximumExtractedCharacters + 1) })).toMatchObject({ canImport: false, warnings: [{ code: "content_too_long" }] });
    const tooMany = Array.from({ length: knowledgeImportLimits.maximumChunks + 1 }, (_, index) => `line-${index}`).join("\n");
    expect(buildKnowledgeImportPreview({ title: "many", content: tooMany })).toMatchObject({ canImport: false, chunkCount: knowledgeImportLimits.maximumChunks + 1, warnings: [{ code: "chunk_count_exceeded" }] });
  });

  it("flags low-density PDFs", () => {
    const result = buildKnowledgeImportPreview({ title: "policy", content: "Policy text with useful enterprise support details.", fileKind: ".pdf", fileSizeBytes: 100_000 });
    expect(result.warnings.map((item) => item.code)).toContain("pdf_low_text_density");
  });
});
