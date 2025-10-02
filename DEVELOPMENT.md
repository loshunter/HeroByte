# Development Workflow

## Branch Strategy

- **`main`** - Stable production branch, deployed to live servers
- **`dev`** - Development branch for new features and refactoring

## Local Development

### Running the Dev Branch

Use these batch files to run the development version:

```batch
# Terminal 1: Start the server
start-server-dev.bat

# Terminal 2: Start the client
start-client-dev.bat
```

These scripts will:
1. Automatically switch to the `dev` branch
2. Start the development servers
3. Client runs on http://localhost:5173
4. Server runs on http://localhost:8787

### Running the Main Branch

Use the original batch files to run the stable version:

```batch
# Terminal 1: Start the server
start-server.bat

# Terminal 2: Start the client
start-client.bat
```

## Development Workflow

1. **Make changes on dev branch**
   ```bash
   git checkout dev
   # Make your changes
   git add .
   git commit -m "Your commit message"
   ```

2. **Test locally**
   - Run `start-server-dev.bat` and `start-client-dev.bat`
   - Test all functionality

3. **Push to GitHub dev branch**
   ```bash
   git push origin dev
   ```

4. **When ready to deploy, merge to main**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```

5. **Deploy to production**
   - Server: Push to Render (auto-deploys from main branch)
   - Client: Push to Cloudflare Pages (auto-deploys from main branch)

## Current Architecture (Post-Phase 1 Refactoring)

### Client Structure
```
apps/client/src/
├── services/          # Service layer (WebSocket, etc.)
├── hooks/             # React hooks (useWebSocket, etc.)
├── utils/             # Utilities (session management, etc.)
├── features/          # Feature-based modules
│   └── map/
│       ├── components/  # Map layer components
│       └── types.ts     # Feature types
├── components/        # Shared components
└── ui/               # Main UI components
```

### Shared Package
```
packages/shared/src/
├── index.ts          # Type definitions and interfaces
└── models.ts         # Domain model classes (TokenModel, PlayerModel)
```

## Key Improvements in Dev Branch

- ✅ Production-ready WebSocket service with reconnection and heartbeat
- ✅ Custom React hooks for state management
- ✅ Domain model classes with business logic
- ✅ MapBoard decomposed into focused layer components
- ✅ Better separation of concerns
- ✅ Full TypeScript type safety
