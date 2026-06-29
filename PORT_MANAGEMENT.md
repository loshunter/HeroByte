# Port Management Guide for Local Development

## HeroByte Port Policy

HeroByte uses one local port policy:

| Port | Service        | Command                             |
| ---- | -------------- | ----------------------------------- |
| 5174 | Frontend       | `pnpm --filter herobyte-client dev` |
| 8787 | Backend Server | `pnpm --filter vtt-server dev`      |

The frontend is configured with Vite `--strictPort`, so it fails clearly if `5174` is already in use. It should not silently move to another port.

## What Was Fixed

The local development setup now uses the same ports across the app, scripts, tests, and documentation:

- Client dev server: `5174`
- Server dev/API/WebSocket port: `8787`
- Playwright default frontend port: `5174`
- Playwright default WebSocket host: `127.0.0.1`
- Server allowed development origins: `http://localhost:5174` and `http://127.0.0.1:5174`
- Cleanup scripts: target `5174` and `8787`
- Startup script: shuts down child client/server processes when stopped

This means a port conflict should be explicit: stop the process that owns the port, then restart on the same configured port.

## Quick Start

### Start Development Servers

```bash
./dev-start.sh
```

Or, from PowerShell/CMD:

```powershell
pnpm dev
```

### Stop Development Servers

Press `Ctrl+C` once in the terminal running the dev servers and wait for shutdown.

If a previous dev process is still using a HeroByte port:

```bash
./kill-ports.sh
```

On Windows:

```powershell
.\kill-client-port.bat
```

## Available Scripts

### `./dev-start.sh`

**Comprehensive startup script**

- Stops existing HeroByte dev processes on `5174` and `8787`
- Builds the backend
- Starts both servers in order
- Shows status and PIDs
- Stops child processes when interrupted

### `./kill-ports.sh`

**Port cleanup script**

- Stops processes on ports `5174` and `8787`
- Stops common HeroByte dev server processes
- Verifies the ports are free

### `./clean-start-dev.sh` (Legacy)

**Original cleanup script**

- Still works, but `dev-start.sh` is the preferred startup path

## Troubleshooting

### "Port 5174 is already in use"

This is expected if another frontend dev server is already running. Vite is intentionally configured to stop instead of choosing another port.

Use:

```bash
./kill-ports.sh
./dev-start.sh
```

Or identify the process manually:

```bash
lsof -i :5174
lsof -i :8787
```

On Windows:

```powershell
netstat -ano | findstr :5174
netstat -ano | findstr :8787
```

Then stop the owning process if it is a previous Node/Vite/HeroByte process.

### Windows or WSL owns the port

If the port owner is a normal HeroByte Node/Vite process, stop it. If Windows reports the owner as `svchost.exe`, prefer restarting WSL instead of killing the service-host process directly:

```powershell
wsl --shutdown
```

Then restart HeroByte.

### "Permission denied" when stopping a process

The process might be owned by Windows or another terminal session. Options:

1. Close the terminal that started the dev server
2. Run PowerShell as Administrator and stop the process from Windows
3. Restart WSL with `wsl --shutdown`

### WebSocket refuses connections

Confirm the backend is running:

```bash
curl http://localhost:8787/healthz
```

The expected response is:

```text
ok
```

## Development Workflow

### Typical Session

```bash
cd /home/loshunter/HeroByte
./dev-start.sh
```

When finished, press `Ctrl+C` once and wait for shutdown.

### Quick Restart

```bash
./kill-ports.sh
./dev-start.sh
```

### After Git Operations

```bash
./kill-ports.sh
pnpm install
./dev-start.sh
```

## Checks

### Show Port Usage

```bash
lsof -i :5174
lsof -i :8787
```

```powershell
Get-NetTCPConnection -LocalPort 5174,8787
```

### Confirm App Health

```bash
curl http://localhost:5174/
curl http://localhost:8787/healthz
```

## Rules for Future Changes

- Do not change the local frontend port without updating Vite, Playwright, docs, and server allowed origins together.
- Keep Vite `--strictPort` enabled for local development.
- Keep cleanup scripts targeted to the same documented ports.
- Treat a busy port as a process cleanup task, not a reason to add alternate ports.
