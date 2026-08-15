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

export const test = base.extend<{ resetRoom: void }>({
  resetRoom: [
    async ({ request }, use) => {
      const resetUrl = `http://${WS_HOST}:${WS_PORT}/__e2e/reset`;
      const deadline = Date.now() + RESET_RETRY_BUDGET_MS;
      let response = await request.post(resetUrl);
      while (!response.ok() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, RESET_RETRY_PAUSE_MS));
        response = await request.post(resetUrl);
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
