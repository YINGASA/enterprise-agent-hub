import { beforeEach, describe, expect, it, vi } from "vitest";

const { runEvaluationSuite, recordEvaluationRun } = vi.hoisted(() => ({
  runEvaluationSuite: vi.fn(),
  recordEvaluationRun: vi.fn(),
}));

vi.mock("@/lib/evaluation", () => ({ runEvaluationSuite }));
vi.mock("@/lib/ops/storage", () => ({ recordEvaluationRun }));

import { POST } from "@/app/api/evaluation/route";

const mockResult = { summary: { total: 80, passed: 80, passRate: 100 }, mode: "mock", selectedSuite: "full", durationMs: 1 };
const request = (body: object, token?: string) => new Request("http://test.local/api/evaluation", { method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-ops-token": token } : {}) }, body: JSON.stringify(body) });

describe("POST /api/evaluation", () => {
  beforeEach(() => {
    process.env.EAH_OPS_TOKEN = "test-ops-token";
    runEvaluationSuite.mockResolvedValue(mockResult);
  });

  it("keeps full Mock evaluation public", async () => {
    const response = await POST(request({ mode: "mock", suite: "full" }));
    expect(response.status).toBe(200);
    expect(runEvaluationSuite).toHaveBeenCalledWith(expect.any(Array), "mock", "full");
    expect(runEvaluationSuite.mock.calls[0][0]).toHaveLength(80);
  });

  it("rejects unauthorized Real evaluation and oversized real suites", async () => {
    const noToken = await POST(request({ mode: "real", suite: "full" }));
    const wrongToken = await POST(request({ mode: "real", suite: "full" }, "wrong"));
    const oversized = await POST(request({ mode: "real", caseIds: ["a", "b", "c", "d", "e", "f"] }, "test-ops-token"));
    expect(noToken.status).toBe(401);
    expect(wrongToken.status).toBe(401);
    expect(oversized.status).toBe(400);
  });
});
