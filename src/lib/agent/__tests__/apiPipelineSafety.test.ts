import { describe, expect, it, vi } from "vitest";

const { getLlmConfig, callOpenAICompatibleChat, streamOpenAICompatibleChat } = vi.hoisted(() => ({
  getLlmConfig: vi.fn(() => ({ missing: ["missing_api_key"] })),
  callOpenAICompatibleChat: vi.fn(),
  streamOpenAICompatibleChat: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({ getLlmConfig, callOpenAICompatibleChat, streamOpenAICompatibleChat }));

import { runAgentApiPipeline } from "@/lib/agent/api";

function history() {
  return Array.from({ length: 8 }, (_, index) => [
    { id: `u-${index + 1}`, role: "user" as const, content: `订单 ORD-${index + 1} 的限制是什么？` },
    { id: `a-${index + 1}`, role: "assistant" as const, content: `订单 ORD-${index + 1} 的限制已确认。` },
  ]).flat();
}

describe("Agent API pipeline summary fallback safety", () => {
  it("keeps the single rolling-summary patch when Real mode falls back before an LLM call", async () => {
    const result = await runAgentApiPipeline("继续查询订单限制", "real", [], history());

    expect(result.api.responseMode).toBe("real_error_fallback");
    expect(result.conversationSummaryPatch).toMatchObject({
      set: { throughMessageId: "a-4", version: 1, sourceMessageCount: 8 },
    });
    expect(callOpenAICompatibleChat).not.toHaveBeenCalled();
    expect(streamOpenAICompatibleChat).not.toHaveBeenCalled();
  });
});
