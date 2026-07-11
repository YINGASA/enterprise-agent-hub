import { describe, expect, it } from "vitest";
import { validateAgentRequest } from "@/lib/ops/agentRequest";
import { agentRequestLimits } from "@/lib/ops/securityLimits";

const validDocument = {
  id: "user-doc-1",
  title: "出差报销说明",
  category: "财务制度",
  tags: ["报销"],
  content: "出差报销需要提交发票和付款凭证。",
  sourceType: "user_paste",
};

describe("validateAgentRequest", () => {
  it("rejects missing questions and invalid modes before runtime execution", () => {
    expect(validateAgentRequest({ question: " ", mode: "mock" })).toMatchObject({ status: 400 });
    expect(validateAgentRequest({ question: "测试", mode: "unsupported" })).toMatchObject({ status: 400 });
  });

  it("enforces question and user-document payload bounds", () => {
    expect(validateAgentRequest({ question: "x".repeat(agentRequestLimits.questionChars + 1), mode: "mock" })).toMatchObject({ status: 413 });
    expect(validateAgentRequest({ question: "测试", mode: "mock", userDocuments: Array.from({ length: agentRequestLimits.userDocuments + 1 }, () => validDocument) })).toMatchObject({ status: 413 });
    expect(validateAgentRequest({ question: "测试", mode: "mock", userDocuments: [{ ...validDocument, content: "x".repeat(agentRequestLimits.documentContentChars + 1) }] })).toMatchObject({ status: 413 });
    expect(validateAgentRequest({ question: "测试", mode: "mock", userDocuments: Array.from({ length: 4 }, (_, index) => ({ ...validDocument, id: `user-doc-total-${index}`, content: "x".repeat(100_000) })) })).toMatchObject({ status: 413 });
  });

  it("accepts a bounded mock request", () => {
    expect(validateAgentRequest({ question: "报销需要什么材料？", mode: "mock", userDocuments: [validDocument] })).toMatchObject({
      question: "报销需要什么材料？",
      mode: "mock",
      userDocuments: [expect.objectContaining({ id: "user-doc-1", sourceType: "user_paste" })],
    });
  });
});
