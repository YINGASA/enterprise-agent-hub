import { describe, expect, it } from "vitest";
import { selectHistory } from "@/lib/conversation/history-selector";

const turn = (id: number, question: string, answer = "回答") => [{ id: `u-${id}`, role: "user" as const, content: question }, { id: `a-${id}`, role: "assistant" as const, content: answer }];

describe("history selector", () => {
  it("keeps the latest four complete turns and selects relevant older turns in chronological order", () => {
    const messages = [...turn(1, "订单10001退货规则", "订单10001可申请退货"), ...turn(2, "报销制度", "需要发票"), ...turn(3, "旧问题3"), ...turn(4, "旧问题4"), ...turn(5, "最近5"), ...turn(6, "最近6")];
    const result = selectHistory({ messages, currentUserMessage: "订单10001怎么退货？" });
    expect(result.recentMessages).toHaveLength(8);
    expect(result.selectedHistory.map((message) => message.content)).toEqual(["订单10001退货规则", "订单10001可申请退货"]);
    expect(result.selectedTurnCount).toBe(1);
  });

  it("does not select unrelated or isolated assistant messages and never mutates input", () => {
    const messages = [{ id: "a", role: "assistant" as const, content: "孤立订单10001" }, ...turn(1, "报销制度")];
    const before = JSON.stringify(messages);
    const result = selectHistory({ messages, currentUserMessage: "订单10001" });
    expect(result.selectedHistory).toEqual([]);
    expect(JSON.stringify(messages)).toBe(before);
  });
});
