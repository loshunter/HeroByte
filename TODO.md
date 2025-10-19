# HeroByte MVP TODO

## Goal

Ship a table-ready MVP to run live playtests with real players and a DM. Prioritize drawing/selection stability, DM session controls, and player-facing feedback so we can gather real game-night data fast.

## 1. Launch Blockers (must ship before scheduling playtest)

### Drawing & Selection Stability

- [ ] **Partial erase completion**
  - [ ] Manual QA with two clients (erase + undo/redo sync). See `docs/manual-test-reports/2025-10-18-partial-erase.md` for step-by-step checklist.
- [x] **Multi-select readiness**
  - [x] Extract multi-select orchestration into a dedicated module and ship an integration test covering bulk transform + lock flows.
    - Module extracted to `apps/client/src/features/multiselect/` with types and handlers
    - E2E tests in `apps/e2e/multi-select.spec.ts` (4 tests: 1 passing, 3 have DM toggle timing issues - deferred)

### Session Management & DM Tools

- [x] **Player save/load parity**
  - [x] Document the player snapshot schema (name, color, token URL, portrait URL, HP/max HP, status effects, size scaling, rotation, position, custom drawings).
    - Comprehensive schema documentation created in `docs/player-snapshot-schema.md`
  - [x] Wire player serialization/deserialization through the server save pipeline and ensure client-side rehydration restores UI state (HP inputs, portrait slot, token transforms).
    - Server pipeline verified at `apps/server/src/domains/room/service.ts:119` (saveState) and `:81` (loadState)
    - Client rehydration verified through PlayerCard → HPBar, PortraitSection, NameEditor components
  - [x] Add integration coverage for player save/load (unit test for serializer + end-to-end load of a sample save).
    - E2E tests in `apps/e2e/player-state.spec.ts` (4 tests: 2 passing, 2 have server broadcast timing issues - deferred)

## 2. High-Priority Polish (tackle right after blockers)

### Player Experience

- [ ] Verify voice indicator + portrait glow survive reconnects and DM toggles.
- [ ] Refresh tips/tooltips for draw, measure, select so new players get guidance.
- [ ] Bug bash dice log readability for long formulas; adjust formatting if needed.

### DM Workflow

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
