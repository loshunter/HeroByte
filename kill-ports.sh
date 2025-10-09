#!/bin/bash
# Kill processes on specific ports using WSL-friendly methods
# This script works better than trying to kill by process name

echo "=== Port Cleanup Script for WSL ==="
echo ""

# Function to kill process on a specific port
kill_port() {
    local port=$1
    echo "Checking port $port..."

    # Try to find the process using lsof (if available)
    if command -v lsof &> /dev/null; then
        local pid=$(lsof -ti:$port 2>/dev/null)
        if [ ! -z "$pid" ]; then
            echo "  Found process $pid on port $port, attempting to kill..."
            kill -9 $pid 2>/dev/null && echo "  ✓ Killed process $pid" || echo "  ✗ Failed to kill $pid"
            return
        fi
    fi

    # Try using netstat + grep
    local pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1)
    if [ ! -z "$pid" ]; then
        echo "  Found process $pid on port $port, attempting to kill..."
        kill -9 $pid 2>/dev/null && echo "  ✓ Killed process $pid" || echo "  ✗ Failed to kill $pid"
        return
    fi

    # Try using ss command
    local pid=$(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP '(?<=pid=)[0-9]+' | head -1)
    if [ ! -z "$pid" ]; then
        echo "  Found process $pid on port $port, attempting to kill..."
        kill -9 $pid 2>/dev/null && echo "  ✓ Killed process $pid" || echo "  ✗ Failed to kill $pid"
        return
    fi

    echo "  No process found on port $port"
}

# Function to kill all node/vite/pnpm processes
kill_dev_processes() {
    echo ""
    echo "=== Killing all dev server processes ==="

    # Kill by process name patterns
    pkill -9 -f "vite" 2>/dev/null && echo "  ✓ Killed vite processes" || echo "  - No vite processes found"
    pkill -9 -f "pnpm.*dev" 2>/dev/null && echo "  ✓ Killed pnpm dev processes" || echo "  - No pnpm dev processes found"
    pkill -9 -f "node.*dist/index.js" 2>/dev/null && echo "  ✓ Killed node server processes" || echo "  - No node server processes found"
    pkill -9 -f "tsx.*watch" 2>/dev/null && echo "  ✓ Killed tsx watch processes" || echo "  - No tsx watch processes found"
}

# Main execution
echo "Method 1: Killing specific ports..."
kill_port 5173  # Vite dev server
kill_port 5174  # Alternate Vite port
kill_port 8787  # Backend server

kill_dev_processes

echo ""
echo "Waiting 2 seconds for cleanup..."
sleep 2

echo ""
echo "=== Verification ==="
echo "Checking if ports are now free..."
for port in 5173 5174 8787; do
    if lsof -ti:$port &>/dev/null || netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo "  ⚠ Port $port is still in use"
    else
        echo "  ✓ Port $port is free"
    fi
done

echo ""
echo "Done! You can now run your dev servers."
