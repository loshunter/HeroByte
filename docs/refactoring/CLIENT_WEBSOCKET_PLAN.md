# Client WebSocket Service Refactoring Plan

**Date Created:** 2025-11-14
**Date Completed:** 2025-11-14
**Status:** ✅ **COMPLETE**
**Target:** `apps/client/src/services/websocket.ts`
**Original LOC:** 512
**Final LOC:** 238 (code) + 233 (docs) = 471 total
**Reduction:** 54% orchestrator code reduction

> **Note:** This refactoring is now **COMPLETE**. See [CLIENT_WEBSOCKET_COMPLETE.md](./CLIENT_WEBSOCKET_COMPLETE.md) for full completion summary, metrics, and lessons learned.

> **Pattern Source:** This plan followed the SOLID principles and extraction patterns established in the successful [ROOM_SERVICE_REFACTOR_COMPLETE.md](./ROOM_SERVICE_REFACTOR_COMPLETE.md) refactoring.

---

## Completion Summary

✅ **All 5 managers extracted successfully:**
1. MessageRouter (300 LOC, 32 tests) - Message parsing and routing
2. AuthenticationManager (160 LOC, 30 tests) - Auth state machine
3. MessageQueueManager (237 LOC, 34 tests) - Outbound message queueing
4. HeartbeatManager (191 LOC, 32 tests) - Keepalive timing
5. ConnectionLifecycleManager (472 LOC, 56 tests) - Connection lifecycle

✅ **Test coverage:** 0 → 100% (184 new tests, all passing)

✅ **Zero behavioral changes:** All 2168 client tests pass

✅ **SOLID principles applied:** SRP, OCP, LSP, ISP, DIP

✅ **Comprehensive documentation:** Architecture, orchestration, coordination

**For detailed metrics and analysis, see:** [CLIENT_WEBSOCKET_COMPLETE.md](./CLIENT_WEBSOCKET_COMPLETE.md)

---

## Executive Summary

The WebSocketService is a god class handling 5 distinct responsibilities. This plan decomposes it into 5 focused managers following SOLID principles:

1. **ConnectionLifecycleManager** - Connect, disconnect, reconnection logic
2. **AuthenticationManager** - Authentication state and auth event handling
3. **MessageQueueManager** - Outbound message queueing and flushing
4. **HeartbeatManager** - Heartbeat timing and timeout detection
5. **MessageRouter** - Inbound message routing and type checking

The orchestrator **WebSocketService** will delegate to these managers while maintaining the public API.

---

## Current State Analysis

### File: `apps/client/src/services/websocket.ts` (512 LOC)

**Current Responsibilities:**

1. **Connection Lifecycle** (~120 LOC) - connect, disconnect, reconnect, connect timer
   - `connect()` (lines 141-161)
   - `disconnect()` (lines 166-171)
   - `handleDisconnect()` (lines 325-344)
   - `reconnect()` (lines 346-361)
   - `startConnectTimer()` / `clearConnectTimer()` (lines 483-503)
   - WebSocket event setup (lines 239-268)

2. **Authentication Management** (~80 LOC) - auth state tracking, auth events
   - `authenticate()` (lines 223-233)
   - `authState` property (line 117)
   - Auth event handling in `handleMessage()` (lines 281-291)
   - Auth state transitions (pending, success, failure)

3. **Message Queue Management** (~75 LOC) - queue, send, flush logic
   - `send()` (lines 177-204)
   - `sendRaw()` (lines 433-449)
   - `queueMessage()` (lines 426-431)
   - `flushMessageQueue()` (lines 398-415)
   - `canSendImmediately()` (lines 417-424)

4. **Heartbeat Management** (~65 LOC) - timing, timeout detection
   - `startHeartbeat()` (lines 363-389)
   - `stopHeartbeat()` (lines 391-396)
   - Heartbeat timer logic and timeout detection
   - `lastPongTime` tracking (line 123)

5. **Message Routing** (~80 LOC) - Parse and route inbound messages
   - `handleMessage()` (lines 270-323)
   - Type guards: `isRtcSignalMessage()`, `isAuthResponseMessage()`, `isControlMessage()` (lines 34-67)
   - RTC signal routing (lines 276-278)
   - Auth response routing (lines 281-291)
   - Control message routing (lines 293-295)
   - Snapshot routing (lines 299-319)

6. **State Management & Utilities** (~92 LOC) - properties, utilities
   - State/auth properties and timers (lines 114-124)
   - `setState()` (lines 505-511)
   - `getState()` / `isConnected()` (lines 209-218)
   - `cleanup()` (lines 451-474)
   - `handleVisibilityChange()` (lines 476-481)

**Complexity Breakdown:**

| Component | LOC | Complexity | Responsibility |
|-----------|-----|-----------|-----------------|
| Connection Lifecycle | 120 | High (4) | Connect/disconnect/reconnection with exponential backoff |
| Authentication | 80 | High (4) | Auth state machine, event management |
| Message Queue | 75 | Medium (3) | Queue management, send decision logic |
| Heartbeat | 65 | Medium (3) | Timing, timeout detection, keep-alive |
| Message Routing | 80 | High (4) | Type detection, message dispatch |
| Utilities & State | 92 | Low (2) | Properties, cleanup, visibility handling |

---

## Proposed Decomposition

### Manager 1: ConnectionLifecycleManager (~90 LOC)

**Purpose:** Handle all connection lifecycle events - open, close, reconnection

**File Location:** `apps/client/src/services/websocket/ConnectionLifecycleManager.ts`

**Exports:**

```typescript
export interface ConnectionLifecycleManagerConfig {
  reconnectInterval: number;     // ms between reconnect attempts
  maxReconnectAttempts: number;  // 0 = infinite
  onStateChange: (state: ConnectionState) => void;
}

export class ConnectionLifecycleManager {
  constructor(config: ConnectionLifecycleManagerConfig);

  // Connection control
  connect(): WebSocket | null;          // Returns WebSocket or null
  disconnect(): void;

  // Reconnection logic
  handleDisconnect(): void;
  private reconnect(): void;

  // Timer management
  private startConnectTimer(ws: WebSocket): void;
  private clearConnectTimer(): void;

  // State tracking
  getState(): ConnectionState;
  private setState(newState: ConnectionState): void;
}
```

**Responsibilities:**

- Create WebSocket connection with URL
- Handle connection open/close events
- Manage reconnection attempts with exponential backoff
- Track connection state transitions
- Manage connect timeout detection
- Coordinate with visibility changes

**Extraction Source:**

- `connect()` (lines 141-161)
- `disconnect()` (lines 166-171)
- `handleDisconnect()` (lines 325-344)
- `reconnect()` (lines 346-361)
- `startConnectTimer()` / `clearConnectTimer()` (lines 483-503)
- `setState()` (lines 505-511)
- `getState()` / `isConnected()` (lines 209-218)
- WebSocket event setup (lines 239-268) - partially

**Dependencies:**

- `ConnectionState` enum (input)
- `WebSocket` API

**Tests Needed:**

- Happy path: connect → open → ready state
- Reconnection with exponential backoff
- Max reconnect attempts exceeded → FAILED state
- Connection timeout → disconnect
- Visibility change → reconnect if disconnected
- Infinite reconnects when maxReconnectAttempts = 0
- State transition validation
- Timer cleanup on disconnect

---

### Manager 2: AuthenticationManager (~60 LOC)

**Purpose:** Manage authentication state machine and event handling

**File Location:** `apps/client/src/services/websocket/AuthenticationManager.ts`

**Exports:**

```typescript
export interface AuthenticationManagerConfig {
  onAuthEvent?: (event: AuthEvent) => void;
}

export class AuthenticationManager {
  constructor(config: AuthenticationManagerConfig);

  // Auth operations
  authenticate(ws: WebSocket | null, secret: string, roomId?: string): void;
  reset(): void;

  // Auth state queries
  getAuthState(): AuthState;
  isAuthenticated(): boolean;

  // Auth event callbacks
  private onPending(): void;
  private onSuccess(): void;
  private onFailure(reason?: string): void;

  // Message handling integration
  handleAuthResponse(message: AuthResponseMessage): void;
}
```

**Responsibilities:**

- Track authentication state (UNAUTHENTICATED, PENDING, AUTHENTICATED, FAILED)
- Send authenticate message to server
- Handle auth-ok and auth-failed responses
- Trigger auth events (pending, success, failure)
- Reset auth state on disconnect

**Extraction Source:**

- `authState` property (line 117)
- `authenticate()` (lines 223-233)
- Auth state transitions in `handleMessage()` (lines 281-291)
- Auth event callbacks (lines 148, 230, 284, 288)

**Dependencies:**

- `AuthState` enum
- `AuthEvent` type
- `AuthResponseMessage` type
- WebSocket reference

**Tests Needed:**

- Initial state is UNAUTHENTICATED
- Authenticate transitions to PENDING
- Auth-ok response → AUTHENTICATED
- Auth-failed response → FAILED
- Reset returns to UNAUTHENTICATED
- Cannot authenticate when socket not open
- Auth event callbacks fire correctly
- Re-authenticate when already authenticated

---

### Manager 3: MessageQueueManager (~65 LOC)

**Purpose:** Manage outbound message queue and send logic

**File Location:** `apps/client/src/services/websocket/MessageQueueManager.ts`

**Exports:**

```typescript
export interface MessageQueueManagerConfig {
  maxQueueSize?: number;  // Default: 200
}

export class MessageQueueManager {
  constructor(config: MessageQueueManagerConfig);

  // Send operations
  send(
    message: ClientMessage,
    ws: WebSocket | null,
    canSendFn: () => boolean
  ): void;

  private sendRaw(message: ClientMessage, ws: WebSocket): void;

  // Queue operations
  flush(ws: WebSocket | null, canSendFn: () => boolean): void;
  private queueMessage(message: ClientMessage): void;
  private canSendImmediately(ws: WebSocket | null, canSendFn: () => boolean): boolean;

  // Queue state
  getQueueLength(): number;
  clear(): void;
}
```

**Responsibilities:**

- Decide whether to send immediately or queue (based on auth/connection state)
- Handle special cases (authenticate messages always send immediately)
- Drop heartbeats if not authenticated yet (prevent queue bloat)
- Maintain message queue with size limit
- Flush queue when conditions allow
- Error handling for send failures (queue fallback)

**Extraction Source:**

- `send()` (lines 177-204)
- `sendRaw()` (lines 433-449)
- `queueMessage()` (lines 426-431)
- `flushMessageQueue()` (lines 398-415)
- `canSendImmediately()` (lines 417-424)
- `messageQueue` property (line 122)

**Dependencies:**

- `ClientMessage` type
- WebSocket reference
- Auth/connection state checkers

**Tests Needed:**

- Queue message when not connected
- Send immediately when connected and authenticated
- Send authenticate messages immediately (bypass queue)
- Drop heartbeat when not authenticated
- Flush queue when authenticated
- Queue size limit (200 default)
- Queue FIFO ordering
- Error on send → queue fallback
- Clear queue on reconnect

---

### Manager 4: HeartbeatManager (~55 LOC)

**Purpose:** Manage heartbeat timing and timeout detection

**File Location:** `apps/client/src/services/websocket/HeartbeatManager.ts`

**Exports:**

```typescript
export interface HeartbeatManagerConfig {
  heartbeatInterval: number;  // ms between heartbeats
  onTimeout: () => void;      // Called when heartbeat times out
  sendHeartbeat: (ws: WebSocket) => void;  // Function to send heartbeat
}

export class HeartbeatManager {
  constructor(config: HeartbeatManagerConfig);

  // Lifecycle
  start(ws: WebSocket): void;    // Start heartbeat with WebSocket
  stop(): void;                  // Stop heartbeat

  // Message tracking
  recordMessage(): void;         // Called whenever any message received
  getTimeSinceLastMessage(): number;

  // Timeout detection
  isTimedOut(authState: AuthState): boolean;  // Check if should timeout
  private checkTimeout(authState: AuthState): void;
}
```

**Responsibilities:**

- Send heartbeat messages at regular intervals
- Track last message time (any message counts as "alive")
- Detect heartbeat timeout (no message in 2x heartbeat interval)
- Reconnect when timeout detected
- Only send heartbeats when authenticated
- Clean up timers on stop

**Extraction Source:**

- `startHeartbeat()` (lines 363-389)
- `stopHeartbeat()` (lines 391-396)
- `lastPongTime` property (line 123)
- Heartbeat timeout logic (lines 368-378)
- `heartbeatTimer` / `connectTimer` (lines 120-121)

**Dependencies:**

- `AuthState` enum
- WebSocket reference
- Callback for timeout handling

**Tests Needed:**

- Heartbeat interval timing
- Message received updates last pong time
- Timeout detection when no messages for 2x interval
- Only timeout when authenticated
- Stop clears timer
- Heartbeat messages sent when authenticated
- Heartbeat not sent when not authenticated

---

### Manager 5: MessageRouter (~75 LOC)

**Purpose:** Parse, type-check, and route inbound messages

**File Location:** `apps/client/src/services/websocket/MessageRouter.ts`

**Exports:**

```typescript
export interface MessageRouterConfig {
  onMessage: (snapshot: RoomSnapshot) => void;
  onRtcSignal?: (from: string, signal: SignalData) => void;
  onAuthResponse?: (message: AuthResponseMessage) => void;
  onControlMessage?: (message: ControlMessage) => void;
}

export class MessageRouter {
  constructor(config: MessageRouterConfig);

  // Message routing
  route(data: string): void;  // Parse JSON and route

  // Type guards
  private isRtcSignalMessage(value: unknown): value is RtcSignalMessage;
  private isAuthResponseMessage(value: unknown): value is AuthResponseMessage;
  private isControlMessage(value: unknown): value is ControlMessage;

  // Handlers
  private handleRtcSignal(message: RtcSignalMessage): void;
  private handleAuthResponse(message: AuthResponseMessage): void;
  private handleControlMessage(message: ControlMessage): void;
  private handleSnapshot(snapshot: RoomSnapshot): void;
}
```

**Responsibilities:**

- Parse JSON message string
- Type-guard inbound messages (RTC, auth, control, snapshot)
- Route to appropriate callback handler
- Handle debug logging for snapshots with initiative data
- Error handling for invalid JSON

**Extraction Source:**

- `handleMessage()` (lines 270-323)
- Type guards: `isRtcSignalMessage()`, `isAuthResponseMessage()`, `isControlMessage()` (lines 34-67)
- Message routing logic (lines 276-319)
- Debug logging (lines 301-317)

**Dependencies:**

- All message types: `RtcSignalMessage`, `AuthResponseMessage`, `ControlMessage`, `RoomSnapshot`
- `SignalData` type from simple-peer

**Tests Needed:**

- Parse valid JSON
- Route RTC signal messages
- Route auth response messages (auth-ok, auth-failed)
- Route control messages
- Route room snapshots
- Handle invalid JSON gracefully
- Log debug info for initiative data
- Type guards accurately identify message types
- Unknown message types treated as snapshots

---

### Orchestrator: WebSocketService (Refactored, ~120 LOC)

**Purpose:** Orchestrate managers and provide public API

**File Location:** `apps/client/src/services/websocket.ts` (refactored)

**Responsibilities:**

- Create and inject all managers
- Hold configuration
- Provide public API: `connect()`, `disconnect()`, `send()`, `authenticate()`, `getState()`, `isConnected()`
- Coordinate visibility change handling
- Wire message flow between managers
- Cleanup and lifecycle coordination

**Methods:**

```typescript
export class WebSocketService {
  // Public API - UNCHANGED
  connect(): void                         → ConnectionLifecycleManager
  disconnect(): void                      → ConnectionLifecycleManager
  send(message: ClientMessage): void      → MessageQueueManager
  authenticate(secret: string, roomId?: string): void → AuthenticationManager
  getState(): ConnectionState             → ConnectionLifecycleManager
  isConnected(): boolean                  → ConnectionLifecycleManager

  // Internal coordination
  private setupEventHandlers(): void      // Wire up event handlers
  private handleVisibilityChange(): void  // Reconnect when visible
  private cleanup(): void                 // Coordinate manager cleanup
}
```

**Constructor Injection:**

```typescript
constructor(config: WebSocketServiceConfig) {
  // Initialize managers with config and callbacks
  this.connectionManager = new ConnectionLifecycleManager({...});
  this.authManager = new AuthenticationManager({...});
  this.messageQueue = new MessageQueueManager({...});
  this.heartbeat = new HeartbeatManager({...});
  this.router = new MessageRouter({...});

  // Wire event handlers
  this.setupEventHandlers();
}
```

**What Stays in WebSocketService:**

- Config management and defaults (~25 LOC)
- Orchestration and wiring (~40 LOC)
- Visibility change handler (~15 LOC)
- WebSocket event handler setup (~25 LOC)
- Cleanup coordination (~15 LOC)

---

## Dependency Graph

```
WebSocketService (orchestrator)
  ├── ConnectionLifecycleManager
  │   └── (depends on: ConnectionState enum)
  │
  ├── AuthenticationManager
  │   └── (depends on: AuthState, AuthEvent, AuthResponseMessage)
  │
  ├── MessageQueueManager
  │   └── (depends on: ClientMessage type, auth/connection checks)
  │
  ├── HeartbeatManager
  │   └── (depends on: AuthState, timeout callback)
  │
  └── MessageRouter
      └── (depends on: message types, RoomSnapshot, SignalData)
```

**Dependency Order (No Circular Dependencies):**

1. Type definitions (enums, types) - used by all managers
2. Individual managers - isolated, independent
3. WebSocketService - orchestrates all managers

---

## Extraction Order (Low Dependency First)

### Phase 1: Message Handling (Day 1-2)
**Duration:** 2 days

1. **MessageRouter** (Day 1)
   - No dependencies on other managers
   - Pure routing logic, type guards
   - Easy to test with JSON fixtures
   - Branch: `refactor/client/message-router`

2. **AuthenticationManager** (Day 2)
   - Only depends on types
   - State machine is isolated
   - Easy to test state transitions
   - Branch: `refactor/client/auth-manager`

### Phase 2: Infrastructure (Day 3-4)
**Duration:** 2 days

3. **MessageQueueManager** (Day 3)
   - Simple queue logic
   - Depends on send decision function
   - Easy to test with mocks
   - Branch: `refactor/client/message-queue-manager`

4. **HeartbeatManager** (Day 4)
   - Timer management
   - Depends on timeout callback
   - Easy to test with jest fake timers
   - Branch: `refactor/client/heartbeat-manager`

### Phase 3: Core Lifecycle (Day 5-6)
**Duration:** 2 days

5. **ConnectionLifecycleManager** (Day 5-6)
   - More complex reconnection logic
   - Depends on state tracking
   - Requires timer management testing
   - Branch: `refactor/client/connection-lifecycle-manager`

### Phase 4: Orchestration (Day 7)
**Duration:** 1 day

6. **Update WebSocketService** (Day 7)
   - Wire up all managers
   - Update event handlers
   - Verify all tests pass
   - Branch: `refactor/client/websocket-orchestrator`

---

## Testing Strategy

### Characterization Tests (Before Extraction)

Before extracting each manager, write tests capturing current behavior:

**MessageRouter Tests:**
- Parse valid RTC signal message
- Parse valid auth response (both auth-ok and auth-failed)
- Parse valid control messages
- Parse room snapshot
- Handle invalid JSON (error logging, no crash)
- Type guards work correctly

**AuthenticationManager Tests:**
- Initial state is UNAUTHENTICATED
- Authenticate call sets state to PENDING and sends message
- Auth-ok response sets state to AUTHENTICATED
- Auth-failed response sets state to FAILED
- Reset returns to UNAUTHENTICATED
- Cannot authenticate if socket not open
- Auth events fire correctly

**MessageQueueManager Tests:**
- Queue message when cannot send immediately
- Send immediately when can send
- Authenticate messages always send immediately
- Drop heartbeats when not authenticated
- Flush queue when conditions allow
- Queue respects size limit (200)
- FIFO ordering
- Error on send → queue fallback
- Clear queue on explicit call

**HeartbeatManager Tests:**
- Sends heartbeat at correct interval
- Any message updates last pong time
- Timeout detected after 2x interval with no message
- Only timeout when authenticated
- Start/stop clears timers
- No heartbeat sent when not authenticated

**ConnectionLifecycleManager Tests:**
- Connect creates WebSocket
- Disconnect closes connection
- Handle disconnect triggers reconnect
- Exponential backoff calculation
- Max reconnect attempts respected
- Infinite reconnects when maxReconnectAttempts = 0
- Connection timeout detected
- State transitions correct
- Visibility change triggers reconnect

### Unit Tests (After Extraction)

Each manager gets comprehensive unit tests beyond characterization:

**Coverage Target:** 80%+ per manager

**Test Structure:**

```
apps/client/src/services/websocket/__tests__/
├── MessageRouter.test.ts                  (15 tests)
├── AuthenticationManager.test.ts          (12 tests)
├── MessageQueueManager.test.ts            (14 tests)
├── HeartbeatManager.test.ts               (10 tests)
├── ConnectionLifecycleManager.test.ts     (16 tests)
└── WebSocketService.integration.test.ts   (8 tests)
```

### Integration Tests

Verify orchestrator coordinates managers correctly:

- Full connection workflow: connect → authenticate → send → receive
- Disconnection and reconnection flow
- Message queue flushing after auth
- Heartbeat timeout triggers reconnect
- Multiple message types routed correctly

---

## Success Metrics

**Quantitative:**

- ✅ WebSocketService: 512 → ~120 LOC (77% reduction)
- ✅ 5 focused managers created (~290 LOC total)
- ✅ Average manager size: ~60 LOC
- ✅ Test coverage maintained (0 test failures)
- ✅ 75+ new characterization tests

**Qualitative:**

- ✅ Each manager has single clear responsibility
- ✅ No circular dependencies in manager graph
- ✅ Message routing is isolated and testable
- ✅ Authentication state machine is explicit
- ✅ Connection lifecycle is clear and trackable
- ✅ Queue logic is independent of websocket details
- ✅ Heartbeat timing is centralizable

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| **Circular dependencies** | Extract in dependency order (message → auth → queue → heartbeat → connection) |
| **State synchronization** | Characterization tests capture exact timing behavior |
| **Message loss** | Queue logic tested thoroughly before extraction |
| **Event handler timing** | Isolation tests verify callback order |
| **Timer cleanup** | Explicit cleanup coordination in orchestrator |

### Process Risks

| Risk | Mitigation |
|------|-----------|
| **API breaks** | Maintain WebSocketService public API exactly |
| **Timing regressions** | Manual testing with real WebSocket server |
| **Browser compat** | Test with Firefox/Chrome/Safari |
| **Merge conflicts** | Small PRs, frequent rebasing on dev |

---

## Estimated Timeline

**Conservative:** 7 working days (1.5 weeks)
**Optimistic:** 5 working days (1 week with focus)

**Breakdown:**
- Phase 1 (Message handling): 2 days
- Phase 2 (Infrastructure): 2 days
- Phase 3 (Lifecycle): 2 days
- Phase 4 (Orchestration): 1 day

**Total:** 7 days → ~1.5 weeks

---

## File Structure (After Refactoring)

```
apps/client/src/services/
├── websocket.ts                          # 120 LOC - Orchestrator
└── websocket/
    ├── MessageRouter.ts                  # 75 LOC
    ├── AuthenticationManager.ts          # 60 LOC
    ├── MessageQueueManager.ts            # 65 LOC
    ├── HeartbeatManager.ts               # 55 LOC
    ├── ConnectionLifecycleManager.ts     # 90 LOC
    └── __tests__/
        ├── MessageRouter.test.ts
        ├── AuthenticationManager.test.ts
        ├── MessageQueueManager.test.ts
        ├── HeartbeatManager.test.ts
        ├── ConnectionLifecycleManager.test.ts
        └── WebSocketService.integration.test.ts
```

---

## Lessons from Server Refactoring

The RoomService refactoring (688 → 181 LOC, 74% reduction) demonstrated these best practices that we'll apply here:

1. **Characterization Tests First** - Write tests before extraction to lock in behavior
2. **Dependency-Aware Order** - Extract utilities before handlers
3. **Small Manager Responsibilities** - Each manager does ONE thing well
4. **Clean Interfaces** - Minimal, explicit dependencies between managers
5. **Incremental Extraction** - One manager per PR
6. **Zero Behavioral Change** - Extract first, refactor second (separate commits)

---

## Implementation Checklist

### Before Starting Any Extraction

- [ ] Create feature branch: `refactor/client/websocket-managers`
- [ ] Ensure all existing tests pass
- [ ] Review this plan with team
- [ ] Set up test environment

### For Each Manager Extraction

- [ ] Write characterization tests (BEFORE extraction)
- [ ] Create new manager file with stub
- [ ] Extract logic from WebSocketService
- [ ] Add JSDoc and type annotations
- [ ] Fix TypeScript errors
- [ ] Run tests → all GREEN
- [ ] Manual verification (dev server)
- [ ] Commit: `refactor: extract [Manager Name]`

### After All Extractions

- [ ] Update WebSocketService to delegate
- [ ] Verify all tests pass
- [ ] Manual end-to-end testing
- [ ] Check browser console for errors
- [ ] Commit: `refactor: complete websocket refactoring`
- [ ] Update REFACTOR_ROADMAP.md
- [ ] Create PR with metrics

---

## Key Interfaces

### ConnectionState Enum

```typescript
export enum ConnectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  RECONNECTING = "reconnecting",
  FAILED = "failed",
}
```

### AuthState Enum

```typescript
export enum AuthState {
  UNAUTHENTICATED = "unauthenticated",
  PENDING = "pending",
  AUTHENTICATED = "authenticated",
  FAILED = "failed",
}
```

### AuthEvent Type

```typescript
export type AuthEvent =
  | { type: "reset" }
  | { type: "pending" }
  | { type: "success" }
  | { type: "failure"; reason?: string };
```

### Message Handler Types

```typescript
type MessageHandler = (snapshot: RoomSnapshot) => void;
type RtcSignalHandler = (from: string, signal: SignalData) => void;
type ConnectionStateHandler = (state: ConnectionState) => void;
```

---

## Next Steps

1. **Review and Approve** this plan with team
2. **Create feature branch:** `refactor/client/websocket-managers`
3. **Start Phase 1:** MessageRouter extraction (Day 1)
4. **Follow extraction order** from this plan
5. **Regular testing** after each manager extraction
6. **Merge to dev** when all phases complete

---

**Last Updated:** 2025-11-14
**Created By:** Claude Code (Phase 15 Initiative)
**Related Documents:**
- [REFACTOR_PLAYBOOK.md](./REFACTOR_PLAYBOOK.md)
- [ROOM_SERVICE_REFACTOR_COMPLETE.md](./ROOM_SERVICE_REFACTOR_COMPLETE.md)
- Phase 15 SOLID Refactor Initiative - Client Track
