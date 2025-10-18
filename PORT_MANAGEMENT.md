# Port Management Guide for WSL Development

## ⚠️ IMPORTANT: Windows/Hyper-V Port Conflicts

If `./kill-ports.sh` reports that a **Windows process** is holding port 5173, this is usually `svchost.exe` from Hyper-V or Windows NAT service. This is a known WSL issue.

### Quick Fix (Run in PowerShell as Administrator):

```powershell
# Option 1: Remove NAT mappings and restart WSL manager
Get-NetNatStaticMapping | Remove-NetNatStaticMapping
Get-NetNat | Remove-NetNat
Restart-Service -Name 'LxssManager' -Force

# Option 2: Restart WSL completely
wsl --shutdown
# Wait 10 seconds, then restart WSL
```

### Alternative: Use a different port

Edit [apps/client/vite.config.ts](apps/client/vite.config.ts) to use port 5174 instead.

---

## Quick Start

### Start Development Servers

```bash
./dev-start.sh
```

### Stop/Clean Up Ports

```bash
./kill-ports.sh
```

---

## The Port 5173 Problem

### Why This Happens

When running Vite dev servers in WSL, sometimes the process doesn't cleanly release the port when terminated. This is especially common when:

- You close the terminal without stopping the server
- The process crashes
- You use Ctrl+C multiple times rapidly
- Windows and WSL processes get out of sync

### Solution Hierarchy

#### 1. **Use the kill-ports.sh Script** (Recommended)

```bash
./kill-ports.sh
```

This script tries multiple methods to free the ports.

#### 2. **Manual Port Cleanup**

```bash
# Find what's using the port
lsof -ti:5173
# or
netstat -tlnp | grep :5173

# Kill it
kill -9 <PID>
```

#### 3. **Nuclear Option - Kill All Dev Processes**

```bash
pkill -9 -f vite
pkill -9 -f "pnpm.*dev"
pkill -9 -f "node.*dist"
```

#### 4. **Windows-Side Cleanup** (If WSL can't kill it)

From PowerShell or CMD as Administrator:

```powershell
# Find process using port
netstat -ano | findstr :5173

# Kill it (replace <PID> with the actual PID)
taskkill /F /PID <PID>
```

---

## Available Scripts

### `./dev-start.sh`

**Comprehensive startup script**

- Automatically cleans up ports
- Builds the backend
- Starts both servers in order
- Shows status and PIDs
- Waits for user interrupt (Ctrl+C)

### `./kill-ports.sh`

**Port cleanup script**

- Kills processes on ports 5173, 5174, 8787
- Kills all dev server processes
- Verifies ports are free
- Multiple detection methods

### `./clean-start-dev.sh` (Legacy)

**Original cleanup script**

- Still works but less comprehensive
- Use `dev-start.sh` instead

---

## Port Reference

| Port | Service        | Command                             |
| ---- | -------------- | ----------------------------------- |
| 5173 | Vite Frontend  | `pnpm --filter herobyte-client dev` |
| 5174 | Alternate Vite | Fallback if 5173 is taken           |
| 8787 | Backend Server | `pnpm --filter vtt-server start`    |

---

## Troubleshooting

### "Port already in use" error

**Option 1: Use the kill script**

```bash
./kill-ports.sh
./dev-start.sh
```

**Option 2: Change the port**
Edit `apps/client/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    port: 5174, // Changed from 5173
    // ...
  },
});
```

### "Permission denied" when killing process

The process might be owned by Windows. Options:

1. Close WSL terminal and reopen
2. Run PowerShell as admin and kill from Windows side
3. Restart WSL: `wsl --shutdown` (from PowerShell)

### Processes keep coming back

Check if you have `nodemon` or similar watchers running:

```bash
ps aux | grep -E "(node|vite|pnpm|tsx)"
```

Kill them all:

```bash
killall -9 node vite pnpm tsx 2>/dev/null
```

### WSL and Windows processes out of sync

Sometimes WSL can't see Windows processes. Try:

1. From WSL: `./kill-ports.sh`
2. From PowerShell (as admin):
   ```powershell
   Get-NetTCPConnection -LocalPort 5173 | ForEach-Object {
       Stop-Process -Id $_.OwningProcess -Force
   }
   ```

---

## Best Practices

1. **Always use the startup script**: `./dev-start.sh`
   - Handles cleanup automatically
   - Builds before starting
   - Easier to stop (Ctrl+C)

2. **Clean shutdown**: Press Ctrl+C once and wait
   - Don't spam Ctrl+C
   - Let processes shut down gracefully

3. **If port is stuck**: Run `./kill-ports.sh` before starting

4. **Regular cleanup**: Periodically run:

   ```bash
   ./kill-ports.sh
   # Wait a few seconds
   ./dev-start.sh
   ```

5. **WSL maintenance**: Occasionally restart WSL to clear cruft:
   ```powershell
   # From PowerShell
   wsl --shutdown
   ```

---

## Development Workflow

### Typical Session

```bash
# Morning start
cd /home/loshunter/HeroByte
./dev-start.sh

# Work on features...

# When done or switching branches
# Press Ctrl+C
# Or in new terminal:
./kill-ports.sh

# Next session
./dev-start.sh  # Automatically cleans up
```

### Quick Restart

```bash
# If servers are misbehaving
./kill-ports.sh
./dev-start.sh
```

### After Git Operations

```bash
# After pull/merge/checkout
./kill-ports.sh      # Clean up old processes
pnpm install         # Update dependencies if needed
./dev-start.sh       # Start fresh
```

---

## Advanced: Process Monitoring

### Check what's running

```bash
# Show all Node/Vite processes
ps aux | grep -E "(node|vite|pnpm)" | grep -v grep

# Show port usage
lsof -i :5173
lsof -i :8787

# Network stats
netstat -tlnp | grep -E "(5173|8787)"
```

### Monitor in real-time

```bash
# Watch port usage
watch -n 2 'lsof -i :5173,8787'

# Watch process list
watch -n 2 'ps aux | grep -E "(node|vite)" | grep -v grep'
```

---

## Emergency Recovery

If nothing works:

1. **Kill everything Node-related**

   ```bash
   killall -9 node
   ```

2. **Restart WSL completely**

   ```powershell
   # From PowerShell
   wsl --shutdown
   # Wait 10 seconds
   wsl
   ```

3. **Reboot** (last resort)
   - Sometimes Windows holds onto ports
   - A full reboot clears everything

---

## Preventing Port Conflicts

### Use the provided scripts

The `dev-start.sh` script handles cleanup automatically.

### Close terminals properly

Always Ctrl+C to stop servers before closing the terminal.

### One dev environment at a time

Don't run multiple instances of the dev servers.

### Check before starting

```bash
lsof -i :5173,5174,8787 && echo "Ports in use!" || ./dev-start.sh
```

---

## Questions?

If you continue having issues:

1. Check if antivirus is blocking port cleanup
2. Check Windows Firewall rules
3. Try running WSL as administrator (not recommended normally)
4. Consider using Docker for more isolation
