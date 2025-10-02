// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================
// Prevents spam and abuse by limiting message rates per client

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  maxMessages: number;    // Maximum messages allowed in window
  windowMs: number;       // Time window in milliseconds
}

/**
 * Client rate limit state
 */
interface ClientRateLimit {
  count: number;
  resetTime: number;
}

/**
 * Rate limiter class
 * Tracks message counts per client and enforces limits
 */
export class RateLimiter {
  private limits: Map<string, ClientRateLimit> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxMessages: 100, windowMs: 1000 }) {
    this.config = config;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a client is allowed to send a message
   * Returns true if allowed, false if rate limit exceeded
   */
  check(clientId: string): boolean {
    const now = Date.now();
    const limit = this.limits.get(clientId);

    // No record yet, allow and create new entry
    if (!limit) {
      this.limits.set(clientId, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    // Time window expired, reset counter
    if (now >= limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + this.config.windowMs;
      return true;
    }

    // Still within time window
    if (limit.count < this.config.maxMessages) {
      limit.count++;
      return true;
    }

    // Rate limit exceeded
    return false;
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [clientId, limit] of this.limits.entries()) {
      if (now >= limit.resetTime) {
        this.limits.delete(clientId);
      }
    }
  }

  /**
   * Get current rate limit status for a client
   */
  getStatus(clientId: string): { count: number; remaining: number; resetTime: number } | null {
    const limit = this.limits.get(clientId);
    if (!limit) {
      return null;
    }

    return {
      count: limit.count,
      remaining: Math.max(0, this.config.maxMessages - limit.count),
      resetTime: limit.resetTime,
    };
  }

  /**
   * Reset rate limit for a client
   */
  reset(clientId: string): void {
    this.limits.delete(clientId);
  }
}
