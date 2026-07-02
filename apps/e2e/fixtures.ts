import { type APIRequestContext, expect, test as base } from "@playwright/test";

const WS_HOST = process.env.E2E_WS_HOST ?? "127.0.0.1";
const WS_PORT = Number(process.env.E2E_WS_PORT ?? 8788);

export const test = base.extend<{ resetRoom: void }>({
  resetRoom: [
    async ({ request }, use) => {
      const resetUrl = `http://${WS_HOST}:${WS_PORT}/__e2e/reset`;
      const response = await request.post(resetUrl);

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

  return [
    `HeroByte E2E reset failed: POST ${WS_HOST}:${WS_PORT}/__e2e/reset returned ${status}.`,
    `Health check on the same server: ${healthStatus}.`,
    "This usually means Playwright reached a normal dev server or a stale process instead of the E2E server.",
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
