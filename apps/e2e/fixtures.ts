import { expect, test as base } from "@playwright/test";

const WS_HOST = process.env.E2E_WS_HOST ?? "127.0.0.1";
const WS_PORT = Number(process.env.E2E_WS_PORT ?? 8787);

export const test = base.extend<{ resetRoom: void }>({
  resetRoom: [
    async ({ request }, use) => {
      const response = await request.post(`http://${WS_HOST}:${WS_PORT}/__e2e/reset`);
      expect(response.ok(), await response.text()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";
