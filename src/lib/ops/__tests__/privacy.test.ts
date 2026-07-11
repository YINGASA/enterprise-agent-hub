import { describe, expect, it } from "vitest";
import { sanitizeQuestionPreview } from "@/lib/ops/storage";

describe("Ops question privacy", () => {
  it("never returns a complete short question", () => {
    const question = "我想报销";
    const result = sanitizeQuestionPreview(question);
    expect(result).not.toBe(question);
    expect(result).not.toContain(question);
    expect(result).toContain("已截断");
  });

  it.each([
    ["订单号", "订单10001能不能退？", "10001"],
    ["手机号", "请联系13800138000处理", "13800138000"],
    ["邮箱", "回复 user@example.com 即可", "user@example.com"],
    ["身份证", "身份证号11010519491231002X", "11010519491231002X"],
    ["长数字", "流水号987654321012345", "987654321012345"],
  ])("masks %s", (_label, question, secret) => {
    const result = sanitizeQuestionPreview(question);
    expect(result).not.toContain(secret);
    expect(result).toMatch(/脱敏/);
  });
});
