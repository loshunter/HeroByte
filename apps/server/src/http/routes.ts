// ============================================================================
// HTTP ROUTES
// ============================================================================
// HTTP endpoint definitions for health checks and API routes

import { Hono } from "hono";

/**
 * Create and configure HTTP routes
 * Separates route definitions from server bootstrap
 */
export function createRoutes(): Hono {
  const app = new Hono();

  // Root endpoint - API information
  app.get("/", (c) =>
    c.json({
      name: "HeroByte VTT Server",
      version: "2.0.0",
      status: "running",
      architecture: "domain-driven",
      websocket: "Connect via WebSocket to this server",
    }),
  );

  // Health check endpoint (JSON)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Health check endpoint (plain text for monitoring tools)
  app.get("/healthz", (c) => c.text("ok"));

  return app;
}
