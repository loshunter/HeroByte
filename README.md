# HeroByte

**A retro-inspired virtual tabletop for epic adventures online**

HeroByte is a system-agnostic, real-time multiplayer VTT that brings the charm of classic NES/SNES RPGs into the modern web. With pixel menus, voice-synced character portraits, and moddable tools, it's designed for quick setup, smooth play, and endless creativity.

Play anywhere, with anyone—no installs, just browser-based fun. Build your maps, roll your dice, and bring your party together like it's cartridge night all over again.

## Features

- **Real-time Multiplayer** – WebSocket-based synchronization keeps everyone in lockstep
- **Interactive Map Canvas** – Infinite canvas with pan, zoom, and smooth interactions
- **Token Management** – Drag-and-drop tokens with synced positions across players
- **Drawing Tools** – Freehand drawing, pointers, and distance measurement
- **Grid System** – Adjustable grid with snap-to-grid functionality
- **Voice Chat** – Peer-to-peer voice communication with WebRTC
- **Player Portraits** – Custom portraits that light up when you talk
- **Persistent State** – Sessions auto-save and restore so you never lose progress

## Architecture

This is a monorepo built with:

- **Client**: React + TypeScript + Konva (canvas rendering) + Vite
- **Server**: Node.js + WebSocket + TypeScript
- **Shared**: Common types between client and server

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install
```

### Running Locally

**Linux/Mac:**
```bash
# Start the server
cd apps/server
pnpm dev

# Start the client (in a new terminal)
cd apps/client
pnpm dev
```

**Windows (with WSL):**

For easier launching on Windows, use the provided batch scripts:
1. Double-click `scripts/windows/start-server.bat` to start the server
2. Double-click `scripts/windows/start-client.bat` to start the client

See [scripts/windows/README.md](scripts/windows/README.md) for detailed Windows setup instructions.

Then open your browser to: `http://localhost:5173`

### Network Access

To use on your local network:

- Find your IP address (e.g. `192.168.x.x`)
- Access at: `http://YOUR_IP:5173`
- The server automatically listens on all interfaces

## Project Structure

```
HeroByte/
├── apps/
│   ├── client/          # React frontend
│   │   └── src/ui/
│   │       ├── App.tsx
│   │       ├── MapBoard.tsx
│   │       └── useVoiceChat.ts
│   └── server/          # WebSocket server
│       └── src/index.ts
├── packages/
│   ├── shared/          # Shared types
│   └── adapters-net/    # Network client
└── package.json
```

## How to Play

1. **Join a Session**: Each player opens the app in a browser
2. **Set Up the Map**: Load a background image and lock the grid
3. **Move Tokens**: Drag and drop your character around
4. **Use Tools**:
   - **Pointer Mode** 👆 – place temporary indicators
   - **Measure** 📏 – click two points for distance
   - **Draw** ✏️ – freehand on the map
5. **Voice Chat**: Toggle mic button for live talk
6. **Portraits**: Custom avatars that animate when speaking

## Controls

- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan map
- **Double-click Token**: Change color
- **Snap to Grid**: Toggle precision placement

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

- React 18
- TypeScript
- Konva (Canvas rendering)
- WebSockets (ws)
- SimplePeer (WebRTC)
- Vite (Build tool)

## License

ISC

## Contributing

Contributions are welcome! Pull requests encouraged.

---

⚡ **HeroByte: Where classic pixels meet modern play.**
