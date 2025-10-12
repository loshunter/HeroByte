// ============================================================================
// VTT SERVER - BOOTSTRAP
// ============================================================================
// Thin bootstrap layer that wires up dependencies and starts the server
// Follows single responsibility: application initialization only

import { createServer } from "http";
import { WebSocketServer } from "ws";
import { createRoutes } from "./http/routes.js";
import { Container } from "./container.js";
import { ConnectionHandler } from "./ws/connectionHandler.js";
import { isOriginAllowed } from "./config/security.js";

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
  // Create HTTP routes
  const app = createRoutes();

  // Create HTTP server for WebSocket compatibility
  const server = createServer(async (req, res) => {
    const response = await app.fetch(req as unknown as Request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const body = await response.text();
    res.end(body);
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
  const container = new Container(wss);

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
