# Windows Launch Scripts

These batch files make it easy to run HeroByte on Windows using WSL (Windows Subsystem for Linux).

## Prerequisites

- Windows 10/11 with WSL2 installed
- Ubuntu (or another Linux distro) set up in WSL
- HeroByte cloned to `~/HeroByte` in your WSL home directory
- Node.js and pnpm installed in WSL

## Installation

1. Clone HeroByte to your WSL home directory:

   ```bash
   cd ~
   git clone https://github.com/loshunter/HeroByte.git
   cd HeroByte
   pnpm install
   ```

2. Copy these `.bat` files to a convenient location on Windows (e.g., `D:\HeroByte` or your Desktop)

## Usage

### Start the Server

Double-click **`start-server.bat`**

This will:

- Launch the HeroByte WebSocket server
- Server runs on port 8787
- Keep this window open while playing

### Start the Client

Double-click **`start-client.bat`**

This will:

- Stop any previous HeroByte client process using port 5174 (if needed)
- Launch the HeroByte web client
- Client runs on http://localhost:5174
- Opens automatically in your default browser

### Stop the Client

Double-click **`stop-client.bat`**

This will:

- Force-stop the process using port 5174
- Useful if a previous client window did not close properly

## Troubleshooting

### "Could not stop process" error

If `start-client.bat` can't kill the existing process:

- Run `stop-client.bat` as Administrator (right-click → Run as administrator)
- Or manually close the previous client window

### "bash: cd: ~/HeroByte: No such file or directory"

- Make sure HeroByte is cloned to your WSL home directory
- Check with: `wsl -d Ubuntu bash -ic "ls ~/"`
- You should see `HeroByte` in the list

### "pnpm: command not found"

- Install pnpm in WSL: `npm install -g pnpm`
- Or install Node.js/npm first if needed

### Port already in use

- Run `stop-client.bat` to free port 5174
- Check if another Vite/dev server is running

## Customization

If you cloned HeroByte to a different location, edit the `.bat` files and change:

```batch
cd ~/HeroByte/apps/server
```

to your actual path.

## Alternative: Native Windows

If you prefer running natively on Windows without WSL:

1. Install Node.js on Windows
2. Open PowerShell or Command Prompt
3. Navigate to the HeroByte folder
4. Run:
   ```
   cd apps/server
   pnpm dev
   ```
   And in another terminal:
   ```
   cd apps/client
   pnpm dev
   ```
