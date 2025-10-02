// ============================================================================
// VTT SERVER
// ============================================================================
// WebSocket server for real-time multiplayer virtual tabletop gaming.
// Refactored with domain-driven architecture for better maintainability.

import { Hono } from "hono";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import type { ClientMessage } from "@shared";

// Domain services
import { RoomService } from "./domains/room/service.js";
import { PlayerService } from "./domains/player/service.js";
import { TokenService } from "./domains/token/service.js";
import { MapService } from "./domains/map/service.js";
import { DiceService } from "./domains/dice/service.js";
import { MessageRouter } from "./ws/messageRouter.js";

// Middleware
import { validateMessage } from "./middleware/validation.js";
import { RateLimiter } from "./middleware/rateLimit.js";

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

// Initialize domain services
const roomService = new RoomService();
const playerService = new PlayerService();
const tokenService = new TokenService();
const mapService = new MapService();
const diceService = new DiceService();

// Initialize middleware
const rateLimiter = new RateLimiter({ maxMessages: 100, windowMs: 1000 });

// Load persisted state
roomService.loadState();

// ----------------------------------------------------------------------------
// HTTP + WEBSOCKET SERVER
// ----------------------------------------------------------------------------

// Create Hono app for HTTP routes
const app = new Hono();

// Health check endpoints
app.get("/", (c) => c.json({
  name: "HeroByte VTT Server",
  version: "2.0.0",
  status: "running",
  architecture: "domain-driven",
  websocket: "Connect via WebSocket to this server"
}));
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/healthz", (c) => c.text("ok")); // Simple health check for monitoring

// Get port from environment (Render assigns PORT) or default to 8787
const PORT = Number(process.env.PORT || 8787);

// Create native HTTP server for WebSocket compatibility
const server = createServer(async (req, res) => {
  // Use Hono to handle HTTP requests
  const response = await app.fetch(req as any);
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = await response.text();
  res.end(body);
});

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server });

// Track WebSocket connections by UID for direct P2P signaling
const uidToWs = new Map<string, any>();

// Initialize message router
const messageRouter = new MessageRouter(
  roomService,
  playerService,
  tokenService,
  mapService,
  diceService,
  wss,
  uidToWs
);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Architecture: Domain-driven with separate service layers`);
});

// ----------------------------------------------------------------------------
// CONNECTION HANDLING
// ----------------------------------------------------------------------------

wss.on("connection", (ws, req) => {
  // Extract player UID from connection URL
  const params = new URL(req.url || "", "http://localhost").searchParams;
  const uid = params.get("uid") || "anon";

  const state = roomService.getState();

  // Register connection (remove from users list first to prevent duplicates on reconnect)
  state.users = state.users.filter((u) => u !== uid);
  state.users.push(uid);
  uidToWs.set(uid, ws);

  // Keepalive ping to prevent Render/cloud provider timeout (send every 25 seconds)
  const keepalive = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 25000);

  // Check if this is a reconnecting player
  const existingPlayer = playerService.findPlayer(state, uid);
  const existingToken = tokenService.findTokenByOwner(state, uid);

  // Create new player if first time connecting
  if (!existingPlayer) {
    playerService.createPlayer(state, uid);
  }

  // Create initial token if player doesn't have one
  if (!existingToken) {
    tokenService.createToken(state, uid, 0, 0);
  } else {
    console.log("Player reconnected:", uid);
  }

  // Send initial room state to new connection
  roomService.broadcast(wss.clients);

  // ----------------------------------------------------------------------------
  // MESSAGE HANDLING
  // ----------------------------------------------------------------------------

  ws.on("message", (buf) => {
    try {
      // Parse message
      const message: ClientMessage = JSON.parse(buf.toString());

      // Rate limiting
      if (!rateLimiter.check(uid)) {
        console.warn(`Rate limit exceeded for client ${uid}`);
        return;
      }

      // Input validation
      const validation = validateMessage(message);
      if (!validation.valid) {
        console.warn(`Invalid message from ${uid}: ${validation.error}`);
        return;
      }

      // Route to appropriate handler
      messageRouter.route(message, uid);
    } catch (err) {
      console.error(`Failed to process message from ${uid}:`, err);
    }
  });

  // ----------------------------------------------------------------------------
  // DISCONNECTION HANDLING
  // ----------------------------------------------------------------------------

  ws.on("close", () => {
    // Clear keepalive interval
    clearInterval(keepalive);

    // Clean up disconnected player's connection (but keep player and token data for reconnection)
    state.users = state.users.filter((u) => u !== uid);
    uidToWs.delete(uid);
    roomService.broadcast(wss.clients);
  });
});
