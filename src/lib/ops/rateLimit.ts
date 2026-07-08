type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function limitPerMinute() {
  const raw = Number(process.env["EAH_REAL_API_RATE_LIMIT_PER_MINUTE"] ?? 12);
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function checkRealApiRateLimit(key: string) {
  const now = Date.now();
  const limit = limitPerMinute();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, limit, remaining: Math.max(0, limit - 1), resetAt: now + 60_000 };
  }

  if (current.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
