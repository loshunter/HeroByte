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

/**
 * Ceiling on tracked buckets. The key is attacker-influenced (any stranger
 * can mint one pre-auth) and buckets are otherwise reclaimed only by the
 * hourly sweep, so without a cap the Map grows with distinct source
 * addresses — trivial for anyone holding a routed IPv6 prefix.
 *
 * At the cap we EVICT, never refuse. Refusing unknown keys would hand an
 * address-rotating attacker a way to lock every new player out of every
 * table, which is a worse outcome than the memory it saves. Eviction is
 * safe here because a bucket at full capacity carries no information: an
 * evicted key is recreated full, exactly as if it had refilled.
 */
const MAX_TRACKED_BUCKETS = 10_000;

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

  /** Tracked bucket count — for the memory-bound test and diagnostics. */
  size(): number {
    return this.buckets.size;
  }

  /** Spend one token for `key`. False = out of tokens, refuse the work. */
  take(key: string, now: number = Date.now()): boolean {
    const existing = this.buckets.get(key);
    if (!existing && this.buckets.size >= MAX_TRACKED_BUCKETS) {
      this.evictForNewKey(now);
    }
    const bucket = existing ?? { tokens: this.capacity, lastRefill: now };
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

  /**
   * Make room for a new key. Sweep first — under an address-rotation flood
   * most buckets are already back at capacity (charged once, refilled within
   * seconds) and carry no information. If that frees nothing, drop the
   * fullest bucket: it is the one whose loss changes the least, and never a
   * bucket actively being throttled.
   */
  private evictForNewKey(now: number): void {
    this.sweep(now);
    if (this.buckets.size < MAX_TRACKED_BUCKETS) return;

    let fullestKey: string | undefined;
    let fullestTokens = -Infinity;
    for (const [key, bucket] of this.buckets) {
      const elapsedSeconds = Math.max(0, (now - bucket.lastRefill) / 1000);
      const tokens = Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
      if (tokens > fullestTokens) {
        fullestTokens = tokens;
        fullestKey = key;
      }
    }
    if (fullestKey !== undefined) this.buckets.delete(fullestKey);
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

/**
 * The bucket key for an address.
 *
 * IPv4-mapped IPv6 ("::ffff:1.2.3.4") collapses onto the IPv4 form so one
 * client cannot hold two buckets by connecting over each stack.
 *
 * Real IPv6 is keyed on its /64, not the full /128. A single ordinary
 * subscriber is routed a whole /64, so per-address keying would let one
 * host mint an unlimited supply of full budgets just by binding a new
 * source address per connection — the control would do nothing at all
 * against v6. The /64 is the smallest unit that is actually allocated,
 * which makes it the honest analogue of "one IPv4 address".
 */
function normalizeIp(address: string): string {
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(address);
  if (mapped) return mapped[1];
  if (!address.includes(":")) return address; // IPv4, or something opaque

  // Strip a zone id ("fe80::1%eth0") and any bracket/port wrapper, then
  // truncate to the first four hextets. "::" expands to zeros, so an
  // abbreviated address whose /64 is all-zero keys as "::" — correct, and
  // the same bucket a fully-written 0:0:0:0:… would land in.
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0];
  const [head, tail = ""] = bare.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const zeros = bare.includes("::") ? Math.max(0, 8 - headParts.length - tailParts.length) : 0;
  const hextets = [...headParts, ...Array(zeros).fill("0"), ...tailParts];
  return hextets
    .slice(0, 4)
    .map((h) => (h === "" ? "0" : h.toLowerCase().replace(/^0+(?=.)/, "")))
    .join(":");
}
