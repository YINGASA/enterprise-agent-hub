import { describe, expect, it } from "vitest";
import { runAgentApiPipeline } from "@/lib/agent/api";

describe("mock multi-turn context", () => {
  it("uses recent order-return context for a deterministic follow-up", async () => {
    const result = await runAgentApiPipeline("那需要准备什么材料？", "mock", [], { messages: [{ role: "user", content: "订单10001可以退货吗？" }, { role: "assistant", content: "可以申请退货。" }] });
    expect(result.finalAnswer).toContain("订单号");
    expect(result.finalAnswer).toContain("商品及包装状态");
    expect(result.route).toMatchObject({ scenario: "ecommerce", intent: "policy_check" });
    expect(result.structuredOutput).toMatchObject({ scenario: "ecommerce", intent: "policy_check", needsClarification: false });
    expect(result.api).toMatchObject({ contextApplied: true, contextMessageCount: 2 });
  });

  it("does not inherit order context when a new conversation has no messages", async () => {
    const result = await runAgentApiPipeline("那需要准备什么材料？", "mock", [], { messages: [] });
    expect(result.finalAnswer).not.toContain("结合刚才的订单退货语境");
    expect(result.structuredOutput.needsClarification).toBe(true);
    expect(result.api.contextApplied).toBe(false);
  });

  it("keeps the current explicit question authoritative over unrelated history", async () => {
    const result = await runAgentApiPipeline("公司差旅报销需要什么材料？", "mock", [], { messages: [{ role: "user", content: "订单10001可以退货吗？" }] });
    expect(result.route.scenario).toBe("enterprise");
    expect(result.finalAnswer).not.toContain("结合刚才的订单退货语境");
  });
});
