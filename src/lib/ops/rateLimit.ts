import { realApiLimits, trustedClientIpHeader } from "@/lib/ops/securityLimits";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 30_000 && buckets.size < realApiLimits.maxBuckets) return;
  lastCleanupAt = now;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size <= realApiLimits.maxBuckets) return;
  const oldest = [...buckets.entries()].sort((left, right) => left[1].resetAt - right[1].resetAt);
  for (const [key] of oldest.slice(0, buckets.size - realApiLimits.maxBuckets)) buckets.delete(key);
}

export function getClientIp(request: Request) {
  if (!trustedClientIpHeader) return "anonymous";
  const value = request.headers.get(trustedClientIpHeader)?.trim();
  if (!value) return "anonymous";

  // x-forwarded-for is trusted only after an explicit deployment setting.
  if (trustedClientIpHeader === "x-forwarded-for") return value.split(",")[0]?.trim() || "anonymous";
  return value.slice(0, 128);
}

export function checkRealApiRateLimit(key: string, cost = 1) {
  const now = Date.now();
  cleanupExpiredBuckets(now);
  const limit = realApiLimits.perMinute;
  const safeCost = Number.isInteger(cost) && cost > 0 ? cost : 1;
  if (safeCost > limit) return { allowed: false, limit, remaining: 0, resetAt: now + 60_000 };

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + 60_000;
    buckets.set(key, { count: safeCost, resetAt });
    return { allowed: true, limit, remaining: Math.max(0, limit - safeCost), resetAt };
  }

  if (current.count + safeCost > limit) return { allowed: false, limit, remaining: 0, resetAt: current.resetAt };

  current.count += safeCost;
  buckets.set(key, current);
  return { allowed: true, limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
