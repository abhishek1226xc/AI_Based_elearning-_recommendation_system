import { describe, expect, it } from "vitest";
import { applyRateLimit } from "./_core/rateLimit";

describe("rate limiting", () => {
  it("blocks requests after configured max within a window", () => {
    const scope = "test-scope";
    const identity = "user:123";

    const first = applyRateLimit(scope, identity, { windowMs: 60_000, maxRequests: 2 });
    const second = applyRateLimit(scope, identity, { windowMs: 60_000, maxRequests: 2 });
    const third = applyRateLimit(scope, identity, { windowMs: 60_000, maxRequests: 2 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });
});
