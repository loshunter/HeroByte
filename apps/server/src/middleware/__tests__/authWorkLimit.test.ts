// ============================================================================
// AUTH WORK LIMIT TESTS
// ============================================================================
// D7: the per-IP token bucket that meters scrypt-priced endpoints, and the
// client-IP resolution it keys on.

import { describe, expect, it, vi, afterEach } from "vitest";
import { TokenBucketLimiter, clientIpFor, isBehindTrustedProxy } from "../authWorkLimit.js";

/** Mirrors MAX_TRACKED_BUCKETS in the module under test. */
const MAX_TRACKED_BUCKETS = 10_000;

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

  it("bounds the tracked-bucket map under an address-rotation flood", () => {
    // The key is attacker-minted pre-auth, so unbounded growth is a memory
    // DoS. Buckets are evicted, never refused — refusing unknown keys would
    // let a flood lock every new player out of every table.
    const limiter = new TokenBucketLimiter({ capacity: 20, refillPerSecond: 0.5 });
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TRACKED_BUCKETS + 500; i += 1) {
      // Distinct source every time, seconds apart, i.e. a rotating attacker.
      expect(limiter.take(`2001:db8:${i}::1`, t0 + i * 1000)).toBe(true);
    }
    expect(limiter.size()).toBeLessThanOrEqual(MAX_TRACKED_BUCKETS);
  });

  it("a throttled bucket is never the one evicted to make room", () => {
    // Eviction picks the FULLEST bucket, so the victim of an active
    // throttle keeps its state while a flood churns around it.
    // Capacity 3 so the single-take filler buckets stay strictly fuller than
    // the drained victim; at capacity 1 every bucket is equally empty and
    // "fullest" would be meaningless.
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 0.0000001 });
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i += 1) limiter.take("throttled-host", t0);
    expect(limiter.take("throttled-host", t0)).toBe(false);

    for (let i = 0; i < MAX_TRACKED_BUCKETS + 100; i += 1) {
      limiter.take(`filler-${i}`, t0);
    }

    // Still throttled — its bucket survived the churn.
    expect(limiter.take("throttled-host", t0)).toBe(false);
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

  it("keys real IPv6 on the /64, so one routed prefix is one budget", () => {
    // A subscriber is routed a whole /64. Keying per-address would let one
    // host mint unlimited full budgets by binding a new source per
    // connection — the limiter would be inert against IPv6 entirely.
    const a = clientIpFor("2001:db8:1:2:aaaa:bbbb:cccc:dddd", undefined, false);
    const b = clientIpFor("2001:db8:1:2:1111:2222:3333:4444", undefined, false);
    expect(a).toBe(b);

    // A genuinely different /64 stays a different bucket.
    expect(clientIpFor("2001:db8:1:3::9", undefined, false)).not.toBe(a);
  });

  it("normalizes abbreviated, zoned and bracketed IPv6 forms to the same key", () => {
    const canonical = clientIpFor("2001:db8:0:0:1:2:3:4", undefined, false);
    expect(clientIpFor("2001:db8::1:2:3:4", undefined, false)).toBe(canonical);
    expect(clientIpFor("2001:0db8:0000:0000:1:2:3:4", undefined, false)).toBe(canonical);
    expect(clientIpFor("[2001:db8::1:2:3:4]", undefined, false)).toBe(canonical);
    expect(clientIpFor("2001:db8::1:2:3:4%eth0", undefined, false)).toBe(canonical);
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
