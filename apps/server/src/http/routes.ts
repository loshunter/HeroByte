// ============================================================================
// HTTP ROUTES
// ============================================================================
// HTTP endpoint definitions for health checks and API routes

import { Hono } from "hono";
import { getRoomSecret } from "../config/auth.js";
import type { AuthService } from "../domains/auth/service.js";
import { isOriginAllowed } from "../config/security.js";

/**
 * Create and configure HTTP routes
 * Separates route definitions from server bootstrap
 */
export function createRoutes(authService: AuthService): Hono {
  const app = new Hono();
  const ALLOWED_METHODS = "GET,POST,OPTIONS";
  const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";

  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin");

    if (origin && !isOriginAllowed(origin)) {
      console.warn(`Blocked HTTP request from disallowed origin: ${origin}`);
      return c.text("CORS origin denied", 403);
    }

    if (c.req.method === "OPTIONS") {
      c.header("Vary", "Origin");
      if (origin) {
        c.header("Access-Control-Allow-Origin", origin);
      }
      c.header("Access-Control-Allow-Credentials", "true");
      c.header("Access-Control-Allow-Methods", ALLOWED_METHODS);
      const requestHeaders = c.req.header("Access-Control-Request-Headers");
      c.header("Access-Control-Allow-Headers", requestHeaders ?? DEFAULT_ALLOWED_HEADERS);
      return c.body(null, 204);
    }

    await next();

    if (origin) {
      c.header("Vary", "Origin");
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    }
  });

  // Root endpoint - API information
  app.get("/", (c) => {
    const summary = authService.getSummary();
    const secretSource = summary.source;

    let passwordHintHtml = "";
    if (secretSource === "fallback") {
      const secret = getRoomSecret();
      passwordHintHtml = `
        <p class="hint">
          While waiting, make sure everyone joining knows the current room password:
        </p>
        <p><code>${secret}</code></p>
        <p class="hint">
          Enter that password on the client welcome screen to hop into the shared
          tabletop once the server is online.
        </p>`;
    } else if (secretSource === "env") {
      passwordHintHtml = `
        <p class="hint">
          A room password is configured by the deployment. Ask your host for the
          latest password before joining.
        </p>`;
    } else {
      passwordHintHtml = `
        <p class="hint">
          The Dungeon Master has set a custom room password. Contact them directly
          to obtain the latest secret before joining the table.
        </p>`;
    }

    const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>HeroByte VTT – Demo Server</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: radial-gradient(circle at top, #141b33 0%, #05060d 80%);
            color: #f7f8ff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          .card {
            background: rgba(8, 12, 24, 0.92);
            border: 1px solid rgba(255, 215, 0, 0.45);
            border-radius: 12px;
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
            padding: 32px 36px;
            max-width: 520px;
            width: 92vw;
          }
          h1 {
            margin-top: 0;
            font-size: 2rem;
            letter-spacing: 0.08em;
            color: #ffc857;
            text-transform: uppercase;
          }
          p {
            line-height: 1.6;
            margin-bottom: 16px;
          }
          code {
            background: rgba(255, 255, 255, 0.08);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 0.95rem;
          }
          .hint {
            font-size: 0.85rem;
            color: rgba(255, 255, 255, 0.75);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>HeroByte Demo Server</h1>
          <p>
            Welcome! This Render.com instance may take up to a minute to wake from
            sleep. Keep this tab open &ndash; once the backend is ready the client will
            connect automatically.
          </p>
          ${passwordHintHtml}
        </div>
      </body>
    </html>`;

    return c.html(html);
  });

  // Health check endpoint (JSON)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Health check endpoint (plain text for monitoring tools)
  app.get("/healthz", (c) => c.text("ok"));

  return app;
}
