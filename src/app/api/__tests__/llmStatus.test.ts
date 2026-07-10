import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/llm/status/route";

describe("/api/llm/status", () => {
  it("returns only the safe configured flag", async () => {
    const response = await GET();
    const payload = await response.json();
    expect(Object.keys(payload)).toEqual(["configured"]);
    expect(typeof payload.configured).toBe("boolean");
  });
});
