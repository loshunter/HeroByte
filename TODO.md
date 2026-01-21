# HeroByte TODO

> **Note**: Completed work has been archived in [DONE.md](DONE.md) to keep this list focused on active and future work.

## Goal

Ship a table-ready MVP to run live playtests with real players and a DM. Prioritize drawing/selection stability, DM session controls, and player-facing feedback so we can gather real game-night data fast.

## 1. High-Priority Polish

### Player Experience

- [ ] Verify voice indicator + portrait glow survive reconnects and DM toggles.
- [x] Refresh tips/tooltips for draw, measure, select so new players get guidance.
- [x] Bug bash dice log readability for long formulas; adjust formatting if needed.

### DM Workflow

- [x] Add a shortcut/command to select all tokens owned by a player (with safe undo).
- [x] Improve map background management (upload feedback, loading spinner).

## 2. QA & Release Prep

- [x] Run full automated suite (`pnpm test`, `pnpm --filter vtt-server test`, Playwright smoke).
- [ ] Manual two-browser checklist: auth, drawing, partial erase, multi-select, load/save, dice, voice. Archive findings in `test-results/`.
- [ ] Document MVP playtest setup (DM prep steps, recommended browsers, troubleshooting cheatsheet).
- [ ] Update README quick-start with playtest instructions and link to the new checklist.

## 3. Deferred Until After MVP

- README visual assets refresh (screenshots, GIF/video demo).
- Public roadmap and issue labeling workflow.
- LAN/Safari networking investigation.
- Security upgrades: player identity verification, DM authentication flow, post-password re-auth.
- Palette/color system (Phase 15), drawing/pointer polish (Phase 16), roll log redesign (Phase 18), DM provisioning & invites (Phase 19), asset library & grouping (Phase 20).
- Engineering guardrail doc refresh (keep current guidance, revisit post-MVP).

---

## CRITICAL: Contributor Readiness

**These items are essential for making the repo stable and contributor-friendly.**

_Completed milestones are archived in [DONE.md](DONE.md) to keep this list focused on upcoming work._

### README Improvements

- [ ] **Visual Assets**
  - [ ] Add screenshots of gameplay (map, dice roller, voice chat)
  - [ ] Add GIF/video demo of core features
  - [ ] Show UI for drawing tools, token movement
  - [ ] Add architecture diagram (optional)

### Security Hardening

- [ ] **Authentication System**
  - [ ] Player identity verification
  - [ ] DM authentication for private rooms

- [ ] **Additional Security**
  - [ ] Review and document current security measures

### Community & Governance

- [ ] **Public Roadmap**
  - [ ] Create GitHub Projects board
  - [ ] Link roadmap in README
  - [ ] Label issues by priority (P0, P1, P2)

### Networking Follow-up

- [ ] Investigate LAN access (Safari failing to load at `http://192.168.50.226:5173` despite allowed origins) and document resolution

---

_Completed phase summaries now live in [DONE.md](DONE.md)._

## Networking Reliability & Sync Modernization (SOLID + TDD)

**Goal**: Move from full-snapshot spam to modern, efficient, and observable real-time sync while preserving SRP/SoC and driving each change with failing tests first.

- [ ] **Baseline & Observability (test-first)**
  - [x] Add snapshot size/latency metrics + structured logs for broadcast frequency; write regression tests that assert log/metric shapes (server Jest + client Vitest).
  - [x] Capture canonical message transcript fixtures for regression (auth → join → move → draw) to power contract tests before code changes.
- [ ] **Heartbeat becomes ACK-only**
  - [x] Add `heartbeat-ack` control message; server stops broadcasting on heartbeat (update `HeartbeatHandler` + router). Write tests covering: lastHeartbeat update, ack delivery, no broadcast side-effects.
  - [x] Client HeartbeatManager honors ack (timeout resets on any message or ack); add failing tests first.
- [ ] **State Versioning & Delta Pipeline**
  - [x] Introduce monotonically increasing `stateVersion` on server snapshots; add contract tests asserting version increments on state changes.
  - [x] Emit targeted deltas for high-volume actions (token move, pointer, draw, transform) with SRP handlers; keep full snapshot only for join/recover. Write TDD suites for each delta type and a reconciliation test that applies deltas then compares to full snapshot.
  - [x] Add client-side version tracking + resync request when gap detected; integration tests simulate skipped messages and verify recovery.
- [ ] **Command IDs, Acks, and Backpressure**
  - [x] Add client-generated `commandId` to mutating messages; server responds with `{t:"ack", commandId}` or `{t:"nack", reason}`; contract tests cover success/failure paths.
  - [x] Expose queue overflow telemetry (drop reason + size) and add tests to assert logging instead of silent drops.
  - [x] Update MessageQueueManager to retry unacked commands with bounded attempts; TDD around retry/backoff and idempotent server handling.
- [ ] **Asset & Payload Slimming**
  - [x] Split heavy assets (map background, drawings) into reference payloads with deterministic hashes and hydrate them client-side from cached assets.
  - [x] Add snapshot size guardrails so oversized broadcasts surface telemetry before landing in CI.
  - [x] Add gzip/brotli check in CI for average snapshot size regression guard.
- [ ] **High-Frequency Channels**
- [x] Route pointer previews over a lightweight channel so high-frequency input never triggers room persistence or broadcast.
  - [x] Move drag previews to a lightweight update channel (or RTC shim) isolated from authoritative state; tests ensure these never trigger room persistence or full broadcast.
- [ ] **Multi-Room & Horizontal Scalability Ready**
  - [x] Introduce room-scoped store abstraction with in-memory adapter to prepare for Redis-backed multi-room fan-out.
  - [x] Capture Redis/pub-sub rollout plan in `docs/planning/multi-room-store.md` so the adapter scope is locked in.
  - [x] Build RoomRegistry + RedisRoomStore scaffolding with contract tests so room fan-out can be exercised per roomId before enabling Redis.
  - [ ] Add Redis/pub-sub adapter behind feature flag. Contract tests verify fanout per room and isolation between rooms.
  - [ ] Persist `stateVersion` and asset references in store; add migration test to ensure cold start loads the same versioned state.
- [ ] **Rollout & Guardrails**
  - [x] Feature-flag deltas/acks so we can ship incrementally; add tests ensuring flags default to current behavior until enabled.
  - [ ] Update docs/architecture diagrams to reflect new messaging contracts; add lint/CI rule to forbid new full-snapshot broadcasts outside explicit recovery paths.

## Phase 13: Future Drawing & Interaction Polish

**Priority**: Medium - Additional polish for drawing workflows

_Multi-select orchestration and partial erasing complete! See [DONE.md](DONE.md) for details._

## Engineering Guardrails (Applies to All Phases)

- [ ] For each feature epic, document module boundaries up front to preserve SRP and wider separation of concerns.
- [ ] Ensure new services/hooks/components expose one responsibility; refactor or extract helpers if responsibilities creep.
- [ ] Capture interface contracts before implementation and drive development with failing tests (TDD) where practical.
- [ ] Maintain or expand automated coverage when touching serialization, networking, or shared state orchestration.
- [ ] Keep `docs/planning/phase19-20-briefing.md` synchronized with Phase 19/20 scope/status updates before merging.

## Phase 15: Palette & Color System (Future)

**Priority**: High - unlocks customizable color workflows and palette sharing

### Phase 15.0: Research & Data Modeling

- [ ] Audit current color/palette data structures and storage locations
- [ ] Research swatch exchange formats (ASE, GPL, JSON) and document import/export requirements
- [ ] Identify reputable palette repositories (e.g., Coolors, Lospec) and licensing constraints for bundled sets
- [ ] Evaluate naming conventions for multi-tool drawing modules ("Markup", "Annotate", etc.) and recommend update
- [ ] Define palette module boundaries (state, persistence, import/export) to align with SRP/SoC

### Phase 15.1: Palette Management Features

- [ ] Implement eyedropper tool tied to current canvas rendering pipeline
- [ ] Allow replacing any default swatch with the currently selected color
- [ ] Support adding/removing/reordering custom swatches beyond the 12-slot default
- [ ] Build palette save/load UI with per-user persistence
- [ ] Implement palette import/export (ASE first, JSON fallback, stretch GPL)
- [ ] Surface starter gallery of downloadable palettes with preview metadata

### Phase 15.2: UX & Validation

- [ ] Provide visual feedback for duplicate colors, locked slots, and successful saves
- [ ] Add automated tests for palette CRUD operations and format round-trips
- [ ] Update documentation/help overlays to explain new palette workflows
- [ ] Follow TDD for palette parser/converter utilities and UI state reducers

## Phase 16: Drawing & Interaction Polish (Future)

**Priority**: High - clarifies multi-user ownership and tool behaviors

### Phase 16.0: Tooling Semantics

- [ ] Rename "Draw" tool per Phase 15 research outcome and update icons/help text
- [ ] Tag drawings with creator metadata on creation for ownership-aware actions
- [ ] Validate that new drawing ownership services obey SRP (separate tracking vs rendering concerns)

### Phase 16.1: Clear & Erase Behavior

- [ ] Update UI copy to "Clear All Yours" in drawing toolbox and confirm scope limits to invoking user
- [ ] Ensure DM menu variant remains a global "Clear Everyone's Drawings" and verify it nukes all ownership buckets
- [ ] Write regression tests covering both clear modes in multi-user sessions
- [ ] Add focused unit tests (written first) for ownership-aware clear handlers

### Phase 16.2: Pointer & Input Handling

- [ ] Reserve middle mouse for panning/scrolling and prevent tool actions while pressed
- [ ] Fix pointer artifacts left when dragging with middle mouse across tools (measure, pointer, draw)
- [ ] Add manual + automated tests for panning while in other tools to ensure zero residual marks

## Phase 17: Layout, Movement & Branding (Future)

**Priority**: Medium - global UX polish and accessibility improvements

### Phase 17.0: Keyboard Movement

- [ ] Attach grid-aware movement (1 square per press) to W/A/S/D and arrow keys for any selected object
- [ ] Handle diagonal combos and key-repeat pacing without conflicting with text inputs
- [ ] Add tests covering keyboard movement across tokens, drawings, and future object types
- [ ] Keep movement logic isolated (input handling, grid math, networking) to maintain SRP

### Phase 17.1: Window Placement & Scroll UX

- [ ] Define default positions for floating panels to avoid overlap/off-screen spawn
- [ ] Implement auto-resize-to-content behavior with scrollbars only when content exceeds bounds
- [ ] Skin scrollbars to match retro theme with 8-bit triangle arrows and verify accessibility contrast
- [ ] Slightly scale up Hero Byte logo while respecting layout constraints

## Phase 18: Persistence & Roll Log Validation (Future)

**Priority**: High - ensures campaign continuity and clarity in gameplay logs

### Phase 18.0: Player Data Saves

- [ ] Confirm save/load for tokens, portraits, custom sizes, names, HP max/current across sessions
- [ ] Add automated regression coverage for player save payloads and migrations
- [ ] Extract serialization/deserialization helpers to dedicated modules to enforce SoC

### Phase 18.1: DM Snapshot Pipeline

- [ ] Define full game-state schema (tokens, NPCs, initiative, turn pointer, drawings with transforms, map state)
- [ ] Implement snapshot export/import with version tagging and integrity checks
- [ ] Verify loaded drawings remain selectable/editable (e.g., castle + drawbridge scenario)
- [ ] Write snapshot tests first (round-trip + ownership retention) before implementing handlers

### Phase 18.2: Roll Log Enhancements

- [ ] Redesign log entries to show total plus right-aligned breakdown (e.g., `D20(6)+D4(2)`) in timestamp color/size pairing
- [ ] Add configuration/tests for multi-die expressions and long modifiers to ensure layout stability
- [ ] Update documentation/tooltips to explain new log formatting

## Phase 19: DM-Driven Player Provisioning (Future)

_Planning brief: see `docs/planning/phase19-20-briefing.md` for slide-ready summary and dependencies._

**Priority**: High - empowers DMs to pre-stage players/tokens and streamline onboarding

### Phase 19.0: Research & Data Contracts

- [ ] Audit current player/session models and identify extension points for DM-assigned identities
- [ ] Research invite-link best practices (security, expiry, one-time use) and document requirements
- [ ] Define SRP-aligned modules: identity registry, invite link service, token-binding orchestrator
- [ ] Write failing tests for invite validation and token-identity binding contracts ahead of implementation

### Phase 19.1: DM Identity Workspace

- [ ] Extend DM menu with "Player Provisioning" panel (visible only in DM mode)
- [ ] Allow DM to create/edit identity cards (name, portrait URL, token asset, default square, HP)
- [ ] Persist identity templates and ensure SoC between UI, state, and persistence layers
- [ ] Add tests (written first) for identity CRUD operations and schema validation

### Phase 19.2: Invite Link Flows

- [ ] Generate single-use invite links that associate a player with a prepared identity
- [ ] Support fallback universal link; ensure DM can toggle "identity claim" window safely
- [ ] Handle failure cases (expired link, already claimed, identity missing) with clear UX and tests
- [ ] Implement SRP-compliant handlers: invitation issuance separate from player session activation

### Phase 19.3: Identity Claim & Reassignment

- [ ] When link succeeds, auto-bind player session to identity (token, portrait, stats) and spawn at configured location
- [ ] Provide DM tools to reassign or revoke identities; ensure SoC between identity manager and scene updates
- [ ] Implement toggled "All identities claimable" mode with guard rails to prevent accidental double-claim
- [ ] Deliver TDD coverage for claim/rescind flows and multi-user concurrency scenarios

## Phase 20: Asset Library & Scene Grouping (Future)

_Shared planning brief with Phase 19: `docs/planning/phase19-20-briefing.md`._

**Priority**: Medium - builds reusable content workflows and grouped interactions

### Phase 20.0: Research & Storage Strategy

- [ ] Evaluate storage options (localStorage/indexedDB vs backend) for map/token/prop libraries, respecting user privacy
- [ ] Gather best practices for asset catalog UX and grouping/pinning interactions in VTTs
- [ ] Define SRP-aligned modules: asset catalog service, pinning/grouping manager, persistence adapters
- [ ] Create failing tests covering asset metadata serialization/deserialization

### Phase 20.1: Asset Catalog Foundations

- [ ] Implement library UI (maps, tokens, props, status effects) with filtering/search
- [ ] Allow DM to upload/link assets; ensure SoC between upload handling and catalog rendering
- [ ] Persist catalog locally (initially cookies/localStorage) with future-ready hooks for syncing
- [ ] Add TDD-backed tests for asset CRUD and caching fallback paths

### Phase 20.2: Scene Pinning & Grouping

- [ ] Enable pinning objects together (tokens + props) for grouped transforms
- [ ] Implement detachable groups with hierarchy metadata stored alongside scene objects
- [ ] Ensure pinning logic lives in dedicated module to maintain SRP from rendering
- [ ] Cover group creation/removal with integration tests (write first)

### Phase 20.3: Sharing & Sync

- [ ] Allow export/import of asset bundles (JSON manifest) for sharing across sessions
- [ ] Provide DM option to sync selected assets to players on join; honor bandwidth limits
- [ ] Keep synchronization responsibilities separated (asset service vs real-time transport)
- [ ] Add E2E-style tests validating bundle round-trips and sync opt-in/out behaviors

## Phase 14: Transform Tool Polish & Edge Cases (Future)

**Objective**: Handle edge cases, improve UX, add keyboard shortcuts

- [ ] **Keyboard shortcuts**
  - [ ] Delete key: Delete selected object (if not locked)
  - [ ] ESC: Deselect
  - [ ] Ctrl+D: Duplicate selected object
  - [ ] Ctrl+Z: Undo transform
  - [ ] Shift while dragging: Constrain aspect ratio
  - [ ] Ctrl while rotating: Disable snap to 15°

- [ ] **Edge case handling**
  - [ ] Transform during camera pan/zoom (disable or queue)
  - [ ] Very small/large scales (min 0.1x, max 10x)
  - [ ] Rotation wrapping (0° to 360°, then back to 0°)
  - [ ] Off-screen objects (show gizmo at viewport edge?)

- [ ] **Visual polish**
  - [ ] Smooth animations (use Konva tweening)
  - [ ] Cursor feedback (resize arrows, rotation icon)
  - [ ] Transform preview (ghosted outline during drag?)
  - [ ] Undo/redo stack visualization

## Phase 15: SOLID Refactor Initiative (Future Work)

**Goal**: Break down remaining oversized "god files", restore SRP/SoC boundaries, and pair each change with forward-looking tests.

**Status**: App.tsx and MainLayout.tsx refactoring COMPLETE (see [DONE.md](DONE.md)). Remaining targets below.

### Remaining Refactoring Targets

- [x] **DM Controls Modularization** (DMMenu.tsx)
  - [x] Break `apps/client/src/features/dm/components/DMMenu.tsx` into panels (`MapControls`, `TokenControls`, `RoomManagement`, `DebugPanel`)
  - [x] Introduce `useDMMenuState` hook to isolate derived state/effects
  - [x] Cover each panel with interaction tests (e.g., lock toggles, fog controls) and storybook smoke checks

- [x] **Map Interaction Layers** (MapBoard.tsx)
  - [x] Decompose `apps/client/src/ui/MapBoard.tsx` into `CameraController`, `SelectionLayer`, and `ToolLayer`
  - [x] Move pointer/measure/draw orchestration into strategy modules reusable by `TransformGizmo`
  - [x] Add Vitest suites for camera commands, selection propagation, and tool switching; ensure e2e coverage through transform pipeline tests

- [ ] **Drawing Workflow Cleanup**
  - [ ] Split `apps/client/src/features/map/components/DrawingsLayer.tsx` into rendering vs state adapters
  - [ ] Refactor `apps/client/src/hooks/useDrawingTool.ts` into smaller hooks (`useFreehandTool`, `useShapeTool`, `useUndoRedo`)
  - [ ] Build focused tests per hook (stroke creation, shape handles, undo/redo) and integration tests for drawing persistence

- [ ] **Networking & Messaging Boundaries**
  - [ ] Break `apps/client/src/services/websocket.ts` into connection lifecycle, auth handshake, and message registry modules
  - [ ] Split `apps/server/src/ws/messageRouter.ts` into per-message handler modules with explicit typing
  - [ ] Extract heartbeat/reconnect logic from `apps/server/src/ws/connectionHandler.ts` into dedicated services
  - [ ] Add contract tests that replay canonical message transcripts and verify auth/reconnect flows

- [ ] **Server Domain Isolation**
  - [ ] Separate persistence, validation, and orchestration concerns inside `apps/server/src/domains/room/service.ts`
  - [ ] Break `apps/server/src/middleware/validation.ts` into schema-specific validators (transform, drawing, token, room)
  - [ ] Add regression tests for each validator and update error contract docs
  - [ ] Introduce service-level tests covering room lifecycle (create, join, persist) with in-memory adapters

- [ ] **Shared Models Partitioning**
  - [ ] Split `packages/shared/src/models.ts` into domain slices (`scene`, `player`, `token`, `drawing`)
  - [ ] Maintain backwards compatibility via barrel exports with deprecation notes
  - [ ] Document import guidelines and add lint rule preventing cross-domain leakage
  - [ ] Establish schema snapshot tests to detect accidental API surface regressions

- [ ] **Regression Protection**
  - [ ] Expand coverage for refactored areas (client Vitest, server Jest) to lock behaviour before/after splits
  - [ ] Update architecture diagrams / README to reflect new module boundaries
  - [ ] Add CI guard (lint rule or script) verifying max component size and enforcing boundary checks
  - [ ] Track structural metrics (LOC, dependency graph density) in CI to catch new god-file drift

**Success Criteria** (same as App.tsx refactoring):

- No targeted file exceeds agreed LOC threshold or mixes unrelated responsibilities
- Refactored modules ship with tests authored or updated during refactor (TDD pass)
- Contributor documentation highlights SOLID/SOC guardrails and test requirements for reviews
- CI enforces structural limits and contract tests to prevent regression

## High Priority (Post-MVP)

- [ ] Initiative tracker
  - [ ] Add/remove combatants
  - [ ] Track turn order
  - [ ] HP tracking
  - [ ] Status effects

- [ ] Token improvements
  - [ ] Right-click context menu for tokens
  - [ ] Token rotation
  - [ ] Token name labels

## Medium Priority

- [ ] Map layers
  - [ ] Fog of war / vision layer
  - [ ] DM-only layer for hidden objects
  - [ ] Multiple map layers (background, objects, tokens)

- [ ] UI/UX improvements
  - [ ] Keyboard shortcuts
  - [ ] Better mobile/tablet support
  - [ ] Dark/light theme toggle
  - [ ] Customizable hotkeys

- [ ] Drawing enhancements
  - [ ] Drawing layers (temporary vs permanent)

## Low Priority

- [ ] Audio features
  - [ ] Background music player
  - [ ] Sound effects
  - [ ] Ambient soundscapes

- [ ] Character sheets
  - [ ] Basic stat tracking
  - [ ] Inventory management
  - [ ] Character sheet templates

- [ ] Macros and automation
  - [ ] Simple command macros
  - [ ] Automated calculations
  - [ ] Custom scripts

- [ ] Integration features
  - [ ] Import from other VTT formats
  - [ ] Export game logs
  - [ ] Screenshot/record session

## Technical Improvements

- [ ] Performance optimization
  - [ ] Lazy loading for large maps
  - [ ] Reduce network bandwidth usage

- [ ] Security
  - [ ] Authentication system
  - [ ] Session encryption

- [ ] Testing (see CRITICAL section above)
  - [ ] Unit tests for shared logic
  - [ ] Integration tests for WebSocket communication
  - [ ] E2E tests for critical workflows

- [ ] Documentation (see CRITICAL section above)
  - [ ] API documentation
  - [ ] User guide
  - [ ] DM guide

- [ ] Deployment
  - [ ] Docker support
  - [ ] Cloud deployment guide (AWS, Fly.io, etc.)
  - [ ] Environment configuration management

## Bug Fixes

- [ ] Test and fix edge cases in token dragging
- [ ] Improve voice chat connection stability
- [ ] Fix portrait scaling issues
- [ ] Improve grid alignment at various zoom levels

## Future Ideas

- [ ] Animated tokens
- [ ] Weather effects
- [ ] Map tile system
- [ ] Spell effect animations
- [ ] Campaign management tools
- [ ] NPC generator
- [ ] Loot generator
- [ ] Battle map builder
- [ ] Mobile app (React Native)

---

**Priority Legend:**

- High = Core gameplay features
- Medium = Quality of life improvements
- Low = Nice-to-have features

Feel free to add, remove, or reprioritize items as needed!
