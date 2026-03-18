import type { IncomingHttpHeaders } from "http";

export type RateLimitRule = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitBucket = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getForwardedIp(headers: IncomingHttpHeaders): string | null {
  const forwarded = headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0];
    if (typeof first === "string" && first.length > 0) {
      return first.split(",")[0]?.trim() || null;
    }
  }

  return null;
}

export function getClientIdentity(
  headers: IncomingHttpHeaders,
  fallbackIp: string | undefined,
  userId: number | null
): string {
  if (userId !== null) return `user:${userId}`;

  const ip = getForwardedIp(headers) || fallbackIp || "unknown-ip";
  return `ip:${ip}`;
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function applyRateLimit(scope: string, identity: string, rule: RateLimitRule): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
  resetAt: number;
} {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const bucketKey = `${scope}:${identity}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + rule.windowMs;
    buckets.set(bucketKey, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: Math.max(0, rule.maxRequests - 1),
      retryAfterMs: rule.windowMs,
      limit: rule.maxRequests,
      resetAt,
    };
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);

  const allowed = existing.count <= rule.maxRequests;
  const retryAfterMs = Math.max(0, existing.resetAt - now);

  return {
    allowed,
    remaining: Math.max(0, rule.maxRequests - existing.count),
    retryAfterMs,
    limit: rule.maxRequests,
    resetAt: existing.resetAt,
  };
}
