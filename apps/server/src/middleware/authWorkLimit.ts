// ============================================================================
// AUTH WORK LIMIT — per-IP token bucket for scrypt-priced endpoints
// ============================================================================
// D7: every rate limit was keyed on a CLIENT-SUPPLIED uid, so one host could
// rotate uids and stream password guesses, each burning a ~30ms scrypt on the
// server — stalling broadcasts for every room. This bucket is keyed on the
// connection's remote IP and is checked BEFORE any verify() or createRoom()
// spends hashing work: WS authenticate / create-room / elevate-to-dm, and the
// HTTP /assets credential check.
//
// A token bucket rather than a fixed window because the legitimate shape is a
// BURST: a whole party behind one NAT authenticating within the same few
// seconds (capacity absorbs that), while a password loop is a sustained RATE
// (the refill throttles that). Friends-scale soft launch numbers — see
// docs/planning/session-one-arc.md §7.

const AUTH_WORK_CAPACITY = 20; // burst: a full table + reconnects + typos
const AUTH_WORK_REFILL_PER_SECOND = 0.5; // sustained: 30 attempts/min per IP

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;

  constructor(options: { capacity: number; refillPerSecond: number }) {
    this.capacity = options.capacity;
    this.refillPerSecond = options.refillPerSecond;

    // Hourly sweep of buckets that have refilled to full — they hold no
    // information. Unref'd so housekeeping never keeps the process alive
    // (same discipline as RateLimiter's sweep).
    const sweep = setInterval(() => this.sweep(), 60 * 60 * 1000);
    sweep.unref?.();
  }

  /** Spend one token for `key`. False = out of tokens, refuse the work. */
  take(key: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, lastRefill: now };
    const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
    bucket.lastRefill = now;
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return true;
  }

  /**
   * Return one token — call after the guarded work SUCCEEDS. Failed guesses
   * stay charged, so a brute-force loop still drains at the refill rate, but
   * legitimate heavy use (a party reconnecting after a deploy, the docs
   * screenshot harness uploading 36 images) is net-free. A caller who holds
   * the real password can thereby spend threadpool scrypt freely — accepted:
   * the launch threat model is "people I invited" (arc §7), and the event
   * loop itself is no longer in that blast radius.
   */
  refund(key: string): void {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + 1);
  }

  private sweep(now: number = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
      if (bucket.tokens + elapsedSeconds * this.refillPerSecond >= this.capacity) {
        this.buckets.delete(key);
      }
    }
  }
}

/** The shared limiter for every auth-priced endpoint (WS and HTTP alike). */
export function createAuthWorkLimiter(): TokenBucketLimiter {
  return new TokenBucketLimiter({
    capacity: AUTH_WORK_CAPACITY,
    refillPerSecond: AUTH_WORK_REFILL_PER_SECOND,
  });
}

/**
 * Whether x-forwarded-for may be trusted. RENDER is set by the platform
 * itself (every request arrives through Render's proxy there);
 * HEROBYTE_TRUST_PROXY covers any other reverse-proxied deployment.
 */
export function isBehindTrustedProxy(): boolean {
  return process.env.RENDER === "true" || process.env.HEROBYTE_TRUST_PROXY === "true";
}

/**
 * The client IP for rate-limiting purposes.
 *
 * Behind a trusted proxy, use the LAST x-forwarded-for entry: that is the
 * peer address the trusted edge actually observed. The FIRST entry is
 * whatever the client claims — an attacker can prepend fake addresses to
 * mint fresh buckets, but cannot append past the proxy. Without a trusted
 * proxy the socket's own address is the only honest answer.
 *
 * Unknown addresses all share one bucket ("unknown"): throttling them
 * together is strictly safer than exempting them.
 */
export function clientIpFor(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustProxy: boolean = isBehindTrustedProxy(),
): string {
  if (trustProxy && forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor;
    const entries = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const last = entries.at(-1);
    if (last) return normalizeIp(last);
  }
  return remoteAddress ? normalizeIp(remoteAddress) : "unknown";
}

/** Collapse IPv4-mapped IPv6 ("::ffff:1.2.3.4") onto the IPv4 form. */
function normalizeIp(address: string): string {
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);
  return mapped ? mapped[1] : address;
}
