# Phase 19 & 20 Planning Briefing

## Slide 1 · Session Goal
- Align on scope and sequencing for DM Player Provisioning (Phase 19) and Asset Library & Grouping (Phase 20).
- Confirm contract/test work products that must land pre-implementation.
- Surface cross-phase dependencies that could block delivery.

---

## Slide 2 · Phase 19 Snapshot
- Mission: empower DMs to pre-stage identities, issue secure invites, and reassign seats without downtime.
- Core Modules: `IdentityRegistry`, `InviteService`, `IdentityBinder`, `ClaimController`, auditing hooks.
- Key Risks: invite security (entropy, expiry), concurrency when multiple players claim identities, snapshot schema alignment.

---

## Slide 3 · Phase 19 Ticket Stack
- `P19.0 – Provisioning Research & Contracts`  
  - Deliverables: audited player/session model doc, SRP module boundary diagram, invite/token contract draft.  
  - Tests to author first: failing suites for invite validation edge cases + token-identity binding (shared schema + RoomService).
- `P19.1 – DM Identity Workspace`  
  - Deliverables: DM-only provisioning panel flows, persistence interface split write-up.  
  - Tests to author first: identity CRUD validation suites (schema + reducer) and mock DM access gating.
- `P19.2 – Invite Link Flows`  
  - Deliverables: single-use invite issuance handlers, fallback universal link toggle UX copy.  
  - Tests to author first: expiry/duplicate/missing-identity branches (router + middleware) and transport validation.
- `P19.3 – Identity Claim & Reassignment`  
  - Deliverables: session auto-bind logic, DM reassignment controls, “claimable” guardrail toggles.  
  - Tests to author first: concurrency specs for claim/rescind + multi-client broadcast coverage.

---

## Slide 4 · Phase 19 Dependencies
- Requires stable player UID/auth story from earlier phases (Phase 9 alignment).
- Snapshot schema updates must coordinate with Phase 18 persistence work.
- Security hardening backlog needs review of invite token lifecycle before implementation starts.
- UX sign-off: DM menu layout + failure messaging for expired/invalid invites.

---

## Slide 5 · Phase 20 Snapshot
- Mission: build reusable asset catalog, enable scene grouping, and support bundle sharing.
- Core Modules: `AssetCatalogService`, `LocalAssetStore`, `GroupingService`, `AssetSyncService`.
- Key Risks: storage quotas, asset metadata sanitization, group transform correctness, future backend sync strategy.

---

## Slide 6 · Phase 20 Ticket Stack
- `P20.0 – Asset Strategy Research`  
  - Deliverables: storage strategy brief (local vs backend), SRP module decomposition notes.  
  - Tests to author first: failing serialization/deserialization specs covering asset metadata variants.
- `P20.1 – Asset Catalog Foundations`  
  - Deliverables: catalog UI skeleton (maps/tokens/props/status effects) + persistence adapters.  
  - Tests to author first: asset CRUD + cache fallback failures (service + adapter suites) captured before wiring UI.
- `P20.2 – Scene Pinning & Grouping`  
  - Deliverables: grouping manager module, hierarchy metadata schema updates.  
  - Tests to author first: integration specs for group create/remove and bulk transforms (shared + client state).
- `P20.3 – Sharing & Sync`  
  - Deliverables: JSON bundle export/import pipeline, DM sync toggle flows.  
  - Tests to author first: round-trip bundle + opt-in/out sync specs (server + e2e style harness).

---

## Slide 7 · Phase 20 Dependencies
- Consumes storage recommendations finalized in `P20.0`; coordinate with privacy/governance review.
- Grouping semantics should pair with Phase 17 keyboard movement and Phase 18 snapshot schema.
- Sync/export design hinges on future backend roadmap; plan stub interfaces now to avoid rework.
- UX collaboration: asset panel IA, group affordances, sync confirmation dialogues.

---

## Slide 8 · Cross-Phase Alignment
- Shared schema changes (identities, assets, groups) must land in a single snapshot migration to avoid version churn.
- Establish red-phase cadence: contracts/tests land in week 1, implementation green phases gated on passing suites.
- Security & privacy reviews needed for invite tokens (Phase 19) and asset ingestion (Phase 20) before code merges.
- Coordinate manual QA scripts: multi-client identity claim flow + asset group drag/drop recorded for regression library.

---

## Slide 9 · Decision Checklist
- Approve ticket ordering and resource assignments.  
- Confirm who signs off on contract/test deliverables.  
- Decide whether to prototype invite/asset UIs before full implementation.  
- Lock planning milestones and review dates (mid-sprint checkpoints).

---

## Slide 10 · Maintenance Rhythm
- Treat `docs/planning/phase19-20-briefing.md` as the single briefing source; update whenever Phase 19/20 scope shifts in `TODO.md`.
- Pair any new or reprioritized checklist item with slide edits before merging changes.
- During sprint reviews, confirm deck + TODO alignment as part of exit criteria.
