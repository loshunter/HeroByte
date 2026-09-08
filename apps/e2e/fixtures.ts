import { type APIRequestContext, expect, test as base } from "@playwright/test";

const WS_HOST = process.env.E2E_WS_HOST ?? "127.0.0.1";
const WS_PORT = Number(process.env.E2E_WS_PORT ?? 8788);

/**
 * The server refuses a reset (409) while the previous test's socket is still
 * authenticated, and that teardown is asynchronous AND engine-dependent:
 * Chromium usually closes before the next test's fixture runs, WebKit usually
 * does not. A single POST therefore failed `mobile-layout.spec.ts`'s second
 * test under WebKit for a reason that had nothing to do with the test.
 *
 * Bounded on purpose — a genuinely dead server still fails, just later, and
 * with the server's own message rather than an opaque 500.
 */
const RESET_RETRY_BUDGET_MS = 3_000;
const RESET_RETRY_PAUSE_MS = 100;

/** What one attempt produced: a response, or the error the POST threw. */
export interface ResetAttempt<R> {
  response?: R;
  error?: unknown;
}

/**
 * The retry ladder, with BOTH failure shapes riding the same budget.
 *
 * A reset can fail two ways, and only one of them is a response: the server
 * answers 409 while the previous test's socket tears down, or the request
 * never completes at all and THROWS (`ECONNRESET`, `ECONNREFUSED` — observed
 * under load on `mobile-map-edit-inspect`). The original loop tested only
 * `!response.ok()`, so a thrown error escaped the budget at the very first
 * await and killed the spec outright with a transport stack, for a reason
 * that had nothing to do with the test — exactly the failure the budget
 * exists to absorb.
 *
 * Pure and injectable so it can be tested without a server (`reset-retry.spec.ts`).
 */
export async function postWithRetry<R extends { ok: () => boolean }>(
  post: () => Promise<R>,
  budgetMs = RESET_RETRY_BUDGET_MS,
  pauseMs = RESET_RETRY_PAUSE_MS,
): Promise<ResetAttempt<R>> {
  const deadline = Date.now() + budgetMs;
  let attempt = await attemptOnce(post);
  while (!attempt.response?.ok() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    attempt = await attemptOnce(post);
  }
  return attempt;
}

async function attemptOnce<R>(post: () => Promise<R>): Promise<ResetAttempt<R>> {
  try {
    return { response: await post() };
  } catch (error) {
    return { error };
  }
}

export const test = base.extend<{ resetRoom: void }>({
  resetRoom: [
    async ({ request }, use) => {
      const resetUrl = `http://${WS_HOST}:${WS_PORT}/__e2e/reset`;
      const { response, error } = await postWithRetry(() => request.post(resetUrl));

      if (!response) {
        // The budget is exhausted and the request never reached the server.
        throw new Error(
          [
            `HeroByte E2E reset never reached ${WS_HOST}:${WS_PORT}/__e2e/reset.`,
            `Retried every ${RESET_RETRY_PAUSE_MS}ms for ${RESET_RETRY_BUDGET_MS}ms; every attempt threw.`,
            `Last transport error: ${error instanceof Error ? error.message : String(error)}`,
            "Use pnpm test:e2e so the isolated E2E ports are preflighted before Playwright starts.",
          ].join("\n"),
        );
      }

      if (!response.ok()) {
        throw new Error(
          await buildResetFailureMessage(response.status(), await response.text(), request),
        );
      }

      expect(response.ok()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";

async function buildResetFailureMessage(status: number, body: string, request: APIRequestContext) {
  const healthUrl = `http://${WS_HOST}:${WS_PORT}/healthz`;
  const healthStatus = await describeEndpoint(request, healthUrl);

  // 409 is the server refusing on a precondition it named in the body, so the
  // wrong-server guidance below would send the reader down the wrong path.
  const wrongServerHint =
    status === 409
      ? ""
      : "This usually means Playwright reached a normal dev server or a stale process instead of the E2E server.";

  return [
    `HeroByte E2E reset failed: POST ${WS_HOST}:${WS_PORT}/__e2e/reset returned ${status}.`,
    `Retried for ${RESET_RETRY_BUDGET_MS}ms before giving up.`,
    `Health check on the same server: ${healthStatus}.`,
    wrongServerHint,
    "Use pnpm test:e2e so the isolated E2E ports are preflighted before Playwright starts.",
    body.trim() ? `Response body: ${body.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function describeEndpoint(request: APIRequestContext, url: string) {
  try {
    const response = await request.get(url, { timeout: 5_000 });
    return `${response.status()} ${await response.text()}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `unreachable (${message})`;
  }
}
