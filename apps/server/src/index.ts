// ============================================================================
// VTT SERVER - BOOTSTRAP
// ============================================================================
// Thin bootstrap layer that wires up dependencies and starts the server
// Follows single responsibility: application initialization only

import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { WebSocketServer } from "ws";
import { createRoutes } from "./http/routes.js";
import { Container } from "./container.js";
import { ConnectionHandler } from "./ws/connectionHandler.js";
import { isOriginAllowed } from "./config/security.js";
import { assertDataDirUsable } from "./config/serverPaths.js";
import { flushStoresForShutdown } from "./shutdownFlush.js";
import { AuthService } from "./domains/auth/service.js";
import { AssetService } from "./domains/assets/service.js";
import { RoomRegistry } from "./domains/room/RoomRegistry.js";
import { getDefaultRoomId } from "./config/auth.js";

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";

// ----------------------------------------------------------------------------
// SERVER INITIALIZATION
// ----------------------------------------------------------------------------

/**
 * Bootstrap the application
 * Creates all infrastructure and wires dependencies
 */
async function bootstrap() {
  // Before any store touches disk: AuthService reads the secret file in its
  // constructor, so a misconfigured data dir must be caught here or never.
  assertDataDirUsable();

  const authService = new AuthService();
  const assetService = new AssetService();
  let resetE2EState: (() => void) | undefined;
  // Create HTTP routes
  const app = createRoutes(
    authService,
    () => {
      if (!resetE2EState) {
        throw new Error("E2E reset requested before server initialization");
      }
      resetE2EState();
    },
    assetService,
  );

  const buildFetchRequest = (req: IncomingMessage): Request => {
    const protocolHeader = req.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader;
    const protocol = forwardedProto ?? "http";
    const host = req.headers.host ?? `localhost:${PORT}`;
    const url = new URL(req.url ?? "/", `${protocol}://${host}`);

    const method = req.method ?? "GET";

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          headers.append(key, entry);
        }
      } else if (typeof value === "string") {
        headers.set(key, value);
      }
    }

    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody ? Readable.toWeb(req) : undefined;

    const init: RequestInit & { duplex?: "half" } = {
      method,
      headers,
    };

    if (hasBody) {
      init.body = body;
      init.duplex = "half";
    }

    return new Request(url, init);
  };

  const sendFetchResponse = async (res: ServerResponse, response: Response) => {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = response.body;
    if (!responseBody) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(responseBody as unknown as ReadableStream);
    stream.on("error", (error) => {
      console.error("[HTTP] Failed to stream response body:", error);
      res.destroy(error as Error);
    });
    stream.pipe(res);
  };

  // Create HTTP server for WebSocket compatibility
  const server = createServer(async (req, res) => {
    try {
      const request = buildFetchRequest(req);
      const response = await app.fetch(request);
      await sendFetchResponse(res, response);
    } catch (error) {
      console.error("[HTTP] Request handling failed:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      res.end("Internal Server Error");
    }
  });

  // Create WebSocket server with origin validation
  const wss = new WebSocketServer({
    server,
    verifyClient: (info, done) => {
      if (!isOriginAllowed(info.origin)) {
        console.warn(`Rejected WebSocket connection from disallowed origin: ${info.origin}`);
        done(false, 403, "Forbidden");
        return;
      }
      done(true);
    },
  });

  // Initialize room registry and wait for the backing store to hydrate
  // (no-op for the in-memory store; required for Redis so rooms are not
  // initialized from empty state before the cache is warm).
  const roomRegistry = new RoomRegistry({ defaultRoomId: getDefaultRoomId() });
  await roomRegistry.whenReady();

  // Initialize dependency container
  const container = new Container(wss, authService, roomRegistry, undefined, assetService);
  resetE2EState = () => container.resetForE2E();

  // Attach WebSocket connection handler
  const connectionHandler = new ConnectionHandler(container, wss);
  connectionHandler.attach();

  // Start server
  server.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Architecture: Domain-driven with dependency injection`);
  });

  // Graceful shutdown. Render sends SIGTERM (then SIGKILL ~30s later). The old
  // handler exited only from server.close()'s callback — which never fires
  // while a single WebSocket stays open, so a busy table meant no exit, no
  // final flush, and SIGKILL took whatever the last debounced save missed.
  // Now: flush every room's state to disk first, then exit behind a hard
  // deadline that does not depend on any socket closing.
  let shuttingDown = false;
  process.on("SIGTERM", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("SIGTERM received, shutting down gracefully...");

    // Hard deadline: exit even if a flush hangs (e.g. a dead disk). Not
    // unref'd — this timer firing IS the shutdown path of last resort.
    const hardExit = setTimeout(() => {
      console.error("[Shutdown] Flush deadline exceeded; exiting without full flush.");
      process.exit(1);
    }, 8000);

    void (async () => {
      try {
        await flushStoresForShutdown(container.roomRegistry, container.mapStudioService);
        console.log("[Shutdown] State flushed to disk.");
      } catch (error) {
        console.error("[Shutdown] State flush failed:", error);
      }
      // Best effort only — nothing below may block the exit.
      try {
        for (const client of wss.clients) client.terminate();
        server.close(() => {});
        container.destroy();
      } catch (error) {
        console.error("[Shutdown] Cleanup failed:", error);
      }
      clearTimeout(hardExit);
      process.exit(0);
    })();
  });
}

// Start the application
bootstrap().catch((error) => {
  console.error("Fatal error during bootstrap:", error);
  process.exit(1);
});
