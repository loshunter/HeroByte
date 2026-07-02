#!/bin/bash
# Clean start script for HeroByte development servers

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "=== Safely releasing HeroByte dev ports ==="
node scripts/dev-port-preflight.mjs free

echo "=== Rebuilding Backend Server ==="
pnpm --filter vtt-server build

echo "=== Starting Backend Server (port 8787) ==="
pnpm --filter vtt-server start &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting for server to initialize..."
sleep 3

echo "=== Starting Frontend Client (port 5174) ==="
pnpm --filter herobyte-client dev &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

echo ""
echo "=== Development Servers Started ==="
echo "Backend:  http://localhost:8787"
echo "Frontend: http://localhost:5174"
echo "Password: Fun1"
echo ""
echo "To stop: pkill -P $SERVER_PID && pkill -P $CLIENT_PID"
echo "Or run: pnpm dev:free"
