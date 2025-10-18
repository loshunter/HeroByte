# Development Workflow

## Branch Strategy

- **`main`** - Stable production branch, deployed to live servers
- **`dev`** - Development branch for new features and refactoring

Use `scripts/sync-dev.sh` (documented in [docs/LOCAL_SYNC.md](docs/LOCAL_SYNC.md)) to fast-forward your local branch to the latest remote commits and install the required Playwright dependencies in one step.

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

## Current Architecture (Phase 5: Domain-Driven Design)

### Client Structure

```
apps/client/src/
├── services/          # Service layer (WebSocket, voice chat)
├── hooks/             # React hooks (useWebSocket, etc.)
├── utils/             # Utilities (session management, etc.)
├── features/          # Feature-based modules
│   ├── map/
│   │   ├── components/  # Map layer components (React.memo optimized)
│   │   └── types.ts     # Feature types
│   ├── dice/            # Dice roller feature
│   └── drawing/         # Drawing tools
├── components/        # Shared components
├── theme/             # Styling and themes
└── ui/                # Main UI components
```

### Server Structure

```
apps/server/src/
├── domains/           # Domain services (DDD pattern)
│   ├── room/          # Room state management
│   ├── player/        # Player operations
│   ├── token/         # Token management
│   ├── map/           # Map state
│   └── dice/          # Dice rolling
├── middleware/        # Cross-cutting concerns
│   ├── validation.ts  # Input validation
│   └── rateLimit.ts   # Rate limiting (100 msg/sec)
├── http/              # HTTP endpoint handlers
│   └── routes.ts      # Health check endpoints
├── ws/                # WebSocket infrastructure
│   ├── connectionHandler.ts  # Connection lifecycle
│   └── messageRouter.ts      # Message routing
├── container.ts       # Dependency injection container
└── index.ts           # Bootstrap layer
```

### Shared Package

```
packages/shared/src/
├── index.ts          # Type definitions and interfaces
└── models.ts         # Domain model classes (TokenModel, PlayerModel)
```

## Key Improvements

### Phase 1-2: Foundation

- ✅ Production-ready WebSocket service with reconnection and heartbeat
- ✅ Custom React hooks for state management
- ✅ Domain model classes with business logic
- ✅ MapBoard decomposed into focused layer components
- ✅ Full TypeScript type safety

### Phase 3: Domain-Driven Architecture

- ✅ Separated domain services (Room, Player, Token, Map, Dice)
- ✅ Message router for handling different message types
- ✅ Clear separation between business logic and infrastructure

### Phase 4: Performance & Security

- ✅ React.memo optimization for map layer components
- ✅ Input validation middleware for all WebSocket messages
- ✅ Rate limiting (token bucket, 100 messages/second per client)
- ✅ Protection against malformed data and DoS attacks

### Phase 5: Advanced Separation of Concerns

- ✅ Dependency injection container for service management
- ✅ Separated HTTP routes from WebSocket handlers
- ✅ ConnectionHandler for WebSocket lifecycle management
- ✅ Bootstrap layer reduced to thin initialization (71 lines from 172)
- ✅ Single Responsibility Principle throughout codebase

## Structural Guardrails

- Run `node scripts/structure-report.mjs` to list the largest source files and surface SOLID refactor hints.
- Default threshold is 350 LOC; flagged files display ⚠️ with suggested extraction strategies.
- Use `--limit`, `--threshold`, `--json`, and `--include-tests` to tailor reports or feed structured output into CI.
- Capture characterization tests before reshaping a flagged module so behaviour remains stable during decomposition.
- CI automatically runs `pnpm lint:structure`; reviews should inspect the attached report artifacts before approving large diffs.
