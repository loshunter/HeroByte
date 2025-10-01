# HeroByte

A real-time multiplayer virtual tabletop (VTT) for tabletop RPG gaming sessions.

## Features

- **Real-time Multiplayer**: WebSocket-based synchronization across all connected players
- **Interactive Map Canvas**: Pan, zoom, and interact with an infinite canvas
- **Token Management**: Drag-and-drop tokens with synchronized positions
- **Drawing Tools**: Freehand drawing, pointer indicators, and distance measurement
- **Grid System**: Adjustable grid with snap-to-grid functionality
- **Voice Chat**: Peer-to-peer voice communication using WebRTC
- **Player Portraits**: Custom character portraits for each player
- **Persistent State**: Game state automatically saved and restored

## Architecture

This is a monorepo built with:
- **Client**: React + TypeScript + Konva (canvas rendering) + Vite
- **Server**: Node.js + WebSocket + TypeScript
- **Shared**: Common types shared between client and server

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

1. Start the server:
```bash
cd apps/server
pnpm dev
```

2. Start the client (in a new terminal):
```bash
cd apps/client
pnpm dev
```

3. Open your browser to `http://localhost:5173`

### Network Access

To access from other devices on your local network:
- Find your local IP address (e.g., `192.168.x.x`)
- Access the client at `http://YOUR_IP:5173`
- The server automatically listens on all network interfaces

## Project Structure

```
HeroByte/
├── apps/
│   ├── client/          # React frontend application
│   │   └── src/
│   │       └── ui/
│   │           ├── App.tsx       # Main app component
│   │           ├── MapBoard.tsx  # Canvas/map component
│   │           └── useVoiceChat.ts
│   └── server/          # WebSocket server
│       └── src/
│           └── index.ts  # Server entry point
├── packages/
│   ├── shared/          # Shared types
│   └── adapters-net/    # Network client
└── package.json
```

## How to Play

1. **Join a Session**: Each player opens the app in their browser
2. **Set Up the Map**:
   - Click "Load Map" to add a background image
   - Adjust grid size using the slider (🔒 lock when ready)
3. **Move Tokens**: Drag your token around the map
4. **Use Tools**:
   - **Pointer Mode** 👆: Click to place temporary pointer indicators
   - **Measure Distance** 📏: Click two points to measure distance in grid units
   - **Draw** ✏️: Freehand drawing on the canvas
5. **Voice Chat**: Click the microphone button to enable/disable voice

## Controls

- **Mouse Wheel**: Zoom in/out
- **Click + Drag**: Pan the canvas (when no tool is active)
- **Double-click Token**: Change token color
- **Snap to Grid**: Toggle for precise token placement

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

Contributions are welcome! Please feel free to submit a Pull Request.
