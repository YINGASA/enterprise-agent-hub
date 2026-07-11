import { describe, expect, it } from "vitest";
import { checkFeedbackRateLimit, checkRealApiRateLimit } from "@/lib/ops/rateLimit";
import { feedbackLimits, realApiLimits } from "@/lib/ops/securityLimits";

describe("in-memory rate limits", () => {
  it("limits Real API cost units without affecting a separate caller bucket", () => {
    const key = `real-test-${Date.now()}`;
    expect(checkRealApiRateLimit(key, realApiLimits.perMinute).allowed).toBe(true);
    expect(checkRealApiRateLimit(key).allowed).toBe(false);
  });

  it("limits feedback submissions independently", () => {
    const key = `feedback-test-${Date.now()}`;
    for (let index = 0; index < feedbackLimits.perMinute; index += 1) expect(checkFeedbackRateLimit(key).allowed).toBe(true);
    expect(checkFeedbackRateLimit(key).allowed).toBe(false);
  });
});
