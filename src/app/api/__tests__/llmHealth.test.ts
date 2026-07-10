import { beforeEach, describe, expect, it, vi } from "vitest";

const { callOpenAICompatibleChat } = vi.hoisted(() => ({ callOpenAICompatibleChat: vi.fn() }));

vi.mock("@/lib/llm", () => ({
  getLlmConfig: () => ({ isConfigured: true, missing: [] }),
  callOpenAICompatibleChat,
}));

import { GET, POST } from "@/app/api/llm/health/route";

describe("/api/llm/health", () => {
  beforeEach(() => {
    callOpenAICompatibleChat.mockResolvedValue({ parsedJson: { ok: true }, durationMs: 1, httpStatus: 200 });
  });

  it("requires POST and caches a successful probe", async () => {
    expect((await GET()).status).toBe(405);
    const first = await POST(new Request("http://test.local/api/llm/health", { method: "POST" }));
    const second = await POST(new Request("http://test.local/api/llm/health", { method: "POST" }));
    expect(first.status).toBe(200);
    expect((await second.json()).cached).toBe(true);
    expect(callOpenAICompatibleChat).toHaveBeenCalledTimes(1);
  });
});
