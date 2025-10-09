#!/bin/bash
# Clean start script for HeroByte development servers

echo "=== Cleaning up all existing processes ==="
pkill -9 -f "vite" 2>/dev/null
pkill -9 -f "pnpm.*dev" 2>/dev/null
pkill -9 -f "node.*dist/index.js" 2>/dev/null

echo "Waiting for processes to die..."
sleep 2

echo "=== Starting Backend Server (port 8787) ==="
cd /home/loshunter/HeroByte
pnpm --filter vtt-server start &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting for server to initialize..."
sleep 3

echo "=== Starting Frontend Client (port 5173) ==="
pnpm --filter herobyte-client dev &
CLIENT_PID=$!
echo "Client PID: $CLIENT_PID"

echo ""
echo "=== Development Servers Started ==="
echo "Backend:  http://localhost:8787"
echo "Frontend: http://localhost:5173"
echo "Password: Fun1"
echo ""
echo "To stop: pkill -P $SERVER_PID && pkill -P $CLIENT_PID"
echo "Or just run: pkill -9 -f vite && pkill -9 -f 'node.*dist'"
