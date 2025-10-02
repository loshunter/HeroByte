// ============================================================================
// VTT SERVER
// ============================================================================
// WebSocket server for real-time multiplayer virtual tabletop gaming.
// Manages room state, player connections, and broadcasts updates to all clients.

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { writeFileSync, readFileSync, existsSync } from "fs";
import type { Token, RoomSnapshot, Player, Pointer, Drawing, DiceRoll } from "@shared";

// ----------------------------------------------------------------------------
// PERSISTENCE
// ----------------------------------------------------------------------------

const STATE_FILE = "./herobyte-state.json";

// ----------------------------------------------------------------------------
// GAME STATE
// ----------------------------------------------------------------------------
// All game state is stored in memory and persisted to disk on each change

let users: string[] = [];                     // Legacy: connected user UIDs
let tokens: Token[] = [];                     // All tokens on the map
let players: Player[] = [];                   // Player metadata
let mapBackground: string | undefined;        // Background image URL/base64
let pointers: Pointer[] = [];                 // Temporary pointer indicators
let drawings: Drawing[] = [];                 // Freehand drawings
let gridSize: number = 50;                    // Synchronized grid size
let diceRolls: DiceRoll[] = [];               // Dice roll history

// ----------------------------------------------------------------------------
// STATE MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Load game state from disk on server startup
 */
function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
      tokens = data.tokens || [];
      players = data.players || [];
      mapBackground = data.mapBackground;
      drawings = data.drawings || [];
      gridSize = data.gridSize || 50;
      diceRolls = data.diceRolls || [];
      console.log("Loaded state from disk");
    } catch (err) {
      console.error("Failed to load state:", err);
    }
  }
}

/**
 * Save game state to disk (called after every state change)
 */
function saveState() {
  try {
    writeFileSync(
      STATE_FILE,
      JSON.stringify({ tokens, players, mapBackground, drawings, gridSize, diceRolls }, null, 2)
    );
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

/**
 * Broadcast current room state to all connected clients
 * Also removes expired pointers (older than 2 seconds)
 */
function broadcast() {
  // Clean up expired pointers
  const now = Date.now();
  pointers = pointers.filter((p) => now - p.timestamp < 2000);

  // Build and send snapshot
  const snap: RoomSnapshot = { users, tokens, players, mapBackground, pointers, drawings, gridSize, diceRolls };
  const json = JSON.stringify(snap);
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(json);
  });

  saveState();
}

/**
 * Generate a random HSL color for new tokens
 */
function randomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
}

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

loadState();

// ----------------------------------------------------------------------------
// HTTP + WEBSOCKET SERVER
// ----------------------------------------------------------------------------

// Create Hono app for HTTP routes
const app = new Hono();

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Get port from environment (Render assigns PORT) or default to 8787
const PORT = Number(process.env.PORT || 8787);

// Create HTTP server
const server = serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0'
}) as any; // Type cast needed for WebSocketServer compatibility

// Attach WebSocket server to HTTP server
const wss = new WebSocketServer({ server, path: '/' });

// Track WebSocket connections by UID for direct P2P signaling
const uidToWs = new Map<string, any>();

console.log(`Server running on port ${PORT}`);

// ----------------------------------------------------------------------------
// CONNECTION HANDLING
// ----------------------------------------------------------------------------

wss.on("connection", (ws, req) => {
  // Extract player UID from connection URL
  const params = new URL(req.url || "", "http://localhost").searchParams;
  const uid = params.get("uid") || "anon";

  // Register connection
  users.push(uid);
  uidToWs.set(uid, ws);

  // Keepalive ping to prevent Render/cloud provider timeout (send every 25 seconds)
  const keepalive = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 25000);

  // Check if this is a reconnecting player
  let existingPlayer = players.find((p) => p.uid === uid);
  let existingToken = tokens.find((t) => t.owner === uid);

  // Create new player if first time connecting
  if (!existingPlayer) {
    const playerNumber = players.length + 1;
    players.push({
      uid,
      name: `Player ${playerNumber}`,
      hp: 100,
      maxHp: 100,
    });
  }

  // Create initial token if player doesn't have one
  if (!existingToken) {
    const newToken = {
      id: randomUUID(),
      owner: uid,
      x: 0,
      y: 0,
      color: randomColor(),
    };
    tokens.push(newToken);
    console.log("Spawned token", newToken);
  } else {
    console.log("Player reconnected:", uid);
  }

  // Send initial room state to new connection
  broadcast();

  // ----------------------------------------------------------------------------
  // MESSAGE HANDLING
  // ----------------------------------------------------------------------------

  ws.on("message", (buf) => {
    try {
      const msg = JSON.parse(buf.toString());

      // -----------------------------------------------------------------------
      // TOKEN ACTIONS
      // -----------------------------------------------------------------------

      if (msg.t === "move") {
        // Move a token (only owner can move their token)
        const t = tokens.find((tk) => tk.id === msg.id && tk.owner === uid);
        if (t) {
          t.x = msg.x;
          t.y = msg.y;
          broadcast();
        }
      }

      if (msg.t === "recolor") {
        // Change token color (only owner can recolor their token)
        const t = tokens.find((tk) => tk.id === msg.id && tk.owner === uid);
        if (t) {
          t.color = randomColor();
          broadcast();
        }
      }

      if (msg.t === "delete-token") {
        // Remove a token (only owner can delete their token)
        const idx = tokens.findIndex((t) => t.id === msg.id && t.owner === uid);
        if (idx !== -1) {
          tokens.splice(idx, 1);
          broadcast();
        }
      }

      // -----------------------------------------------------------------------
      // PLAYER ACTIONS
      // -----------------------------------------------------------------------

      if (msg.t === "portrait") {
        // Update player portrait image
        const player = players.find((p) => p.uid === uid);
        if (player) {
          player.portrait = msg.data;
          broadcast();
        }
      }

      if (msg.t === "rename") {
        // Change player display name
        const player = players.find((p) => p.uid === uid);
        if (player) {
          player.name = msg.name;
          broadcast();
        }
      }

      if (msg.t === "mic-level") {
        // Update microphone level for visual feedback
        const player = players.find((p) => p.uid === uid);
        if (player) {
          player.micLevel = msg.level;
          broadcast();
        }
      }

      if (msg.t === "set-hp") {
        // Update player HP
        const player = players.find((p) => p.uid === uid);
        if (player) {
          player.hp = msg.hp;
          player.maxHp = msg.maxHp;
          broadcast();
        }
      }

      // -----------------------------------------------------------------------
      // MAP/CANVAS ACTIONS
      // -----------------------------------------------------------------------

      if (msg.t === "map-background") {
        // Set the background image for the map
        mapBackground = msg.data;
        broadcast();
      }

      if (msg.t === "grid-size") {
        // Update synchronized grid size
        gridSize = msg.size;
        broadcast();
      }

      if (msg.t === "point") {
        // Place a temporary pointer indicator on the map
        pointers = pointers.filter((p) => p.uid !== uid); // Remove old pointer
        pointers.push({ uid, x: msg.x, y: msg.y, timestamp: Date.now() });
        broadcast();
      }

      if (msg.t === "draw") {
        // Add a freehand drawing to the canvas
        drawings.push(msg.drawing);
        broadcast();
      }

      if (msg.t === "clear-drawings") {
        // Remove all drawings from the canvas
        drawings = [];
        broadcast();
      }

      // -----------------------------------------------------------------------
      // DICE ROLLS
      // -----------------------------------------------------------------------

      if (msg.t === "dice-roll") {
        // Add dice roll to history
        diceRolls.push(msg.roll);
        // Keep only last 100 rolls
        if (diceRolls.length > 100) {
          diceRolls = diceRolls.slice(-100);
        }
        broadcast();
      }

      if (msg.t === "clear-roll-history") {
        // Clear all dice rolls
        diceRolls = [];
        broadcast();
      }

      // -----------------------------------------------------------------------
      // ROOM MANAGEMENT
      // -----------------------------------------------------------------------

      if (msg.t === "clear-all-tokens") {
        // Remove all tokens and players except the current user
        // (Useful for DM to reset the room)
        tokens = tokens.filter((t) => t.owner === uid);
        players = players.filter((p) => p.uid === uid);
        broadcast();
      }

      // -----------------------------------------------------------------------
      // WEBRTC SIGNALING
      // -----------------------------------------------------------------------

      if (msg.t === "rtc-signal") {
        // Forward WebRTC signaling data to target peer for P2P voice chat
        const targetWs = uidToWs.get(msg.target);
        if (targetWs && targetWs.readyState === 1) {
          targetWs.send(JSON.stringify({ t: "rtc-signal", from: uid, signal: msg.signal }));
        }
      }

    } catch (err) {
      console.error("Failed to process message", err);
    }
  });

  // ----------------------------------------------------------------------------
  // DISCONNECTION HANDLING
  // ----------------------------------------------------------------------------

  ws.on("close", () => {
    // Clear keepalive interval
    clearInterval(keepalive);

    // Clean up disconnected player's data
    users = users.filter((u) => u !== uid);
    tokens = tokens.filter((t) => t.owner !== uid);
    players = players.filter((p) => p.uid !== uid);
    uidToWs.delete(uid);
    broadcast();
  });
});
