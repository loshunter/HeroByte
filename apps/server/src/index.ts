// ============================================================================
// VTT SERVER - BOOTSTRAP
// ============================================================================
// Thin bootstrap layer that wires up dependencies and starts the server
// Follows single responsibility: application initialization only

import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "node:stream";
import { WebSocketServer } from "ws";
import { createRoutes } from "./http/routes.js";
import { Container } from "./container.js";
import { ConnectionHandler } from "./ws/connectionHandler.js";
import { isOriginAllowed } from "./config/security.js";
import { AuthService } from "./domains/auth/service.js";

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
function bootstrap() {
  const authService = new AuthService();
  // Create HTTP routes
  const app = createRoutes(authService);

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

  // Initialize dependency container
  const container = new Container(wss, authService);

  // Attach WebSocket connection handler
  const connectionHandler = new ConnectionHandler(container, wss);
  connectionHandler.attach();

  // Start server
  server.listen(PORT, HOST, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Architecture: Domain-driven with dependency injection`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    server.close(() => {
      console.log("Server closed");
      container.destroy();
      process.exit(0);
    });
  });
}

// Start the application
bootstrap();
