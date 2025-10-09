<div align="center">
  <img src="assets/images/logo/LogoSm.webp" alt="HeroByte Logo" width="200"/>

# HeroByte

[![CI](https://github.com/loshunter/HeroByte/actions/workflows/ci.yml/badge.svg)](https://github.com/loshunter/HeroByte/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/loshunter/HeroByte/branch/dev/graph/badge.svg)](https://app.codecov.io/gh/loshunter/HeroByte/tree/dev)

**A retro-inspired virtual tabletop for epic adventures online**

</div>

HeroByte is a system-agnostic, real-time multiplayer VTT that brings the charm of classic NES/SNES RPGs into the modern web. With pixel menus, voice-synced character portraits, and moddable tools, it's designed for quick setup, smooth play, and endless creativity.

Play anywhere, with anyone—no installs, just browser-based fun. Build your maps, roll your dice, and bring your party together like it's cartridge night all over again.

## Quick Links

- [DEVELOPMENT.md](DEVELOPMENT.md) – day-to-day workflow tips
- [TESTING_SETUP.md](TESTING_SETUP.md) – step-by-step testing playbook
- [TODO.md](TODO.md) – phased roadmap and contributor priorities
- [CLOUDFLARE_PAGES_DEPLOYMENT.md](CLOUDFLARE_PAGES_DEPLOYMENT.md) – deployment checklist

## Features

### Core Gameplay

- **Real-time Multiplayer** – WebSocket-based synchronization keeps everyone in lockstep
- **Interactive Map Canvas** – Infinite canvas with pan, zoom, and smooth interactions
- **Token Management** – Drag-and-drop tokens with synced positions across players
- **Character System** – Server-side foundation for PC/NPC management with ownership tracking
- **HP Tracking** – Real-time hit point management with visual indicators
- **Voice Chat** – Peer-to-peer voice communication with WebRTC
- **Player Portraits** – Custom portraits that light up when you talk

### Drawing & Visual Tools

- **Advanced Drawing Tools** – Freehand pen, line, rectangle, circle, and eraser
- **Drawing Customization** – Adjustable color, width, opacity, and fill options
- **Drawing Management** – Undo/redo, clear all, with keyboard shortcuts (Ctrl+Z)
- **Pointer Mode** – Temporary visual indicators for communication
- **Measure Tool** – Distance measurement between two points
- **Grid System** – Adjustable grid (10-500px) with snap-to-grid and lock functionality
- **CRT Filter** – Optional retro scanline effect with bloom and chromatic aberration

### Dice & Combat

- **Visual Dice Roller** – Interactive 3D-style dice with physics-based rolling animations
- **Multi-die Support** – Roll d4, d6, d8, d10, d12, d20, d100 with modifiers
- **Roll History** – Shared log of all dice rolls with timestamps and player names
- **Roll Breakdown** – Detailed per-die results with expandable formulas

### Technical Features

- **Persistent State** – Auto-save to disk, sessions restore on server restart
- **Input Validation** – Comprehensive message validation with size limits
- **Rate Limiting** – 100 messages/second per client with token bucket algorithm
- **Performance Optimized** – React.memo on map layers, prevents unnecessary re-renders
- **Session Management** – Heartbeat system prevents client timeouts

## Architecture

This is a monorepo built with **domain-driven design** and **separation of concerns** principles:

- **Client**: React + TypeScript + Konva (canvas rendering) + Vite
  - Feature-based organization with React.memo optimizations
  - Service layer for WebSocket and voice chat
  - Custom hooks for shared logic
- **Server**: Node.js + WebSocket + TypeScript
  - Domain-driven architecture with dependency injection
  - Input validation and rate limiting middleware (100 msg/sec)
  - Separated concerns: HTTP routes, WebSocket handlers, domain services
- **Shared**: Common types between client and server

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Recommended Global Setup

```bash
# Enable pnpm if you normally use npm/yarn
corepack enable pnpm
```

### Installation

```bash
# Install dependencies
pnpm install
```

### Running Locally

**Quick Start (Recommended):**

```bash
# From project root - automatically handles cleanup, build, and startup
./dev-start.sh
```

This script:
- Cleans up any stuck processes/ports
- Builds the backend
- Starts both servers in the correct order
- Shows you the URLs and PIDs

**Manual Start (Alternative):**

```bash
# Terminal 1: Start the backend
pnpm dev:server

# Terminal 2: Start the frontend
pnpm dev:client
```

**Port Issues?**

If you get "port already in use" errors:
```bash
./kill-ports.sh  # Cleans up stuck processes
```

See [PORT_MANAGEMENT.md](PORT_MANAGEMENT.md) for detailed troubleshooting.

**Access the Application:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8787`
- Default Password: `Fun1`

### Network Access

To use on your local network:

- Find your IP address (e.g. `192.168.x.x`)
- Access at: `http://YOUR_IP:5173`
- The server automatically listens on all interfaces

### Common Project Scripts

| Command                               | Description                                              |
| ------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                            | Run client and server concurrently (uses `concurrently`) |
| `pnpm dev:server` / `pnpm dev:client` | Start a single target in watch mode                      |
| `pnpm build`                          | Build both server and client bundles                     |
| `pnpm test:shared`                    | Execute unit tests for shared domain models              |

## Project Structure

```
HeroByte/
├── apps/
│   ├── client/          # React frontend
│   │   └── src/
│   │       ├── features/          # Feature modules (map, dice, drawing)
│   │       ├── hooks/             # Custom React hooks
│   │       ├── services/          # WebSocket, voice chat services
│   │       ├── theme/             # Styling and themes
│   │       └── ui/                # UI components
│   └── server/          # WebSocket server
│       └── src/
│           ├── domains/           # Domain services (Room, Player, Token, Map, Dice, Character)
│           ├── middleware/        # Validation, rate limiting
│           ├── http/              # HTTP routes (health checks)
│           ├── ws/                # WebSocket connection handler
│           ├── container.ts       # Dependency injection container
│           └── index.ts           # Bootstrap layer
├── packages/
│   ├── shared/          # Shared types between client/server
│   └── adapters-net/    # Network adapter
└── package.json
```

## How to Play

1. **Join a Session**: Each player opens the app in a browser
2. **Set Up the Map**: Load a background image and adjust/lock the grid
3. **Manage Characters**: Update HP, set portraits, link tokens to characters
4. **Move Tokens**: Drag and drop your character around the map
5. **Use Drawing Tools**:
   - **Pointer Mode** 👆 – Place temporary visual indicators
   - **Measure** 📏 – Click two points for distance
   - **Draw Mode** ✏️ – Freehand, shapes, eraser with customization
   - **Select Mode** 🖱️ – Move and delete existing drawings
6. **Roll Dice**: Open dice roller, select dice types, add modifiers, and roll
7. **Voice Chat**: Toggle mic button for live talk with animated portraits
8. **Retro Mode**: Enable CRT filter for that classic arcade feel

## Controls

### Map Navigation

- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan map canvas
- **Snap to Grid**: Toggle for precision token placement
- **Grid Lock**: Prevent accidental grid adjustments

### Tokens & Objects

- **Drag Token**: Move your character
- **Double-click Token**: Randomize color
- **Right-click Token**: Context menu (delete, etc.)

### Drawing Tools

- **Ctrl+Z / Cmd+Z**: Undo last drawing
- **Drawing Toolbar**: Adjust color, width, opacity, fill when in draw mode
- **Select Mode**: Click drawings to move or delete them

### Shortcuts

- **Toolbar Buttons**: Quick access to all modes (pointer, measure, draw, select, dice, CRT)
- **Grid Controls**: Adjust size (10-500px) and toggle snap/lock

## Testing

- ✅ Shared domain models are covered with Vitest (≈99% coverage). Run:

  ```bash
  pnpm test:shared
  ```

- Need more detail? Follow the step-by-step guidance in [TESTING_SETUP.md](TESTING_SETUP.md).
- Upcoming work (see [TODO.md](TODO.md)) tracks integration and e2e coverage goals.

## Development

### Building for Production

```bash
# Build client
cd apps/client
pnpm build

# Build server
cd apps/server
pnpm build
```

### Technologies Used

- React 18 (with React.memo for performance)
- TypeScript (strict mode with NodeNext resolution)
- Konva (Canvas rendering)
- WebSockets (ws) with input validation and rate limiting
- SimplePeer (WebRTC for voice chat)
- Vite (Build tool)
- Domain-Driven Design with Dependency Injection

### Additional References

- [DEVELOPMENT.md](DEVELOPMENT.md) for branching, naming, and feature cadence.
- [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) before shipping major releases.
- [TESTING_SETUP.md](TESTING_SETUP.md) for expanding automated coverage.

## License

ISC

## Contributing

We welcome pull requests—especially around the CRITICAL items called out in [TODO.md](TODO.md).

1. Fork and branch from `dev` (`feature/<short-name>`).
2. Run locally (`pnpm dev`) and add tests (`pnpm test:shared`) when touching shared logic.
3. Update relevant docs (README, DEVELOPMENT, TESTING) if behavior or workflows change.
4. Submit a PR with a concise summary and checklist of completed TODO items.

Need more structure? See [DEVELOPMENT.md](DEVELOPMENT.md) for workflow norms and [TESTING_SETUP.md](TESTING_SETUP.md) for expectations before opening a PR.

---

## Deployment

HeroByte is designed for easy deployment:

- **Client**: Deployed on [Cloudflare Pages](https://pages.cloudflare.com/) with automatic builds from main branch
- **Server**: Deployable on [Render](https://render.com/) or any Node.js hosting platform
- **Live Demo**: [herobyte.pages.dev](https://herobyte.pages.dev) (client) connects to production server

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

⚡ **HeroByte: Where classic pixels meet modern play.**
