#!/bin/bash
# Comprehensive development server startup script
# Handles port cleanup, building, and starting both servers

set -e  # Exit on error

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

SERVER_PID=""
CLIENT_PID=""

cleanup() {
    echo ""
    echo "Stopping HeroByte development servers..."
    if [ -n "$CLIENT_PID" ]; then
        kill "$CLIENT_PID" 2>/dev/null || true
    fi
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    wait "$CLIENT_PID" "$SERVER_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         HeroByte Development Server Startup              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Clean up existing processes
echo "1️⃣  Cleaning up existing processes..."
./kill-ports.sh

# Step 2: Build the server
echo ""
echo "2️⃣  Building backend server..."
pnpm --filter vtt-server build
if [ $? -ne 0 ]; then
    echo "❌ Server build failed!"
    exit 1
fi
echo "✅ Server built successfully"

# Step 3: Start backend server
echo ""
echo "3️⃣  Starting backend server (port 8787)..."
pnpm --filter vtt-server start &
SERVER_PID=$!
echo "   Backend PID: $SERVER_PID"

# Wait for server to be ready
echo "   Waiting for server to initialize..."
sleep 3

# Check if server is actually running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start!"
    exit 1
fi
echo "✅ Backend server running"

# Step 4: Start frontend client
echo ""
echo "4️⃣  Starting frontend client (port 5174)..."
pnpm --filter herobyte-client dev &
CLIENT_PID=$!
echo "   Frontend PID: $CLIENT_PID"

# Wait for client to start
sleep 2

# Check if client is actually running
if ! kill -0 $CLIENT_PID 2>/dev/null; then
    echo "❌ Client failed to start!"
    echo "Cleaning up server..."
    kill -9 $SERVER_PID 2>/dev/null
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              🎮 Development Servers Ready! 🎮            ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Backend:  http://localhost:8787                          ║"
echo "║  Frontend: http://localhost:5174                          ║"
echo "║  Password: Fun1                                           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Server PID:  $SERVER_PID                                      ║"
echo "║  Client PID:  $CLIENT_PID                                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📝 To stop servers:"
echo "   ./kill-ports.sh"
echo "   OR: kill -9 $SERVER_PID $CLIENT_PID"
echo ""
echo "⌨️  Press Ctrl+C to stop both servers..."
echo ""

# Wait for user interrupt
wait
