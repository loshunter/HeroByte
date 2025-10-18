# Testing Infrastructure Setup Guide

This guide is for setting up the testing infrastructure for HeroByte. Follow these phases in order for a systematic implementation.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Familiarity with the monorepo structure (see `package.json` workspaces)

## Project Context

HeroByte uses:

- **Monorepo**: pnpm workspaces (`apps/client`, `apps/server`, `packages/shared`)
- **TypeScript**: Strict mode with NodeNext module resolution
- **Architecture**: Domain-Driven Design with dependency injection
- **WebSocket**: Real-time communication with validation & rate limiting middleware

## Phase 1: Unit Tests for Shared Package

**Goal**: Test shared domain models and utilities with >80% coverage.

### Step 1.1: Install Vitest

```bash
cd packages/shared
pnpm add -D vitest @vitest/coverage-v8
```

### Step 1.2: Configure Vitest

Create `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts", "**/*.test.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### Step 1.3: Add Test Scripts

Update `packages/shared/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 1.4: Create Test Files

Test the following files (create `.test.ts` files alongside each):

#### `packages/shared/src/models.ts`

Focus areas:

- **TokenModel**: Test `move()`, `updateColor()`, position validation
- **PlayerModel**: Test state management, color assignment
- **CharacterModel**: Test HP tracking, `takeDamage()`, `heal()`, `isDead()`
- **DrawingModel**: Test shape properties, validation

Example test structure:

```typescript
// packages/shared/src/models.test.ts
import { describe, it, expect } from "vitest";
import { TokenModel, PlayerModel, CharacterModel } from "./models";

describe("TokenModel", () => {
  it("should initialize with correct default values", () => {
    const token = new TokenModel("token-1", 100, 100, "red");
    expect(token.id).toBe("token-1");
    expect(token.x).toBe(100);
    expect(token.y).toBe(100);
    expect(token.color).toBe("red");
  });

  it("should move to new position", () => {
    const token = new TokenModel("token-1", 0, 0, "red");
    token.move(50, 75);
    expect(token.x).toBe(50);
    expect(token.y).toBe(75);
  });

  // Add more tests for edge cases, validation, etc.
});

describe("CharacterModel", () => {
  it("should take damage correctly", () => {
    const char = new CharacterModel("char-1", "Hero", 100, 100);
    char.takeDamage(30);
    expect(char.currentHp).toBe(70);
  });

  it("should not heal above max HP", () => {
    const char = new CharacterModel("char-1", "Hero", 100, 100);
    char.takeDamage(20);
    char.heal(50);
    expect(char.currentHp).toBe(100);
  });

  it("should report dead when HP reaches 0", () => {
    const char = new CharacterModel("char-1", "Hero", 100, 100);
    char.takeDamage(100);
    expect(char.isDead()).toBe(true);
  });

  // Add more tests
});
```

### Step 1.5: Run Tests

```bash
cd packages/shared
pnpm test:coverage
```

Ensure >80% coverage before moving to Phase 2.

---

## Phase 2: Integration Tests for Server

**Goal**: Test WebSocket communication, message routing, validation, and rate limiting.

### Step 2.1: Install Test Dependencies

```bash
cd apps/server
pnpm add -D vitest @vitest/coverage-v8 ws @types/ws
```

### Step 2.2: Configure Vitest

Create `apps/server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.spec.ts", "**/*.test.ts"],
    },
  },
});
```

### Step 2.3: Add Test Scripts

Update `apps/server/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Step 2.4: Create Integration Tests

#### Test 1: WebSocket Connection Lifecycle

Create `apps/server/src/ws/connectionHandler.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import WebSocket from "ws";
import { createServer } from "http";
// Import your server setup

describe("WebSocket Connection Lifecycle", () => {
  let server: any;
  let wss: any;
  let client: WebSocket;

  beforeEach(async () => {
    // Set up test server
    server = createServer();
    // Initialize your WebSocket server
    await new Promise((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    client?.close();
    wss?.close();
    await new Promise((resolve) => server.close(resolve));
  });

  it("should accept WebSocket connection", async () => {
    const port = server.address().port;
    client = new WebSocket(`ws://localhost:${port}`);

    await new Promise((resolve) => {
      client.on("open", resolve);
    });

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("should handle client disconnect gracefully", async () => {
    // Test disconnect handling
  });

  // Add heartbeat, reconnection tests
});
```

#### Test 2: Message Validation Middleware

Create `apps/server/src/middleware/validation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateMessage } from "./validation";

describe("Message Validation Middleware", () => {
  it("should accept valid token move message", () => {
    const message = {
      type: "token:move",
      payload: { tokenId: "token-1", x: 100, y: 200 },
    };
    const result = validateMessage(message);
    expect(result.valid).toBe(true);
  });

  it("should reject message with invalid type", () => {
    const message = {
      type: "invalid:type",
      payload: {},
    };
    const result = validateMessage(message);
    expect(result.valid).toBe(false);
  });

  it("should reject oversized payload", () => {
    const message = {
      type: "chat:message",
      payload: { text: "a".repeat(10000) }, // Too large
    };
    const result = validateMessage(message);
    expect(result.valid).toBe(false);
  });

  // Test all 15+ message types
});
```

#### Test 3: Rate Limiting

Create `apps/server/src/middleware/rateLimit.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "./rateLimit";

describe("Rate Limiting Middleware", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(100, 1000); // 100 msgs/sec
  });

  it("should allow messages under rate limit", () => {
    for (let i = 0; i < 100; i++) {
      expect(limiter.checkLimit("client-1")).toBe(true);
    }
  });

  it("should block messages exceeding rate limit", () => {
    // Exhaust bucket
    for (let i = 0; i < 100; i++) {
      limiter.checkLimit("client-1");
    }

    // 101st message should be blocked
    expect(limiter.checkLimit("client-1")).toBe(false);
  });

  it("should refill tokens over time", async () => {
    // Test token bucket refill logic
  });
});
```

#### Test 4: Domain Services

Create tests for each domain service in `apps/server/src/domains/`:

```typescript
// apps/server/src/domains/room/RoomService.test.ts
import { describe, it, expect } from "vitest";
import { RoomService } from "./RoomService";

describe("RoomService", () => {
  it("should create a new room with default state", () => {
    const roomService = new RoomService();
    const room = roomService.createRoom("room-1");
    expect(room.id).toBe("room-1");
    expect(room.players).toEqual([]);
    expect(room.tokens).toEqual([]);
  });

  it("should add player to room", () => {
    const roomService = new RoomService();
    const room = roomService.createRoom("room-1");
    roomService.addPlayer(room, "player-1", "Alice");
    expect(room.players.length).toBe(1);
    expect(room.players[0].name).toBe("Alice");
  });

  // Test token management, state sync, etc.
});
```

### Step 2.5: Run Integration Tests

```bash
cd apps/server
pnpm test:coverage
```

---

## Phase 3: CI/CD Pipeline

**Goal**: Automate testing and quality checks on all pull requests.

### Step 3.1: Create GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [main, dev]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm lint

  test-shared:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run shared package tests
        run: pnpm --filter shared test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./packages/shared/coverage/coverage-final.json
          flags: shared

  test-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run server tests
        run: pnpm --filter herobyte-server test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/server/coverage/coverage-final.json
          flags: server

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build client
        run: pnpm --filter herobyte-client build

      - name: Build server
        run: pnpm --filter herobyte-server build
```

### Step 3.2: Add Status Badges

Update `README.md` to include badges:

```markdown
# HeroByte

[![CI](https://github.com/loshunter/HeroByte/actions/workflows/ci.yml/badge.svg)](https://github.com/loshunter/HeroByte/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/loshunter/HeroByte/branch/main/graph/badge.svg)](https://codecov.io/gh/loshunter/HeroByte)

**A retro-inspired virtual tabletop for epic adventures online**
```

### Step 3.3: Set Up Codecov (Optional)

1. Sign up at https://codecov.io with GitHub
2. Add HeroByte repository
3. Get upload token (if private repo)
4. Add to GitHub Secrets as `CODECOV_TOKEN`

---

## Phase 4: E2E Tests (Optional - Lower Priority)

**Goal**: Extend the existing Playwright smoke coverage into full user journeys.

### Step 4.1: Current Baseline

- **Framework**: Playwright (`@playwright/test`)
- **Config**: [`playwright.config.ts`](playwright.config.ts) at the monorepo root
- **Tests**: `apps/e2e/smoke.spec.ts` validates that password `Fun1` joins the default room and renders the tabletop UI
- **Command**: `pnpm test:e2e` (boots client & server automatically)

### Step 4.2: Installing Browsers (first-time setup)

```bash
pnpm exec playwright install --with-deps chromium
```

Run this once per development machine or CI runner to download the Chromium engine and system packages.

### Step 4.3: Adding More Scenarios

Create additional specs in `apps/e2e/` following the existing smoke test structure. Suggested cases:

- `apps/e2e/token-movement.spec.ts` → join room, drag a token, verify position update
- `apps/e2e/dice-roller.spec.ts` → roll dice and assert results broadcast to log
- `apps/e2e/drawing-tools.spec.ts` → sketch on canvas, toggle eraser, confirm persistence

Reference utilities like `page.getByRole`, `page.locator`, and Playwright test fixtures to keep interactions resilient.

### Step 4.4: Reporting

Playwright outputs HTML reports (`playwright-report/index.html`), traces, screenshots, and videos for failed runs. Publish these as CI artifacts to simplify debugging.

### Step 4.5: CI Integration (Planned)

Add a GitHub Actions job that:

1. Installs browser dependencies (`npx playwright install --with-deps chromium`)
2. Boots the stack with `pnpm test:e2e`
3. Uploads the Playwright HTML report and traces as artifacts

---

## Checklist

### Phase 1: Unit Tests ✅

- [ ] Vitest configured in `packages/shared/`
- [ ] Tests for TokenModel
- [ ] Tests for PlayerModel
- [ ] Tests for CharacterModel
- [ ] Tests for DrawingModel
- [ ] Coverage >80%

### Phase 2: Integration Tests ✅

- [ ] Vitest configured in `apps/server/`
- [ ] WebSocket connection tests
- [ ] Message validation tests
- [ ] Rate limiting tests
- [ ] Domain service tests (Room, Player, Token, Map, Dice)

### Phase 3: CI/CD ✅

- [ ] `.github/workflows/ci.yml` created
- [ ] Linting on PRs
- [ ] Tests run on PRs
- [ ] Build validation
- [ ] Coverage reporting (Codecov)
- [ ] Status badges in README

### Phase 4: E2E (Optional) 🔄

- [x] Playwright configured with default-room smoke test
- [ ] Token movement regression test
- [ ] Dice roller test
- [ ] Voice chat test (if feasible)

---

## Important Notes

### Monorepo Testing

When running tests from root:

```bash
# Run all tests
pnpm -r test

# Run tests for specific package
pnpm --filter shared test
pnpm --filter herobyte-server test

# Run with coverage
pnpm -r test:coverage
```

### Test Isolation

- Each test should be independent
- Use `beforeEach` to reset state
- Mock WebSocket connections properly
- Clean up timers and event listeners

### Coverage Goals

- **Shared package**: >80% coverage (strict)
- **Server**: >70% coverage (good)
- **Client**: >50% coverage (E2E covers UI)

### Common Pitfalls

1. **ESM Issues**: Ensure `type: "module"` in package.json
2. **TypeScript Paths**: Configure vitest to resolve TypeScript paths
3. **WebSocket Mocking**: Use proper cleanup to avoid port conflicts
4. **Async Tests**: Always await async operations

---

## Questions?

If you encounter issues:

1. Check monorepo structure (pnpm workspaces)
2. Verify TypeScript config (NodeNext resolution)
3. Review existing middleware/domain logic
4. Ask for clarification on architecture patterns

Good luck! 🚀
