import { describe, expect, it } from "vitest";
import { evaluationCases } from "@/data/evaluation";
import { runEvaluationSuite } from "@/lib/evaluation";

describe("full Mock evaluation quality gate", () => {
  it("keeps the full suite above the required pass rate", async () => {
    const result = await runEvaluationSuite(evaluationCases, "mock", "full");
    console.log(`Mock evaluation: total=${result.summary.total} passed=${result.summary.passed} passRate=${result.summary.passRate}%`);
    expect(result.summary.total).toBe(80);
    expect(result.summary.passRate).toBeGreaterThanOrEqual(90);
  }, 30_000);
});
