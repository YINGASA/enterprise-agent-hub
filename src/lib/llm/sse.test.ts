import { describe, expect, it } from "vitest";
import { createOpenAiSseParser, extractJsonStringValuePrefix } from "@/lib/llm/sse";

describe("OpenAI-compatible SSE parser", () => {
  it("handles split events, multiple events, heartbeats, missing content, and DONE", () => {
    const events: Array<{ type: string; content?: string }> = [];
    const parser = createOpenAiSseParser((event) => events.push(event));
    parser.push(': ping\n\ndata: {"choices":[{"delta":{"content":"你');
    parser.push('好"}}]}\n\ndata: {"choices":[{"delta":{}}]}\n\ndata: {"choices":[{"delta":{"content":"！"}}]}\n\ndata: [DONE]\n\n');
    parser.finish();
    expect(events).toEqual([{ type: "delta", content: "你好" }, { type: "delta", content: "！" }, { type: "done" }]);
  });

  it("extracts only a decoded answer string prefix from incomplete structured JSON", () => {
    expect(extractJsonStringValuePrefix('{"scenario":"general","answer":"第一行\\n第二', "answer")).toBe("第一行\n第二");
    expect(extractJsonStringValuePrefix('{"answer":"安全\\u56de\\u7b54"}', "answer")).toBe("安全回答");
    expect(extractJsonStringValuePrefix('{"evidence":["answer"]}', "answer")).toBe("");
  });
});
