import { afterEach, describe, expect, it, vi } from "vitest";
import { streamOpenAICompatibleChat } from "@/lib/llm";

function configureTestClient() {
  vi.stubEnv("AI_API_KEY", "test-key-not-real");
  vi.stubEnv("AI_BASE_URL", "https://example.invalid/v1");
  vi.stubEnv("AI_MODEL", "test-model");
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("HTTPS_PROXY", "");
  vi.stubEnv("HTTP_PROXY", "");
  vi.stubEnv("ALL_PROXY", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});
describe("streamOpenAICompatibleChat", () => {
  it("parses real SSE without exposing the raw event payload", async () => {
    configureTestClient();
    const body = [
      'data: {"choices":[{"delta":{"content":"{\\"answer\\":\\"你"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"好\\",\\"scenario\\":\\"general\\"}"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body.join(""), { status: 200, headers: { "content-type": "text/event-stream" } })));
    const deltas: string[] = [];
    const result = await streamOpenAICompatibleChat([{ role: "user", content: "test" }], { responseFormat: "json_object" }, (delta) => deltas.push(delta));
    expect(deltas.join("")).toBe("你好");
    expect(result).toMatchObject({ streamingUsed: true, streamFallback: false, parsedJson: { answer: "你好" }, raw: null });
  });

  it("converts an upstream HTTP failure to safe metadata", async () => {
    configureTestClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream refused request", { status: 503, statusText: "Unavailable" })));
    const result = await streamOpenAICompatibleChat([{ role: "user", content: "test" }]);
    expect(result).toMatchObject({ errorType: "http_error", httpStatus: 503, streamingUsed: false, streamFallback: false });
    expect(result.content).toBe("");
  });

  it("falls back to the existing complete call when stream is unsupported", async () => {
    configureTestClient();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("stream is unsupported", { status: 400, statusText: "Bad Request" }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"完整回答"}' } }], model: "test-model" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const deltas: string[] = [];
    const result = await streamOpenAICompatibleChat([{ role: "user", content: "test" }], { responseFormat: "json_object" }, (delta) => deltas.push(delta));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deltas).toEqual(["完整回答"]);
    expect(result).toMatchObject({ streamingUsed: false, streamFallback: true, parsedJson: { answer: "完整回答" } });
  });
});
