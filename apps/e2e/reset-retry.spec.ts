// The reset fixture's retry ladder, exercised WITHOUT a server.
//
// `resetRoom` runs before every spec in the suite, so when its ladder is wrong
// the failure lands on some unrelated test's name and reads like a product
// regression. It happened: a loaded run reset one connection, `request.post`
// THREW, and the loop — which only tested `!response.ok()` — never got the
// chance to retry, so `mobile-map-edit-inspect` failed with a transport stack.
//
// This imports `test` from Playwright directly rather than from `./fixtures`,
// on purpose: the auto `resetRoom` fixture would need the very server this
// spec is here to do without.
import { expect, test } from "@playwright/test";
import { postWithRetry } from "./fixtures";

/** Real timers, tiny numbers: the whole file runs in milliseconds. */
const BUDGET_MS = 2_000;
const PAUSE_MS = 1;

const landed = { ok: () => true };
const conflict = { ok: () => false };

test.describe("the reset fixture's retry ladder", () => {
  test("retries a THROWN transport error and uses the attempt that finally lands", async () => {
    let calls = 0;
    const attempt = await postWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("read ECONNRESET");
        return landed;
      },
      BUDGET_MS,
      PAUSE_MS,
    );

    expect(calls, "a thrown error must be retried, not rethrown at once").toBe(3);
    expect(attempt.error).toBeUndefined();
    expect(attempt.response?.ok()).toBe(true);
  });

  test("gives up on a post that never lands, and carries the last transport error out", async () => {
    let calls = 0;
    const attempt = await postWithRetry(
      async () => {
        calls += 1;
        throw new Error("read ECONNRESET");
      },
      50,
      PAUSE_MS,
    );

    // No response to report on — the caller must say "never reached the
    // server" rather than dereference an absent status.
    expect(attempt.response).toBeUndefined();
    expect((attempt.error as Error).message).toContain("ECONNRESET");
    expect(calls, "the budget must be spent before giving up").toBeGreaterThan(1);
  });

  test("still retries a non-ok response — the 409 the ladder was built for", async () => {
    let calls = 0;
    const attempt = await postWithRetry(
      async () => {
        calls += 1;
        return calls < 3 ? conflict : landed;
      },
      BUDGET_MS,
      PAUSE_MS,
    );

    expect(calls).toBe(3);
    expect(attempt.response?.ok()).toBe(true);
  });

  test("costs exactly one request when the first one lands", async () => {
    let calls = 0;
    const attempt = await postWithRetry(
      async () => {
        calls += 1;
        return landed;
      },
      BUDGET_MS,
      PAUSE_MS,
    );

    expect(calls, "a healthy reset must not pay for retries").toBe(1);
    expect(attempt.response?.ok()).toBe(true);
  });
});
