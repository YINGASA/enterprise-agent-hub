import { describe, expect, it } from "vitest";
import { sanitizeAgentStreamResult } from "@/lib/agent/streamSafety";
import type { AgentApiResponse } from "@/types";

describe("stream completion safety", () => {
  it("removes retrieved bodies, tool payloads, step payloads, and service configuration", () => {
    const result = {
      question: "当前问题",
      route: { scenario: "general", intent: "general_chat", needRag: true, toolsNeeded: [], confidence: 1, reason: "route" },
      steps: [{ id: "step", name: "generate", type: "response", status: "success", input: { prompt: "secret prompt" }, output: { raw: "raw model result" }, durationMs: 1 }],
      ragAnswer: {
        question: "当前问题", answer: "依据", mode: "mock-rag", createdAt: new Date(0).toISOString(), retrievedChunks: [{ chunk: { id: "chunk", documentId: "doc", content: "private body", sourceTitle: "Doc", category: "test", chunkIndex: 0, keywords: [] }, score: 1, matchedKeywords: [] }],
        sources: [{ documentId: "doc", title: "Doc", category: "test", chunkIndexes: [0], contentPreview: "private preview", tags: ["private"] }],
        retrievalMetadata: { query: { originalQuery: "private query", normalizedQuery: "private", keywords: [], expandedKeywords: [], phrases: [] }, topK: 5, candidateCount: 1, selectedChunkCount: 1, maxScore: 1, averageScore: 1, retrievalConfidence: "high", lowConfidenceRetrieval: false },
      },
      toolResults: [{ tool: "searchPolicy", status: "success", input: { keyword: "private" }, data: { raw: "private" }, executedAt: new Date(0).toISOString() }],
      finalAnswer: "安全回答",
      structuredOutput: { scenario: "general", intent: "general_chat", answer: "安全回答", evidence: [], toolsUsed: [], sources: [], confidence: 1, riskLevel: "low", nextAction: "none" },
      createdAt: new Date(0).toISOString(), mode: "mock-agent",
      api: { requestedMode: "real", responseMode: "real", provider: "openai-compatible", model: "private-model", requestUrl: "https://private.invalid", rawContentPreview: "private raw", streamingRequested: true, streamingUsed: true, streamFallback: false, streamDeltaCount: 2 },
    } satisfies AgentApiResponse;
    const safe = sanitizeAgentStreamResult(result);
    expect(safe.ragAnswer?.retrievedChunks).toEqual([]);
    expect(safe.ragAnswer?.sources[0]).not.toHaveProperty("contentPreview");
    expect(safe.ragAnswer).not.toHaveProperty("retrievalMetadata");
    expect(safe.toolResults[0]).toMatchObject({ input: {} });
    expect(safe.toolResults[0]).not.toHaveProperty("data");
    expect(safe.steps[0]).toMatchObject({ input: {}, output: {} });
    expect(safe.api).not.toHaveProperty("provider");
    expect(safe.api).not.toHaveProperty("rawContentPreview");
    expect(safe.api).toMatchObject({ streamingRequested: true, streamingUsed: true, streamDeltaCount: 2 });
  });
});
