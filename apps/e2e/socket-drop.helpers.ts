// A page's game socket you can cut. Playwright has no way to reach into a page's own WebSocket,
// so the page's connections go through a route that passes everything along until told to drop:
// then the server side closes the page's socket, and every retry after it connects but is held,
// unanswered — the table "has not come back yet" — until it is released.
//
// Install it BEFORE the page loads: a socket opened earlier was never routed.

import type { Page, WebSocketRoute } from "@playwright/test";

export interface SocketDrop {
  /** Every client frame sent while the socket was passing through, in order. */
  frames: { t: string; token?: string }[];
  /** How many sockets the page has opened since the drop (its first retry comes seconds later). */
  held(): number;
  /** Close the page's socket from the server's side; its retries are held unanswered. */
  drop(): Promise<void>;
  /** Let the next connection through: the page reconnects and re-authenticates by its session. */
  release(): Promise<void>;
}

export async function holdableSocket(page: Page): Promise<SocketDrop> {
  let holding = false;
  let held = 0;
  let current: { page: WebSocketRoute; server?: WebSocketRoute } | null = null;
  const frames: { t: string; token?: string }[] = [];
  await page.routeWebSocket(
    (url) => url.protocol === "ws:" && url.port === (process.env.E2E_WS_PORT ?? "8788"),
    (route) => {
      if (holding) {
        held += 1;
        current = { page: route };
        return;
      }
      const server = route.connectToServer();
      current = { page: route, server };
      route.onMessage((message) => {
        frames.push(JSON.parse(typeof message === "string" ? message : message.toString()));
        server.send(message);
      });
      server.onMessage((message) => route.send(message));
      route.onClose((code, reason) => void server.close({ code, reason }));
      server.onClose((code, reason) => void route.close({ code, reason }));
    },
  );
  return {
    frames,
    held: () => held,
    async drop() {
      holding = true;
      await current!.server!.close({ code: 1011, reason: "e2e drop" });
      await current!.page.close({ code: 1011, reason: "e2e drop" });
    },
    async release() {
      holding = false;
      await current!.page.close({ code: 1011, reason: "e2e release" });
    },
  };
}
