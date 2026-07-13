// ============================================================================
// DM ELEVATION THROTTLE
// ============================================================================
// Per-uid backoff for DM-elevation guesses. verifyDMPassword is a scrypt compare
// with no failure state of its own, and the global message rate limiter only
// caps raw message rate — so an authenticated room member could stream wrong DM
// passwords on one connection and brute-force a weak one. After a short burst of
// failures we lock that uid out for a cooldown; a success clears it. Lives in
// its own module so AuthenticationHandler stays under the file-size guard.

/** Consecutive failures from one uid before a cooldown kicks in. */
export const MAX_DM_FAILURES = 5;
/** How long the cooldown lasts once tripped. */
export const DM_LOCKOUT_MS = 15_000;

interface Attempt {
  failures: number;
  lockedUntil: number;
}

export class DMElevationThrottle {
  private readonly attempts = new Map<string, Attempt>();

  /** True while this uid is in cooldown and further attempts must be refused. */
  isLocked(uid: string, now: number): boolean {
    const attempt = this.attempts.get(uid);
    return attempt !== undefined && now < attempt.lockedUntil;
  }

  /**
   * Record a failed elevation. Once MAX_DM_FAILURES accumulate, start a cooldown
   * (and reset the counter). Returns true when this failure trips the lockout.
   */
  recordFailure(uid: string, now: number): boolean {
    const attempt = this.attempts.get(uid) ?? { failures: 0, lockedUntil: 0 };
    attempt.failures += 1;
    if (attempt.failures >= MAX_DM_FAILURES) {
      attempt.lockedUntil = now + DM_LOCKOUT_MS;
      attempt.failures = 0;
    }
    this.attempts.set(uid, attempt);
    return now < attempt.lockedUntil;
  }

  /** Clear a uid's failure record — call on a successful elevation. */
  clear(uid: string): void {
    this.attempts.delete(uid);
  }
}
