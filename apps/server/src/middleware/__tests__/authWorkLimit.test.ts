// ============================================================================
// AUTH WORK LIMIT TESTS
// ============================================================================
// D7: the per-IP token bucket that meters scrypt-priced endpoints, and the
// client-IP resolution it keys on.

import { describe, expect, it, vi, afterEach } from "vitest";
import { TokenBucketLimiter, clientIpFor, isBehindTrustedProxy } from "../authWorkLimit.js";

describe("TokenBucketLimiter", () => {
  it("allows a burst up to capacity, then refuses", () => {
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1 });
    const t0 = 1_000_000;
    expect(limiter.take("ip", t0)).toBe(true);
    expect(limiter.take("ip", t0)).toBe(true);
    expect(limiter.take("ip", t0)).toBe(true);
    expect(limiter.take("ip", t0)).toBe(false);
  });

  it("refills at the configured rate", () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 0.5 });
    const t0 = 1_000_000;
    limiter.take("ip", t0);
    limiter.take("ip", t0);
    expect(limiter.take("ip", t0)).toBe(false);
    // 0.5 tokens/second → one token back after 2 seconds.
    expect(limiter.take("ip", t0 + 2_000)).toBe(true);
    expect(limiter.take("ip", t0 + 2_000)).toBe(false);
  });

  it("never refills past capacity", () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 1 });
    const t0 = 1_000_000;
    limiter.take("ip", t0);
    // An hour later the bucket is full again — not 3600 tokens deep.
    expect(limiter.take("ip", t0 + 3_600_000)).toBe(true);
    expect(limiter.take("ip", t0 + 3_600_000)).toBe(true);
    expect(limiter.take("ip", t0 + 3_600_000)).toBe(false);
  });

  it("keys buckets independently", () => {
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 0.01 });
    const t0 = 1_000_000;
    expect(limiter.take("attacker", t0)).toBe(true);
    expect(limiter.take("attacker", t0)).toBe(false);
    // A different network is untouched by the attacker's exhausted bucket.
    expect(limiter.take("bystander", t0)).toBe(true);
  });

  it("refund returns a token so successes are net-free", () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 0.01 });
    const t0 = 1_000_000;
    limiter.take("ip", t0);
    limiter.take("ip", t0);
    expect(limiter.take("ip", t0)).toBe(false);
    limiter.refund("ip");
    expect(limiter.take("ip", t0)).toBe(true);
  });

  it("refund never overfills, and refunding an unknown key is a no-op", () => {
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 0.01 });
    const t0 = 1_000_000;
    limiter.refund("never-seen"); // must not create a bucket or throw
    limiter.take("ip", t0);
    limiter.refund("ip");
    limiter.refund("ip"); // already full — stays at capacity
    expect(limiter.take("ip", t0)).toBe(true);
    expect(limiter.take("ip", t0)).toBe(false);
  });
});

describe("clientIpFor", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the socket address when no proxy is trusted", () => {
    expect(clientIpFor("203.0.113.9", "1.2.3.4, 5.6.7.8", false)).toBe("203.0.113.9");
  });

  it("uses the LAST x-forwarded-for entry behind a trusted proxy", () => {
    // The first entries are client-claimed; only the last was appended by the
    // proxy we trust. Taking the first would let an attacker mint fresh
    // buckets by prepending random addresses.
    expect(clientIpFor("10.0.0.1", "9.9.9.9, 203.0.113.9", true)).toBe("203.0.113.9");
  });

  it("falls back to the socket when the trusted header is absent or empty", () => {
    expect(clientIpFor("203.0.113.9", undefined, true)).toBe("203.0.113.9");
    expect(clientIpFor("203.0.113.9", "  ,  ", true)).toBe("203.0.113.9");
  });

  it("collapses IPv4-mapped IPv6 addresses", () => {
    expect(clientIpFor("::ffff:192.0.2.7", undefined, false)).toBe("192.0.2.7");
  });

  it("returns 'unknown' when nothing is resolvable", () => {
    expect(clientIpFor(undefined, undefined, false)).toBe("unknown");
  });

  it("trust is driven by RENDER or HEROBYTE_TRUST_PROXY", () => {
    expect(isBehindTrustedProxy()).toBe(false);
    vi.stubEnv("RENDER", "true");
    expect(isBehindTrustedProxy()).toBe(true);
    vi.unstubAllEnvs();
    vi.stubEnv("HEROBYTE_TRUST_PROXY", "true");
    expect(isBehindTrustedProxy()).toBe(true);
  });
});
