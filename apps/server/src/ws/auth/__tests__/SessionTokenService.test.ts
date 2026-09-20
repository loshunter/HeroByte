// ============================================================================
// SESSION TOKEN SERVICE — unit tests
// ============================================================================
// The token is the ONLY thing that distinguishes "the same session came back"
// from "someone else who knows the room password claims that uid". Every
// branch of verify() is a security boundary, so every branch is pinned.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionTokenService, SESSION_TOKEN_GRACE_MS } from "../SessionTokenService.js";

describe("SessionTokenService", () => {
  let tokens: SessionTokenService;
  const T0 = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    tokens = new SessionTokenService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mints a 256-bit base64url token that verifies for its uid and room", () => {
    const token = tokens.mint("dave", "room-a");

    // 32 random bytes → 43 base64url chars, no padding, URL-safe alphabet.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokens.verify("dave", "room-a", token)).toBe(true);
  });

  it("mints a different token every time", () => {
    const seen = new Set(Array.from({ length: 50 }, (_, i) => tokens.mint(`u${i}`, "r")));
    expect(seen.size).toBe(50);
  });

  it("refuses a wrong token, an absent token, and a non-string token", () => {
    const token = tokens.mint("dave", "room-a");
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");

    expect(tokens.verify("dave", "room-a", tampered)).toBe(false);
    expect(tokens.verify("dave", "room-a", undefined)).toBe(false);
    expect(tokens.verify("dave", "room-a", "")).toBe(false);
    expect(tokens.verify("dave", "room-a", 12345)).toBe(false);
    expect(tokens.verify("dave", "room-a", { token })).toBe(false);
  });

  it("refuses a token of a different length without throwing", () => {
    // timingSafeEqual throws on unequal buffers; hashing first makes the
    // lengths equal by construction, so a stranger's short or long guess is a
    // clean false rather than an exception on the auth path.
    tokens.mint("dave", "room-a");
    expect(tokens.verify("dave", "room-a", "short")).toBe(false);
    expect(tokens.verify("dave", "room-a", "x".repeat(512))).toBe(false);
  });

  it("binds the token to the uid it was minted for", () => {
    const daveToken = tokens.mint("dave", "room-a");
    tokens.mint("erin", "room-a");

    expect(tokens.verify("erin", "room-a", daveToken)).toBe(false);
    expect(tokens.verify("nobody", "room-a", daveToken)).toBe(false);
  });

  it("binds the token to the table it was minted for", () => {
    const token = tokens.mint("dave", "room-a");

    expect(tokens.verify("dave", "room-b", token)).toBe(false);
    expect(tokens.verify("dave", "default", token)).toBe(false);
    expect(tokens.verify("dave", "room-a", token)).toBe(true);
  });

  describe("matches() — the takeover question, table-agnostic", () => {
    it("accepts the uid's token whatever table the session is in", () => {
      const token = tokens.mint("dave", "room-a");

      expect(tokens.matches("dave", token)).toBe(true);
      // verify() is the table-bound question; matches() deliberately is not.
      expect(tokens.verify("dave", "room-b", token)).toBe(false);
    });

    it("refuses a wrong, absent, foreign, or expired token exactly as verify does", () => {
      const token = tokens.mint("dave", "room-a");
      tokens.mint("erin", "room-a");
      const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");

      expect(tokens.matches("dave", tampered)).toBe(false);
      expect(tokens.matches("dave", undefined)).toBe(false);
      expect(tokens.matches("erin", token)).toBe(false);
      tokens.detach("dave", T0);
      expect(tokens.matches("dave", token, T0 + SESSION_TOKEN_GRACE_MS + 1)).toBe(false);
    });
  });

  describe("one proof per table (a DM who visits another table keeps the first)", () => {
    it("minting for one table does not invalidate another table's token", () => {
      const keep = tokens.mint("dave", "the-keep");
      const dragons = tokens.mint("dave", "dragons-den");

      // Both live — the second mint did not clobber the first.
      expect(tokens.verify("dave", "the-keep", keep)).toBe(true);
      expect(tokens.verify("dave", "dragons-den", dragons)).toBe(true);
      // Each stays bound to its own table.
      expect(tokens.verify("dave", "dragons-den", keep)).toBe(false);
      expect(tokens.verify("dave", "the-keep", dragons)).toBe(false);
    });

    it("matches() accepts ANY of the uid's live tokens (the table-agnostic takeover proof)", () => {
      const keep = tokens.mint("dave", "the-keep");
      const dragons = tokens.mint("dave", "dragons-den");

      expect(tokens.matches("dave", keep)).toBe(true);
      expect(tokens.matches("dave", dragons)).toBe(true);
    });

    it("detach stamps every table's record; all expire together after the grace window", () => {
      const keep = tokens.mint("dave", "the-keep", T0);
      const dragons = tokens.mint("dave", "dragons-den", T0);
      tokens.detach("dave", T0 + 1_000);

      const inside = T0 + 1_000 + SESSION_TOKEN_GRACE_MS - 1;
      expect(tokens.verify("dave", "the-keep", keep, inside)).toBe(true);
      expect(tokens.verify("dave", "dragons-den", dragons, inside)).toBe(true);
      const after = T0 + 1_000 + SESSION_TOKEN_GRACE_MS + 1;
      expect(tokens.verify("dave", "the-keep", keep, after)).toBe(false);
      expect(tokens.verify("dave", "dragons-den", dragons, after)).toBe(false);
      expect(tokens.has("dave", after)).toBe(false);
    });

    it("a mint after detach re-attaches EVERY table (the session is live again)", () => {
      const keep = tokens.mint("dave", "the-keep", T0);
      tokens.mint("dave", "dragons-den", T0);
      tokens.detach("dave", T0 + 1_000);
      // Reconnecting to dragons-den re-attaches the whole session...
      tokens.mint("dave", "dragons-den", T0 + 2_000);

      // ...so the-keep's token is good again far past the original grace window.
      const farFuture = T0 + 2_000 + 5 * SESSION_TOKEN_GRACE_MS;
      expect(tokens.verify("dave", "the-keep", keep, farFuture)).toBe(true);
    });

    it("revokeRoom drops one table's proof for every uid, keeping the others", () => {
      const daveKeep = tokens.mint("dave", "the-keep");
      const daveHall = tokens.mint("dave", "default");
      const erinHall = tokens.mint("erin", "default");

      tokens.revokeRoom("default");

      expect(tokens.verify("dave", "default", daveHall)).toBe(false);
      expect(tokens.verify("erin", "default", erinHall)).toBe(false);
      expect(tokens.verify("dave", "the-keep", daveKeep)).toBe(true);
    });
  });

  it("rotation: a re-mint invalidates the previous token", () => {
    const first = tokens.mint("dave", "room-a");
    const second = tokens.mint("dave", "room-a");

    expect(first).not.toBe(second);
    expect(tokens.verify("dave", "room-a", first)).toBe(false);
    expect(tokens.verify("dave", "room-a", second)).toBe(true);
  });

  it("revoke forgets the uid outright", () => {
    const token = tokens.mint("dave", "room-a");
    tokens.revoke("dave");

    expect(tokens.verify("dave", "room-a", token)).toBe(false);
    expect(tokens.has("dave")).toBe(false);
  });

  describe("detach + grace window", () => {
    it("a detached token still verifies inside the grace window", () => {
      const token = tokens.mint("dave", "room-a");
      tokens.detach("dave", T0 + 1_000);

      const insideWindow = T0 + 1_000 + SESSION_TOKEN_GRACE_MS - 1;
      expect(tokens.verify("dave", "room-a", token, insideWindow)).toBe(true);
      expect(tokens.has("dave", insideWindow)).toBe(true);
    });

    it("a detached token stops verifying once the grace window closes", () => {
      const token = tokens.mint("dave", "room-a");
      tokens.detach("dave", T0 + 1_000);

      const afterWindow = T0 + 1_000 + SESSION_TOKEN_GRACE_MS + 1;
      expect(tokens.verify("dave", "room-a", token, afterWindow)).toBe(false);
      expect(tokens.has("dave", afterWindow)).toBe(false);
      // And the expired record is gone, not lingering as a zombie.
      expect(tokens.size).toBe(0);
    });

    it("a second detach does not extend the window", () => {
      const token = tokens.mint("dave", "room-a");
      tokens.detach("dave", T0 + 1_000);
      tokens.detach("dave", T0 + SESSION_TOKEN_GRACE_MS); // a late duplicate cleanup

      const afterFirstWindow = T0 + 1_000 + SESSION_TOKEN_GRACE_MS + 1;
      expect(tokens.verify("dave", "room-a", token, afterFirstWindow)).toBe(false);
    });

    it("a re-mint after detach re-attaches: the new token has no expiry", () => {
      tokens.mint("dave", "room-a");
      tokens.detach("dave", T0);
      const fresh = tokens.mint("dave", "room-a", T0 + 60_000);

      const farFuture = T0 + 10 * SESSION_TOKEN_GRACE_MS;
      expect(tokens.verify("dave", "room-a", fresh, farFuture)).toBe(true);
    });

    it("a token that was never detached does not expire, however long the session runs", () => {
      const token = tokens.mint("dave", "room-a");
      const farFuture = T0 + 100 * SESSION_TOKEN_GRACE_MS;
      expect(tokens.verify("dave", "room-a", token, farFuture)).toBe(true);
    });

    it("detach of an unknown uid is a no-op", () => {
      expect(() => tokens.detach("ghost")).not.toThrow();
      expect(tokens.size).toBe(0);
    });
  });

  describe("purge", () => {
    it("sweeps expired records on the mint path", () => {
      tokens.mint("old-1", "r", T0);
      tokens.mint("old-2", "r", T0);
      tokens.detach("old-1", T0);
      tokens.detach("old-2", T0);
      expect(tokens.size).toBe(2);

      // Minting for someone else after the window sweeps the two stale ones.
      const later = T0 + SESSION_TOKEN_GRACE_MS + 2 * 60_000;
      tokens.mint("new", "r", later);
      expect(tokens.size).toBe(1);
    });

    it("purgeExpired reports how many it removed and runs at most once a minute", () => {
      tokens.mint("a", "r", T0);
      tokens.detach("a", T0);
      tokens.mint("b", "r", T0); // this mint ran the purge at T0 (nothing expired yet)

      const later = T0 + SESSION_TOKEN_GRACE_MS + 90_000;
      expect(tokens.purgeExpired(later)).toBe(1);
      // Within the same minute a second purge is skipped, not re-run...
      tokens.mint("c", "r", later + 1);
      tokens.detach("c", T0 - SESSION_TOKEN_GRACE_MS); // already expired by any clock
      expect(tokens.purgeExpired(later + 1_000)).toBe(0);
      // ...and picks the stale record up on the next eligible sweep.
      expect(tokens.purgeExpired(later + 61_000)).toBe(1);
    });
  });

  it("clear() drops every record", () => {
    tokens.mint("a", "r");
    tokens.mint("b", "r");
    tokens.clear();
    expect(tokens.size).toBe(0);
  });
});
