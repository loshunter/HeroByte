# Server WebSocket ConnectionHandler Refactoring Plan

**Date Created:** 2025-01-14
**Status:** 🚧 **IN PROGRESS**
**Target:** `apps/server/src/ws/connectionHandler.ts`
**Original LOC:** 201
**Goal:** Separate connection lifecycle from domain responsibilities

> **Pattern Source:** This plan follows the SOLID principles and extraction patterns established in the successful [CLIENT_WEBSOCKET_PLAN.md](./CLIENT_WEBSOCKET_PLAN.md) refactoring.

---

## Executive Summary

The `ConnectionHandler` class conflates 5 distinct responsibilities that violate Single Responsibility Principle (SRP). This plan decomposes it into focused managers following SOLID principles:

1. **ConnectionLifecycleManager** - WebSocket connection registration, replacement, keepalive
2. **MessagePipelineManager** - Message parsing, size validation, rate limiting
3. **DisconnectionCleanupManager** - Cleanup state on disconnection
4. **MessageAuthenticator** - Authentication message routing and access control
5. **ConnectionHandler** (orchestrator) - Delegates to managers, coordinates flow

The refactored **ConnectionHandler** will be a pure orchestrator (~80 LOC), delegating to specialized managers.

---

## Current State Analysis

### File: `apps/server/src/ws/connectionHandler.ts` (201 LOC)

**Current Responsibilities:**

1. **WebSocket Lifecycle Management** (~45 LOC)
   - Connection registration (line 81)
   - Connection replacement detection (lines 62-70)
   - Keepalive ping to prevent cloud timeouts (lines 84-88)
   - WebSocket state tracking via Container maps

2. **Message Reception & Parsing** (~30 LOC)
   - Raw buffer to JSON parsing (line 113)
   - Message size validation - DoS protection (lines 104-110: 1MB limit)
   - Rate limiting enforcement (lines 116-119: 100 msg/sec per client)
   - Input validation dispatch (lines 122-126)

3. **Authentication Handling** (~35 LOC)
   - Routes authentication messages to `AuthenticationHandler` (lines 132-158):
     - `authenticate` → creates player/character/token entities
     - `elevate-to-dm` → grants DM privileges
     - `revoke-dm` → revokes DM status
     - `set-dm-password` → manages DM password
   - Checks authentication state (line 137)
   - Drops unauthenticated messages (lines 137-140)

4. **Connection State Tracking** (~25 LOC)
   - Manages `uidToWs` map (line 81)
   - Manages `authenticatedUids` set (lines 75-76, 192)
   - Manages `authenticatedSessions` map (lines 76, 193)
   - Seamless reconnection logic (lines 72-78)

5. **Disconnection Cleanup** (~25 LOC)
   - Clear keepalive interval (line 178)
   - Prevent race condition cleanup (lines 184-188)
   - Clean up player state (lines 191-195)
   - Trigger broadcast (line 198)

6. **Message Routing** (~10 LOC)
   - Routes validated messages to `MessageRouter` (line 162)

**Complexity Breakdown:**

| Component | LOC | Complexity | Responsibility |
|-----------|-----|-----------|-----------------|
| Connection Lifecycle | 45 | High (4) | Connect/replace/keepalive |
| Message Pipeline | 30 | Medium (3) | Parse/validate/rate-limit |
| Authentication | 35 | High (4) | Auth routing, access control |
| State Tracking | 25 | Medium (3) | Map/Set management |
| Disconnection Cleanup | 25 | High (4) | State cleanup, race prevention |
| Message Routing | 10 | Low (2) | Delegate to MessageRouter |

**Existing Managers:**

- **AuthenticationHandler** (apps/server/src/ws/auth/AuthenticationHandler.ts) - 314 LOC
  - Handles authentication flow, DM elevation, password management
  - Creates player/character/token entities on auth
  - Already follows SRP well

- **HeartbeatTimeoutManager** (apps/server/src/ws/lifecycle/HeartbeatTimeoutManager.ts) - 98 LOC
  - Monitors player inactivity (5-minute timeout)
  - Cleans up timed-out players
  - **ISSUE:** Duplicates disconnection cleanup logic

---

## Identified Problems

### 1. **Duplicated Cleanup Logic**

Both `ConnectionHandler.handleDisconnection()` (lines 176-198) and `HeartbeatTimeoutManager.checkForTimedOutPlayers()` perform similar cleanup:

**ConnectionHandler cleanup:**
```typescript
state.users = state.users.filter((u) => u !== uid);
this.container.authenticatedUids.delete(uid);
this.container.authenticatedSessions.delete(uid);
this.container.uidToWs.delete(uid);
this.container.selectionService.deselect(state, uid);
this.container.roomService.broadcast(this.container.getAuthenticatedClients());
```

**HeartbeatTimeoutManager cleanup:**
```typescript
ws.close();
state.players = state.players.filter((p) => p.uid !== uid);
state.tokens = state.tokens.filter((t) => t.owner !== uid);
state.users = state.users.filter((u) => u !== uid);
uidToWs.delete(uid);
authenticatedUids.delete(uid);
authenticatedSessions.delete(uid);
selectionService.deselect(state, uid);
roomService.broadcast(getAuthenticatedClients());
```

**Solution:** Extract into `DisconnectionCleanupManager` used by both.

### 2. **Mixed Security Concerns**

Security validations scattered across ConnectionHandler:
- Line 104-110: Message size limit (DoS protection)
- Line 116-119: Rate limiting (spam prevention)
- Line 122-126: Input validation (type checking)
- Line 137-140: Authentication check (access control)

**Solution:** Consolidate into `MessagePipelineManager`.

### 3. **Unclear Reconnection Semantics**

Lines 72-78 implement "seamless reconnection" but logic is unclear:
```typescript
if (!wasAuthenticated) {
  this.container.authenticatedUids.delete(uid);
  this.container.authenticatedSessions.delete(uid);
  state.users = state.users.filter((u) => u !== uid);
}
```

**Question:** Should reconnection preserve auth state? Currently it does if `wasAuthenticated` is true.

**Solution:** Make explicit with `ReconnectionPolicy` in `ConnectionLifecycleManager`.

---

## Proposed Decomposition

### Manager 1: ConnectionLifecycleManager (~70 LOC)

**Purpose:** Handle WebSocket connection registration, replacement, and keepalive

**File Location:** `apps/server/src/ws/lifecycle/ConnectionLifecycleManager.ts`

**Exports:**

```typescript
export interface ConnectionLifecycleConfig {
  keepaliveInterval: number; // Default: 25000ms
  onConnection: (uid: string, ws: WebSocket, wasAuthenticated: boolean) => void;
}

export class ConnectionLifecycleManager {
  constructor(
    config: ConnectionLifecycleConfig,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>
  );

  /**
   * Register new WebSocket connection
   * Handles connection replacement and seamless reconnection
   */
  registerConnection(
    uid: string,
    ws: WebSocket,
    req: IncomingMessage
  ): { wasAuthenticated: boolean };

  /**
   * Start keepalive ping for connection
   * Prevents cloud provider timeout
   */
  startKeepalive(ws: WebSocket): NodeJS.Timeout;

  /**
   * Stop keepalive for connection
   */
  stopKeepalive(keepaliveTimer: NodeJS.Timeout): void;

  /**
   * Check if this WebSocket is still the current connection for UID
   * Prevents race condition during reconnection
   */
  isCurrentConnection(uid: string, ws: WebSocket): boolean;
}
```

**Responsibilities:**

- Extract UID from connection URL
- Detect and replace existing connections
- Implement seamless reconnection (preserve auth state)
- Manage keepalive ping interval
- Prevent race conditions during replacement

**Extraction Source:**

- Lines 56-57: Extract UID from URL
- Lines 62-70: Connection replacement detection
- Lines 72-78: Seamless reconnection logic
- Lines 81: Connection registration (`uidToWs.set()`)
- Lines 84-88: Keepalive ping management
- Lines 184-188: Race condition prevention

**Dependencies:**

- `uidToWs: Map<string, WebSocket>` (from Container)
- `authenticatedUids: Set<string>` (from Container)
- `IncomingMessage` (from http)

**Tests Needed:**

- Extract UID from connection URL
- Replace existing connection for same UID
- Preserve auth state on reconnection
- Clear auth state for new connections
- Start keepalive at correct interval
- Stop keepalive on disconnection
- Detect race condition (stale connection close)
- Handle anonymous UIDs ("anon")

---

### Manager 2: MessagePipelineManager (~65 LOC)

**Purpose:** Parse, validate, and pre-process inbound messages

**File Location:** `apps/server/src/ws/message/MessagePipelineManager.ts`

**Exports:**

```typescript
export interface MessagePipelineConfig {
  maxMessageSize: number;      // Default: 1MB
  onValidMessage: (message: ClientMessage, uid: string) => void;
  onInvalidMessage?: (uid: string, reason: string) => void;
}

export class MessagePipelineManager {
  constructor(
    config: MessagePipelineConfig,
    rateLimiter: RateLimiter
  );

  /**
   * Process incoming message through validation pipeline
   * Returns true if message was processed, false if rejected
   */
  processMessage(buffer: Buffer, uid: string): boolean;

  private checkMessageSize(buffer: Buffer): boolean;
  private parseJSON(buffer: Buffer, uid: string): unknown | null;
  private checkRateLimit(uid: string): boolean;
  private validateMessage(rawMessage: unknown, uid: string): ClientMessage | null;
}
```

**Responsibilities:**

- Message size validation (DoS protection: 1MB limit)
- JSON parsing with error handling
- Rate limiting enforcement (100 msg/sec per client)
- Input validation dispatch (via `validateMessage`)
- Error logging for invalid messages

**Extraction Source:**

- Lines 104-110: Message size check
- Line 113: JSON parsing
- Lines 116-119: Rate limiting
- Lines 122-126: Input validation
- Lines 163-169: Error handling

**Dependencies:**

- `RateLimiter` (from Container)
- `validateMessage()` (from middleware/validation.ts)
- `ClientMessage` type (from @shared)

**Tests Needed:**

- Accept message under 1MB
- Reject message over 1MB
- Parse valid JSON
- Handle invalid JSON gracefully
- Enforce rate limit per client
- Allow messages when under rate limit
- Validate message structure
- Reject invalid message types
- Log errors for debugging

---

### Manager 3: DisconnectionCleanupManager (~55 LOC)

**Purpose:** Centralize cleanup logic for disconnected/timed-out players

**File Location:** `apps/server/src/ws/lifecycle/DisconnectionCleanupManager.ts`

**Exports:**

```typescript
export interface DisconnectionCleanupConfig {
  roomService: RoomService;
  selectionService: SelectionService;
  getAuthenticatedClients: () => Set<WebSocket>;
}

export class DisconnectionCleanupManager {
  constructor(
    config: DisconnectionCleanupConfig,
    uidToWs: Map<string, WebSocket>,
    authenticatedUids: Set<string>,
    authenticatedSessions: Map<string, SessionData>
  );

  /**
   * Clean up all state for a disconnected player
   * Used by both normal disconnection and timeout cleanup
   */
  cleanupPlayer(uid: string, options?: {
    closeWebSocket?: boolean;  // Close the WebSocket (for timeout)
    removeTokens?: boolean;    // Remove player tokens (for timeout)
  }): void;

  /**
   * Verify this WebSocket is still current before cleanup
   * Prevents race condition during replacement
   */
  private isCurrentConnection(uid: string, ws: WebSocket): boolean;
}
```

**Responsibilities:**

- Remove player from `state.users`
- Remove player from `state.players` (optional, for timeout)
- Remove player tokens (optional, for timeout)
- Clear `uidToWs` map entry
- Clear `authenticatedUids` set entry
- Clear `authenticatedSessions` map entry
- Deselect player's selections
- Broadcast updated state
- Optionally close WebSocket (for timeout)
- Race condition prevention

**Extraction Source:**

**From ConnectionHandler.handleDisconnection():**
- Lines 178: Clear keepalive
- Lines 184-188: Race condition check
- Lines 191-195: State cleanup
- Line 198: Broadcast

**From HeartbeatTimeoutManager.checkForTimedOutPlayers():**
- Line 79: Close WebSocket
- Lines 82-86: State cleanup
- Lines 88-91: Map/Set cleanup
- Line 95: Broadcast

**Dependencies:**

- `RoomService` (for getState, broadcast)
- `SelectionService` (for deselect)
- `uidToWs`, `authenticatedUids`, `authenticatedSessions` (from Container)

**Tests Needed:**

- Clean up user from state
- Clean up authentication state
- Clean up WebSocket map
- Deselect player objects
- Broadcast after cleanup
- Skip cleanup if connection replaced (race prevention)
- Optional: close WebSocket
- Optional: remove player tokens
- Optional: remove player entity

---

### Manager 4: MessageAuthenticator (~50 LOC)

**Purpose:** Route authentication messages and enforce access control

**File Location:** `apps/server/src/ws/auth/MessageAuthenticator.ts`

**Exports:**

```typescript
export interface MessageAuthenticatorConfig {
  authHandler: AuthenticationHandler;
  onAuthMessage: (uid: string, message: ClientMessage) => void;
  onUnauthenticatedMessage: (uid: string) => void;
}

export class MessageAuthenticator {
  constructor(
    config: MessageAuthenticatorConfig,
    authenticatedUids: Set<string>
  );

  /**
   * Check if message requires authentication
   * Returns true if message was handled (auth message or should drop)
   * Returns false if message should be routed to MessageRouter
   */
  checkAuthentication(message: ClientMessage, uid: string): boolean;

  private isAuthMessage(message: ClientMessage): boolean;
  private routeAuthMessage(message: ClientMessage, uid: string): void;
  private isAuthenticated(uid: string): boolean;
}
```

**Responsibilities:**

- Identify authentication messages (`authenticate`, `elevate-to-dm`, `revoke-dm`, `set-dm-password`)
- Route authentication messages to `AuthenticationHandler`
- Enforce access control (drop unauthenticated messages)
- Return routing decision (handled vs. pass-through)

**Extraction Source:**

- Lines 132-158: Authentication message routing
- Lines 137-140: Unauthenticated message check

**Dependencies:**

- `AuthenticationHandler` (from Container)
- `authenticatedUids: Set<string>` (from Container)
- `ClientMessage` type (from @shared)

**Tests Needed:**

- Detect "authenticate" message
- Detect "elevate-to-dm" message
- Detect "revoke-dm" message
- Detect "set-dm-password" message
- Route auth messages to AuthenticationHandler
- Allow authenticated messages through
- Drop unauthenticated non-auth messages
- Log warnings for dropped messages

---

### Orchestrator: ConnectionHandler (Refactored, ~80 LOC)

**Purpose:** Orchestrate managers and coordinate WebSocket connection flow

**File Location:** `apps/server/src/ws/connectionHandler.ts` (refactored)

**Responsibilities:**

- Create and inject all managers
- Attach to WebSocketServer (`wss.on("connection")`)
- Coordinate message flow through pipeline
- Wire up connection/message/disconnection handlers
- Delegate to appropriate manager at each step

**Methods:**

```typescript
export class ConnectionHandler {
  // Public API
  attach(): void;  // Attach to WebSocket server

  // Event handlers
  private handleConnection(ws: WebSocket, req: IncomingMessage): void;
  private handleMessage(buffer: Buffer, uid: string): void;
  private handleDisconnection(uid: string, keepaliveTimer: NodeJS.Timeout, ws: WebSocket): void;

  // Coordination
  private setupMessageHandler(ws: WebSocket, uid: string, keepaliveTimer: NodeJS.Timeout): void;
  private setupDisconnectHandler(ws: WebSocket, uid: string, keepaliveTimer: NodeJS.Timeout): void;
}
```

**Message Flow (Orchestrated):**

```
1. WebSocket "connection" event
   ↓
2. ConnectionLifecycleManager.registerConnection()
   → Replace existing connection if needed
   → Determine wasAuthenticated flag
   ↓
3. ConnectionLifecycleManager.startKeepalive()
   → Start 25s ping interval
   ↓
4. Setup message handler
   ↓

──────────────────────────────────────

5. WebSocket "message" event
   ↓
6. MessagePipelineManager.processMessage()
   → Check size (< 1MB)
   → Parse JSON
   → Check rate limit
   → Validate message structure
   ↓
7. MessageAuthenticator.checkAuthentication()
   → If auth message: route to AuthenticationHandler
   → If not authenticated: drop message
   → If authenticated: return false (pass-through)
   ↓
8. MessageRouter.route()
   → Route to domain handlers
   ↓

──────────────────────────────────────

9. WebSocket "close" event
   ↓
10. ConnectionLifecycleManager.stopKeepalive()
    ↓
11. ConnectionLifecycleManager.isCurrentConnection()
    → If stale connection: ignore close event
    ↓
12. DisconnectionCleanupManager.cleanupPlayer()
    → Clean up state, maps, selections
    → Broadcast updated state
```

**What Stays in ConnectionHandler:**

- Container reference (~5 LOC)
- Manager initialization (~25 LOC)
- Event handler wiring (~30 LOC)
- Coordination between managers (~20 LOC)

**What Gets Removed:**

- Connection registration logic → ConnectionLifecycleManager
- Keepalive logic → ConnectionLifecycleManager
- Message parsing/validation → MessagePipelineManager
- Authentication routing → MessageAuthenticator
- Cleanup logic → DisconnectionCleanupManager

---

## Dependency Graph

```
ConnectionHandler (orchestrator)
  ├── ConnectionLifecycleManager
  │   └── (depends on: uidToWs, authenticatedUids)
  │
  ├── MessagePipelineManager
  │   └── (depends on: RateLimiter, validateMessage)
  │
  ├── MessageAuthenticator
  │   └── (depends on: AuthenticationHandler, authenticatedUids)
  │
  ├── DisconnectionCleanupManager
  │   └── (depends on: RoomService, SelectionService, Container maps)
  │
  ├── AuthenticationHandler (existing)
  │   └── (depends on: multiple services)
  │
  ├── HeartbeatTimeoutManager (existing, will be updated)
  │   └── (uses DisconnectionCleanupManager instead of duplicating)
  │
  └── MessageRouter (existing)
      └── (handles domain message routing)
```

**Shared Dependencies (Container):**

All managers share these from Container:
- `uidToWs: Map<string, WebSocket>`
- `authenticatedUids: Set<string>`
- `authenticatedSessions: Map<string, SessionData>`
- `roomService: RoomService`
- `selectionService: SelectionService`

---

## Extraction Order (Low Dependency First)

### Phase 1: Cleanup Infrastructure (Day 1)
**Duration:** 1 day

1. **DisconnectionCleanupManager** (Day 1)
   - No dependencies on other new managers
   - Centralizes duplicated cleanup logic
   - Easy to test with mocks
   - Update `HeartbeatTimeoutManager` to use it
   - Branch: `refactor/server/disconnection-cleanup-manager`

### Phase 2: Message Processing (Day 2-3)
**Duration:** 2 days

2. **MessagePipelineManager** (Day 2)
   - Only depends on existing `RateLimiter`
   - Pure validation pipeline
   - Easy to test with buffer fixtures
   - Branch: `refactor/server/message-pipeline-manager`

3. **MessageAuthenticator** (Day 3)
   - Depends on existing `AuthenticationHandler`
   - Simple routing logic
   - Easy to test with message fixtures
   - Branch: `refactor/server/message-authenticator`

### Phase 3: Connection Lifecycle (Day 4)
**Duration:** 1 day

4. **ConnectionLifecycleManager** (Day 4)
   - Connection logic with keepalive
   - Depends on Container maps
   - Requires WebSocket mocking
   - Branch: `refactor/server/connection-lifecycle-manager`

### Phase 4: Orchestration (Day 5)
**Duration:** 1 day

5. **Update ConnectionHandler** (Day 5)
   - Wire up all managers
   - Update event handlers
   - Verify all tests pass
   - Branch: `refactor/server/connection-handler-orchestrator`

---

## Testing Strategy

### Characterization Tests (Before Extraction)

Before extracting each manager, write tests capturing current behavior:

**DisconnectionCleanupManager Tests:**
- Clean up user from state
- Clean up authentication state
- Clear WebSocket map
- Deselect player selections
- Broadcast after cleanup
- Skip cleanup if connection replaced
- Optional cleanup modes (close WS, remove tokens)

**MessagePipelineManager Tests:**
- Accept valid message under 1MB
- Reject message over 1MB
- Parse valid JSON
- Handle invalid JSON
- Enforce rate limit
- Accept under rate limit
- Validate message structure
- Reject invalid types

**MessageAuthenticator Tests:**
- Detect authenticate message
- Detect elevate-to-dm message
- Detect revoke-dm message
- Detect set-dm-password message
- Route to AuthenticationHandler
- Allow authenticated messages
- Drop unauthenticated messages

**ConnectionLifecycleManager Tests:**
- Extract UID from URL
- Replace existing connection
- Preserve auth on reconnection
- Clear auth for new connection
- Start keepalive interval
- Stop keepalive
- Detect race condition

### Unit Tests (After Extraction)

Each manager gets comprehensive unit tests:

**Coverage Target:** 80%+ per manager

**Test Structure:**

```
apps/server/src/ws/__tests__/
├── lifecycle/
│   ├── ConnectionLifecycleManager.test.ts  (12 tests)
│   ├── DisconnectionCleanupManager.test.ts (10 tests)
│   └── HeartbeatTimeoutManager.test.ts     (updated, 8 tests)
├── message/
│   └── MessagePipelineManager.test.ts      (14 tests)
├── auth/
│   └── MessageAuthenticator.test.ts        (10 tests)
└── connectionHandler.integration.test.ts   (8 tests)
```

### Integration Tests

Verify orchestrator coordinates managers correctly:

- Full connection workflow: connect → authenticate → message → route
- Disconnection cleanup flow
- Timeout cleanup flow
- Connection replacement flow
- Race condition prevention
- Message validation pipeline
- Authentication enforcement

---

## Success Metrics

**Quantitative:**

- ✅ ConnectionHandler: 201 → ~80 LOC (60% reduction)
- ✅ 4 focused managers created (~240 LOC total)
- ✅ Average manager size: ~60 LOC
- ✅ Eliminated duplicated cleanup logic
- ✅ Test coverage maintained (0 test failures)
- ✅ 50+ new characterization tests

**Qualitative:**

- ✅ Each manager has single clear responsibility
- ✅ No circular dependencies in manager graph
- ✅ Connection lifecycle is explicit and trackable
- ✅ Message validation is isolated and testable
- ✅ Authentication routing is centralized
- ✅ Cleanup logic is shared (no duplication)
- ✅ Race conditions explicitly handled

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| **Circular dependencies** | Extract in dependency order (cleanup → pipeline → auth → lifecycle) |
| **State synchronization** | Characterization tests capture exact behavior |
| **Race conditions** | Explicit race prevention in ConnectionLifecycleManager |
| **Cleanup duplication** | DisconnectionCleanupManager used by both paths |
| **Timer leaks** | Explicit cleanup coordination in orchestrator |

### Process Risks

| Risk | Mitigation |
|------|-----------|
| **API breaks** | Maintain ConnectionHandler.attach() public API exactly |
| **Timing regressions** | Manual testing with real WebSocket clients |
| **Integration issues** | Integration tests verify manager coordination |
| **Merge conflicts** | Small PRs, frequent rebasing on dev |

---

## Estimated Timeline

**Conservative:** 5 working days (1 week)
**Optimistic:** 4 working days

**Breakdown:**
- Phase 1 (Cleanup): 1 day
- Phase 2 (Message processing): 2 days
- Phase 3 (Lifecycle): 1 day
- Phase 4 (Orchestration): 1 day

**Total:** 5 days → ~1 week

---

## File Structure (After Refactoring)

```
apps/server/src/ws/
├── connectionHandler.ts                     # 80 LOC - Orchestrator
├── lifecycle/
│   ├── ConnectionLifecycleManager.ts        # 70 LOC (new)
│   ├── DisconnectionCleanupManager.ts       # 55 LOC (new)
│   └── HeartbeatTimeoutManager.ts           # 60 LOC (updated, uses cleanup manager)
├── message/
│   └── MessagePipelineManager.ts            # 65 LOC (new)
├── auth/
│   ├── AuthenticationHandler.ts             # 314 LOC (existing, unchanged)
│   └── MessageAuthenticator.ts              # 50 LOC (new)
└── __tests__/
    ├── lifecycle/
    │   ├── ConnectionLifecycleManager.test.ts
    │   ├── DisconnectionCleanupManager.test.ts
    │   └── HeartbeatTimeoutManager.test.ts
    ├── message/
    │   └── MessagePipelineManager.test.ts
    ├── auth/
    │   └── MessageAuthenticator.test.ts
    └── connectionHandler.integration.test.ts
```

---

## Lessons from Client Refactoring

The client WebSocket refactoring (512 → 238 LOC, 54% reduction) demonstrated these best practices that we'll apply here:

1. **Characterization Tests First** - Write tests before extraction to lock in behavior
2. **Dependency-Aware Order** - Extract utilities before handlers
3. **Small Manager Responsibilities** - Each manager does ONE thing well
4. **Clean Interfaces** - Minimal, explicit dependencies between managers
5. **Incremental Extraction** - One manager per PR
6. **Zero Behavioral Change** - Extract first, refactor second (separate commits)
7. **Comprehensive Documentation** - Explain orchestration and coordination
8. **Parallel Pattern** - Server mirrors client architecture

---

## Implementation Checklist

### Before Starting Any Extraction

- [ ] Create feature branch: `refactor/server/connection-handler-managers`
- [ ] Ensure all existing tests pass
- [ ] Review this plan
- [ ] Set up test environment

### For Each Manager Extraction

- [ ] Write characterization tests (BEFORE extraction)
- [ ] Create new manager file with stub
- [ ] Extract logic from ConnectionHandler
- [ ] Add JSDoc and type annotations
- [ ] Fix TypeScript errors
- [ ] Run tests → all GREEN
- [ ] Manual verification (dev server)
- [ ] Commit: `refactor: extract [Manager Name]`

### After All Extractions

- [ ] Update ConnectionHandler to delegate
- [ ] Update HeartbeatTimeoutManager to use DisconnectionCleanupManager
- [ ] Verify all tests pass
- [ ] Manual end-to-end testing
- [ ] Check server console for errors
- [ ] Commit: `refactor: complete server websocket refactoring`
- [ ] Update TODO.md
- [ ] Create PR with metrics

---

## Progress Tracking

### ✅ Phase 1: DisconnectionCleanupManager (COMPLETE)
**Branch:** `refactor/server/disconnection-cleanup-manager`
**Status:** Merged to dev
**Date Completed:** 2025-01-14

**Deliverables:**
- Created `DisconnectionCleanupManager.ts` (122 LOC)
- 12 characterization tests covering all cleanup scenarios
- Updated `HeartbeatTimeoutManager` to use new manager
- Updated `ConnectionHandler` to use new manager
- ConnectionHandler: 197 → 197 LOC (no change, manager extracted from duplicated code)

**Key Features:**
- Centralized cleanup logic (eliminates duplication)
- Race condition prevention with WebSocket reference check
- Optional cleanup modes (close WS, remove tokens, remove player)
- Comprehensive error handling

---

### ✅ Phase 2: Message Processing (COMPLETE)
**Duration:** 2 days
**Status:** Merged to dev
**Date Completed:** 2025-01-14

#### ✅ MessagePipelineManager (Day 2)
**Branch:** `refactor/server/message-pipeline-manager`
**Status:** Merged to dev

**Deliverables:**
- Created `MessagePipelineManager.ts` (205 LOC)
- 27 characterization tests covering validation pipeline
- ConnectionHandler: 197 → 175 LOC (-22 LOC, 11.2% reduction)

**Key Features:**
- Multi-stage validation: size check → JSON parse → rate limit → schema validation
- DoS protection with configurable message size limit (1MB default)
- Callback-based architecture for valid/invalid messages
- Comprehensive error logging

#### ✅ MessageAuthenticator (Day 3)
**Branch:** `refactor/server/message-authenticator`
**Status:** Merged to dev

**Deliverables:**
- Created `MessageAuthenticator.ts` (169 LOC)
- 37 characterization tests covering authentication routing
- ConnectionHandler: 175 → 162 LOC (-13 LOC, 7.4% reduction)

**Key Features:**
- Authentication message detection and routing
- DM-related message handling (elevate, revoke, set-password)
- Access control enforcement (drops unauthenticated messages)
- Clean separation of auth concerns from connection handling

**Phase 2 Total Reduction:** 197 → 162 LOC (-35 LOC, 17.8% reduction)

---

### ✅ Phase 3: ConnectionLifecycleManager (COMPLETE)
**Branch:** `refactor/server/connection-lifecycle-manager`
**Status:** Merged to dev
**Date Completed:** 2025-01-15

**Deliverables:**
- Created `ConnectionLifecycleManager.ts` (169 LOC)
- 36 characterization tests covering connection lifecycle
- ConnectionHandler: 162 → 140 LOC (-22 LOC, 13.6% reduction)

**Key Features:**
- UID extraction from connection URL
- Connection replacement with race condition prevention
- Seamless reconnection (preserves auth state for authenticated connections)
- Keepalive ping management (25s interval)
- Complete connection registration and tracking

**Tests Cover:**
- UID extraction from URL (6 tests)
- Connection replacement detection (4 tests)
- Seamless reconnection logic (4 tests)
- Connection registration (3 tests)
- Keepalive ping management (5 tests)
- Stop keepalive on disconnection (2 tests)
- Race condition prevention (3 tests)
- Complete connection lifecycle (4 tests)
- Edge cases (5 tests)

---

### ✅ Phase 4: Orchestration (COMPLETE)
**Branch:** `refactor/server/connection-handler-orchestrator`
**Status:** Merged to dev
**Date Completed:** 2025-01-15

**Deliverables:**
- Enhanced ConnectionLifecycleManager with internal keepalive tracking (201 LOC)
- ConnectionHandler: 140 → 136 LOC (-4 LOC, 2.9% reduction)
- Removed unused imports (getDefaultRoomId, unnecessary SessionData import)
- Removed debug console.log from handleValidatedMessage
- Delegated keepalive cleanup to ConnectionLifecycleManager

**Key Improvements:**
- Pure orchestrator pattern achieved
- ConnectionHandler now delegates ALL responsibilities to specialized managers:
  - Connection lifecycle → ConnectionLifecycleManager
  - Message validation → MessagePipelineManager
  - Authentication routing → MessageAuthenticator
  - Player cleanup → DisconnectionCleanupManager
  - Heartbeat monitoring → HeartbeatTimeoutManager
- Keepalive tracking internalized in ConnectionLifecycleManager
- Clean separation of concerns maintained
- All 677 tests passing

---

## Final Metrics

**ConnectionHandler LOC Evolution:**
- Original: 201 LOC
- After Phase 1: 197 LOC (-4 LOC, 2.0%)
- After Phase 2: 162 LOC (-39 LOC, 19.4%)
- After Phase 3: 140 LOC (-61 LOC, 30.3%)
- **After Phase 4: 136 LOC (-65 LOC, 32.3% total reduction)** ✅

**Managers Created:**
- DisconnectionCleanupManager: 122 LOC
- MessagePipelineManager: 205 LOC
- MessageAuthenticator: 169 LOC
- ConnectionLifecycleManager: 201 LOC (enhanced with keepalive tracking)
- **Total:** 697 LOC across 4 focused managers

**Test Coverage:**
- DisconnectionCleanupManager: 12 tests
- MessagePipelineManager: 27 tests
- MessageAuthenticator: 37 tests
- ConnectionLifecycleManager: 36 tests
- ConnectionHandler: 7 integration tests
- **Total:** 119 tests (all passing)

---

## Refactoring Complete! ✅

All 4 phases of the server WebSocket refactoring are complete:

1. ✅ Phase 1: DisconnectionCleanupManager
2. ✅ Phase 2: Message Processing (MessagePipelineManager + MessageAuthenticator)
3. ✅ Phase 3: ConnectionLifecycleManager
4. ✅ Phase 4: ConnectionHandler Orchestration

**Final Achievement:**
- ConnectionHandler reduced from 201 → 136 LOC (32.3% reduction)
- Created 4 focused, testable managers (697 LOC total)
- 119 comprehensive tests ensuring correctness
- Pure orchestrator pattern with complete delegation
- Zero behavioral changes (all tests passing)

---

**Last Updated:** 2025-01-15 (Phase 4 Complete)
**Created By:** Claude Code (Phase 15 Initiative)
**Related Documents:**
- [CLIENT_WEBSOCKET_PLAN.md](./CLIENT_WEBSOCKET_PLAN.md)
- [CLIENT_WEBSOCKET_COMPLETE.md](./CLIENT_WEBSOCKET_COMPLETE.md)
- [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md)
- Phase 15 SOLID Refactor Initiative - Server Track
