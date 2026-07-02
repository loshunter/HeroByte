# Port Management Guide for Local Development

## HeroByte Port Policy

HeroByte uses two fixed local port lanes:

| Port | Service             | Command                             |
| ---- | ------------------- | ----------------------------------- |
| 5174 | Dev frontend        | `pnpm --filter herobyte-client dev` |
| 8787 | Dev backend server  | `pnpm --filter vtt-server dev`      |
| 5175 | E2E test frontend   | `pnpm test:e2e`                     |
| 8788 | E2E test server/API | `pnpm test:e2e`                     |

The frontend is configured with Vite `--strictPort`, so it never silently moves to another port. Local startup runs a preflight first: if `5174` or `8787` is held by a previous HeroByte dev process from this workspace, the preflight stops it, waits for the port to clear, and retries startup on the same static port.

Playwright uses separate E2E ports by default. This lets `pnpm test:e2e` run while the normal dev server is still open on `5174` and `8787`.

## What Was Fixed

The local development setup now uses explicit ports across the app, scripts, tests, and documentation:

- Client dev server: `5174`
- Server dev/API/WebSocket port: `8787`
- Playwright default frontend port: `5175`
- Playwright default backend/WebSocket port: `8788`
- Playwright default WebSocket host: `127.0.0.1`
- Server allowed development origins: `http://localhost:5174` and `http://127.0.0.1:5174`
- Cleanup scripts: safely target dev or E2E ports through `scripts/dev-port-preflight.mjs`
- Startup script: shuts down child client/server processes when stopped

If a port is held by an unknown process, startup fails with the PID and command line instead of killing it or switching ports.

## Quick Start

### Start Development Servers

```bash
pnpm dev
```

Or, from a bash-compatible shell:

```bash
./dev-start.sh
```

### Stop Development Servers

Press `Ctrl+C` once in the terminal running the dev servers and wait for shutdown.

If a previous dev process is still using a HeroByte port:

```bash
pnpm dev:free
```

On Windows:

```powershell
pnpm dev:free
```

### Run E2E Tests

```bash
pnpm test:e2e
```

This uses `5175` and `8788` by default, so you do not need to close a normal `pnpm dev` session first.

## Available Scripts

### `./dev-start.sh`

**Optional bash startup script**

- Safely stops existing HeroByte dev processes on `5174` and `8787`
- Builds the backend
- Starts both servers in order
- Shows status and PIDs
- Stops child processes when interrupted
- Not required for native Windows development; use `pnpm dev` or the root `start-*-dev.bat` files there

### `pnpm dev:doctor`

**Port ownership report**

- Shows whether `5174` and `8787` are free
- Identifies the owning PID and command line when a port is busy
- Labels owners as releasable HeroByte processes or unknown owners
- Does not stop anything

### `pnpm dev:free`

**Safe port cleanup**

- Stops only releasable HeroByte dev processes from this workspace
- Waits for ports to clear before returning
- Refuses to stop unknown owners
- Never changes the configured ports

### `pnpm e2e:doctor`

**E2E port ownership report**

- Shows whether `5175` and `8788` are free
- Uses the same safe owner detection as `pnpm dev:doctor`
- Does not stop anything

### `pnpm e2e:free`

**Safe E2E port cleanup**

- Stops only releasable HeroByte E2E processes from this workspace
- Waits for `5175` and `8788` to clear before returning
- Refuses to stop unknown owners

### `./kill-ports.sh`

**Compatibility wrapper**

- Runs the same safe cleanup as `pnpm dev:free`

### `./clean-start-dev.sh` (Legacy)

**Original cleanup script**

- Still works in bash-compatible shells, but `pnpm dev` is the preferred cross-platform startup path

## Troubleshooting

### "Port 5174 is already in use"

This is expected if another frontend dev server is already running. Vite is intentionally configured to stop instead of choosing another port.

Use:

```bash
pnpm dev
```

`pnpm dev` runs the safe preflight automatically. If you only want to inspect the owner:

```bash
pnpm dev:doctor
```

If you only want to release stale HeroByte dev processes:

```bash
pnpm dev:free
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

### "Port 5175 or 8788 is already in use"

These are the isolated Playwright ports. Use:

```bash
pnpm e2e:doctor
pnpm e2e:free
```

`pnpm test:e2e` runs the E2E preflight automatically, so this manual cleanup is normally only needed after an interrupted test run.

### Windows owns the port

If the port owner is a normal HeroByte Node/Vite process from this workspace, `pnpm dev` or `pnpm dev:free` will stop it automatically. If Windows reports an unknown owner such as `svchost.exe`, do not kill it blindly. Close the app or terminal that owns the port, or run PowerShell as Administrator and inspect the process first.

Then restart HeroByte.

### "Permission denied" when stopping a process

The process might be owned by Windows or another terminal session. Options:

1. Close the terminal that started the dev server
2. Run PowerShell as Administrator and stop the process from Windows
3. If you are intentionally running through WSL, restart WSL with `wsl --shutdown`

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
cd D:/HeroByte
pnpm dev
```

When finished, press `Ctrl+C` once and wait for shutdown.

### Quick Restart

```bash
pnpm dev
```

### After Git Operations

```bash
pnpm dev:free
pnpm install
pnpm dev
```

## Checks

### Show Port Usage

```bash
lsof -i :5174
lsof -i :8787
```

```powershell
Get-NetTCPConnection -LocalPort 5174,8787
Get-NetTCPConnection -LocalPort 5175,8788
```

### Confirm App Health

```bash
curl http://localhost:5174/
curl http://localhost:8787/healthz
curl http://localhost:5175/
curl http://localhost:8788/healthz
```

## Rules for Future Changes

- Do not point Playwright back at the normal dev ports unless there is a specific reason.
- Do not change the local frontend port without updating Vite, docs, and server allowed origins together.
- Keep Vite `--strictPort` enabled for local development.
- Keep cleanup scripts targeted to the documented ports through `scripts/dev-port-preflight.mjs`.
- Treat a busy port as a safe cleanup task when it is owned by HeroByte, not a reason to add alternate ports.
- Do not auto-kill unknown port owners.
- Any new script that binds a HeroByte port must either use isolated ports or run the shared preflight first.
