# HeroByte MVP TODO

## Goal

Ship a table-ready MVP to run live playtests with real players and a DM. Prioritize drawing/selection stability, DM session controls, and player-facing feedback so we can gather real game-night data fast.

## 1. Launch Blockers (must ship before scheduling playtest)

### Drawing & Selection Stability

- [ ] **Partial erase completion**
  - [x] Finish unit coverage for `splitFreehandDrawing` (middle/start/end removal, no-intersection, near-miss, tiny segments).
  - [x] Implement the splitting utility and reuse it in the client eraser path.
  - [x] Wire shared schema + server handling (`erase-partial` validation, `RoomService.handlePartialErase`, state persistence).
  - [ ] Add integration coverage in the message router and manual QA with two clients (erase + undo/redo sync).
    - [x] Add integration coverage in the message router.
    - [ ] Manual QA with two clients (erase + undo/redo sync). See `docs/manual-test-reports/2025-10-18-partial-erase.md` for step-by-step checklist.
- [ ] **Multi-select readiness**
  - [x] Fix multi-object selection persistence and marquee selection deselection logic.
  - [x] Implement synchronized multi-object dragging with real-time visual feedback.
  - [x] Add ownership-based multi-object deletion with Delete/Backspace keyboard shortcuts.
  - [ ] Surface a multi-select visual indicator (badge/outline, accessible colours).
  - [ ] Implement group lock/unlock and persist lock state in the scene graph.
  - [ ] Extract multi-select orchestration into a dedicated module and ship an integration test covering bulk transform + lock flows.

### Session Management & DM Tools

- [ ] Harden load/save UX: validate imports, show progress/error toasts, confirm success.
- [ ] Add a snapshot smoke test that loads sample data and asserts tokens/characters/scene objects.
- [ ] Review `clear-all-tokens` and other DM bulk actions for selection cleanup, persistence cadence, and confirmation prompts.
- [ ] **Player save/load parity**
  - [ ] Document the player snapshot schema (name, color, token URL, portrait URL, HP/max HP, status effects, size scaling, rotation, position, custom drawings).
  - [ ] Wire player serialization/deserialization through the server save pipeline and ensure client-side rehydration restores UI state (HP inputs, portrait slot, token transforms).
  - [ ] Persist player-authored drawings alongside token data and verify they reattach to the correct owner on load.
  - [ ] Add integration coverage for player save/load (unit test for serializer + end-to-end load of a sample save).
- [ ] **DM session persistence**
  - [ ] Extend the session schema to capture active map metadata (URL, wizard X/Y sizing, scaling, rotation) and DM drawings.
  - [ ] Persist NPC tokens with their URLs, portrait URLs, sizing overrides, and positions; ensure they respawn correctly when loading a session.
  - [ ] Validate session load restores the active map plus all DM drawings/NPC tokens before players join; add regression tests for partial saves.
- [ ] **Player staging zone (DM object)**
  - [ ] Design the staging zone data model (default size, color/opacity, spawn radius) and add authoring controls to DM tools.
  - [ ] Persist the staging zone in session saves and spawn players inside it when they connect or reload.
  - [ ] Add smoke coverage verifying new players spawn inside the staging zone and fall back gracefully if none exists.

### Onboarding & Core UI Feedback

- [x] Disable the join/connect button during handshake, animate “Connecting…”, and recover cleanly from timeouts.
- [ ] Add the portrait placeholder CTA square (with tests) so players know where to click.
- [ ] Ensure HP/rename inputs provide success/failure feedback and broadcast correctly.

## 2. High-Priority Polish (tackle right after blockers)

### Player Experience

- [ ] Verify voice indicator + portrait glow survive reconnects and DM toggles.
- [ ] Refresh tips/tooltips for draw, measure, select so new players get guidance.
- [ ] Bug bash dice log readability for long formulas; adjust formatting if needed.

### DM Workflow

- [ ] Persist object lock state through reloads and show lock status on selection.
- [ ] Add a shortcut/command to select all tokens owned by a player (with safe undo).
- [ ] Improve map background management (upload feedback, loading spinner).

## 3. QA & Release Prep

- [ ] Run full automated suite (`pnpm test`, `pnpm --filter vtt-server test`, Playwright smoke).
- [ ] Manual two-browser checklist: auth, drawing, partial erase, multi-select, load/save, dice, voice. Archive findings in `test-results/`.
- [ ] Document MVP playtest setup (DM prep steps, recommended browsers, troubleshooting cheatsheet).
- [ ] Update README quick-start with playtest instructions and link to the new checklist.

## 4. Deferred Until After MVP

- README visual assets refresh (screenshots, GIF/video demo).
- Public roadmap and issue labeling workflow.
- LAN/Safari networking investigation.
- Security upgrades: player identity verification, DM authentication flow, post-password re-auth.
- Palette/color system (Phase 15), drawing/pointer polish (Phase 16), roll log redesign (Phase 18), DM provisioning & invites (Phase 19), asset library & grouping (Phase 20).
- Engineering guardrail doc refresh (keep current guidance, revisit post-MVP).
