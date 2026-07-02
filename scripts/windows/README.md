# Legacy WSL Launch Scripts

These batch files are for an older Windows + WSL setup where HeroByte is cloned inside the Linux home directory. They are kept for legacy use only.

For the current native Windows setup from `D:\HeroByte`, use the root launchers instead:

```batch
start-server-dev.bat
start-client-dev.bat
```

Or run everything from PowerShell:

```powershell
pnpm install
pnpm dev
```

WSL is not required to run HeroByte.

## Prerequisites

Only use these legacy scripts if all of these are true:

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

2. Copy these legacy `.bat` files to a convenient location on Windows if you want WSL-backed launch shortcuts.

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

- Stop a previous HeroByte client process using port 5174 when it is safe to do so
- Launch the HeroByte web client
- Client runs on http://localhost:5174
- Opens automatically in your default browser

### Stop the Client

Double-click **`stop-client.bat`**

This will:

- Stop a stale HeroByte client process using port 5174 when it is safe to do so
- Useful if a previous client window did not close properly

## Troubleshooting

### "Could not stop process" error

If `start-client.bat` cannot release the existing process:

- Check the printed PID and command line
- Manually close the owning process if it is not a HeroByte dev process
- Do not switch the client to another port

### "bash: cd: ~/HeroByte: No such file or directory"

- Make sure HeroByte is cloned to your WSL home directory
- Check with: `wsl -d Ubuntu bash -ic "ls ~/"`
- You should see `HeroByte` in the list

### "pnpm: command not found"

- Install Node.js in WSL, then run `corepack enable pnpm`
- Or install pnpm manually if your Node distribution does not include Corepack

### Port already in use

- Run `stop-client.bat` to safely release a stale HeroByte client on port 5174
- If the script reports an unknown owner, close that process manually

## Customization

If you cloned HeroByte to a different location, edit the `.bat` files and change:

```batch
cd ~/HeroByte
```

to your actual path.

## Native Windows

The preferred Windows setup does not use these legacy scripts:

1. Install Node.js on Windows
2. Open PowerShell or Command Prompt
3. Navigate to the HeroByte folder
4. Run:
   ```powershell
   pnpm install
   pnpm dev
   ```
