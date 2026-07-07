# Renderer Endgame Playbook

Written 2026-07-06 by the senior-dev session that shipped R1–R4a. This is the
execution plan for every remaining slice of the shared-tile-renderer migration
(VISION Pillar 2) plus the two open hardening chips, written so a **junior dev
or a less capable model session can execute it verbatim without me**. It is
self-contained: every invariant, command, and working method you need is in
this file. The companion map of *what and why* is
`docs/planning/shared-tile-renderer-plan.md` (statuses current as of R4a).

**State of the world:** R1 `b507aeec`, R2 `57780130`, R3 `6fa499f7`,
upload-hole fix `73dc254d`, R4a `0e944a8b` — all on `dev`, all gates green.
Remaining: Slice L (lazy-split), R5a (protocol), R5b (table rendering),
R4b (raster export), Slice S (/assets hardening), R4c-prep (optional).

---

## 0. How we work — read this section at the start of EVERY session

### 0.1 Session bootstrap (do these in order, then STOP exploring)

1. Read this file top to bottom once, then the section for your slice.
2. `git log --oneline -8` — confirm the frontier matches what your slice's
   "Preconditions" expects. Treat committed work as DONE and verified; do not
   re-open or re-verify it.
3. Run the recon commands listed in your slice ONLY. Do not do broad
   architecture exploration — it is already captured here and in the plan doc.
   If recon contradicts an "Expected finding" below, STOP and re-plan that
   slice before writing code; do not improvise around a broken assumption.
4. Create a task list (TaskCreate) with your slice's steps; mark in_progress /
   completed as you go. One slice per session. Do not start a second slice in
   the same session if context is already long.

### 0.2 The slice loop (Karpathy method — one verified slice per commit)

For every slice, in this exact order:

1. **Recon** only the files the slice names.
2. **Pin current behavior first.** Before refactoring anything with a
   compatibility contract, add golden tests against the CURRENT code and run
   them so they capture today's output. Trick: `expect(x).toMatchInlineSnapshot()`
   with no argument auto-populates from the current implementation on first
   `vitest run` — commit-quality goldens in one step.
3. **Write the new tests next** and run them to watch them fail (red state).
   If they pass before you implement, your test is wrong.
4. **Implement.** Smallest end-to-end change that makes them green.
5. **Targeted tests** for the touched packages/files.
6. **Full verify ritual** (§0.3).
7. **Adversarial review** if the slice requires it (§0.4). Fix every
   CONFIRMED finding, then re-run the ritual from the failing gate onward.
8. **Commit to `dev`** (§0.6). Never commit with any gate red.

### 0.3 The verify ritual (verbatim, in order — do not reorder or skip)

```powershell
# 0. ONLY if you touched packages/shared (stale-dist trap — server/client
#    resolve @herobyte/shared from dist/, not src):
pnpm --filter "@herobyte/shared" build

# 1. Targeted tests for what you changed (fast feedback):
pnpm --filter herobyte-client exec vitest run <paths...>       # client
pnpm --filter vtt-server test -- <path>                        # server

# 2. Typecheck (vitest does NOT typecheck):
pnpm --filter herobyte-client typecheck
# (server typecheck runs inside its test/build; if you touched server TS run
#  pnpm --filter vtt-server build if a typecheck script is absent)

# 3. Lint: eslint --fix your changed files, then the ROOT lint
#    (root covers shared AND server AND client — client-only lint once let
#     server prettier errors reach a commit — AND the frozen-test gate,
#     which fails if any *.frozen.test.* contract file was edited):
pnpm --filter herobyte-client exec eslint --fix <changed files>
pnpm lint

# 4. Structure guard (SEPARATE script, NOT part of pnpm lint; 350-LOC cap):
pnpm lint:structure:enforce

# 5. Full unit suite (~4 min):
pnpm test

# 6. E2E (56 tests, ~3.3 min):
pnpm test:e2e

# 7. Bundle guard (entry must stay lazy-clean; ~87 KB of 175 KB used today):
pnpm --filter herobyte-client build
node apps/client/scripts/check-bundle-size.mjs
```

Known transients: the batched client runner can fail under contention if a
review Workflow is running (NEVER run `pnpm test` while a Workflow is live);
e2e occasionally flakes on server startup — retry once before investigating.

**Mandatory pre-commit checklist** (after all gates, before `git commit`):
1. `git branch --show-current` → must print `dev`.
2. `git status --short` → ONLY your slice's files. The tree contains
   pre-existing untracked/modified files that are NOT yours
   (`assets/images/Inspiration/`, `assets/images/logo/*`, `.gitignore`,
   `.agents/AGENTS.md`) — never stage them. Therefore: **never `git add -A`
   or `git add .`** — always stage an explicit file list.
3. Read `git diff --cached` line by line. You are looking for: snapshot
   blocks you didn't intend to change, debug leftovers, accidental deletions.
   If anything surprises you, stop and explain it before committing.
4. Every gate in §0.3 ran green IN THIS SESSION (not remembered from an
   earlier state of the code).

### 0.4 Adversarial review — when and how

**When (binding rules from the project owner):**
- Protocol- or security-touching diff → **full review REQUIRED**
  (R5a and Slice S below).
- Compatibility-critical refactor (anything that could silently break the
  export byte-parity contract or published-snapshot back-compat) → focused
  review of that surface.
- Pure additive client rendering with good unit+e2e coverage → skip the
  workflow; do a careful self-review of `git diff` instead.

Track record this migration: every review found real bugs (R2: 3 confirmed,
R3: 4 confirmed) that tests and self-review missed. Do not rationalize
skipping a REQUIRED one.

**How:** launch a Workflow with 2–3 finder lenses and 2 skeptics per finding.
Only findings **upheld by BOTH skeptics** get fixed; refuted ones are dropped;
contested (1/2) are judgment calls — read both vote reasonings and decide.
Findings arrive with concrete failure scenarios; verify the scenario yourself
against the code before fixing. Template (adapt CONTEXT + LENSES; keep the
schemas and the refute-by-default skeptic prompt):

```js
export const meta = {
  name: '<slice>-review',
  description: '<one line>',
  phases: [{ title: 'Find' }, { title: 'Verify' }],
}
const FINDINGS_SCHEMA = { type: 'object', required: ['findings'], properties: {
  findings: { type: 'array', items: { type: 'object',
    required: ['title', 'file', 'description', 'failureScenario', 'severity'],
    properties: { title: {type:'string'}, file: {type:'string'}, line: {type:'number'},
      description: {type:'string'}, failureScenario: {type:'string'},
      severity: {type:'string', enum:['critical','major','minor']} } } } } }
const VERDICT_SCHEMA = { type: 'object', required: ['refuted','reasoning'],
  properties: { refuted: {type:'boolean'}, reasoning: {type:'string'} } }
const CONTEXT = `Repo: D:\\HeroByte (Windows). Review the UNCOMMITTED working-tree
changes (git diff HEAD + untracked files) for <slice>. <what changed, files,
invariants>. RULES: READ-ONLY. Do NOT run pnpm test / vitest / builds. git
commands and file reads are fine. Report only defects with a concrete failure
scenario; no style nits. Unit+e2e suites already pass.`
const LENSES = [ { key: '<lens1>', prompt: `${CONTEXT}\nLENS — ...: <specific hunt list>` },
                 { key: '<lens2>', prompt: `${CONTEXT}\nLENS — ...: <specific hunt list>` } ]
const found = await parallel(LENSES.map((l) => () =>
  agent(l.prompt, { label: `find:${l.key}`, phase: 'Find', schema: FINDINGS_SCHEMA })))
const findings = found.filter(Boolean).flatMap((r, i) =>
  r.findings.map((f) => ({ ...f, lens: LENSES[i].key })))
if (findings.length === 0) return { confirmed: [] }
const judged = await parallel(findings.map((f) => () =>
  parallel(Array.from({ length: 2 }, (_, k) => () =>
    agent(`${CONTEXT}\nYou are skeptic #${k + 1}. A reviewer claims:\nTITLE: ${f.title}\nFILE: ${f.file}\nCLAIM: ${f.description}\nSCENARIO: ${f.failureScenario}\nRead the actual code and try to REFUTE it concretely. If it cannot occur, is pre-existing (not introduced by this diff), or has no user-visible/invariant consequence, set refuted=true. Default refuted=true if uncertain. No test runs.`,
      { label: `verify:${f.title.slice(0, 30)}`, phase: 'Verify', schema: VERDICT_SCHEMA }),
  )).then((votes) => ({ ...f, upheld: votes.filter(Boolean).filter((v) => !v.refuted).length }))))
return { confirmed: judged.filter((f) => f.upheld === 2),
         contested: judged.filter((f) => f.upheld === 1),
         refuted: judged.filter((f) => f.upheld === 0).map((f) => f.title) }
```

While the workflow runs (10–15 min): do read-only prep for the next step
(recon, drafting tests). Never run test suites or builds.

**If your harness has no Workflow tool** (e.g. Codex, or a restricted
session): do NOT self-certify a REQUIRED review. Instead: (1) finish the
implementation and all §0.3 gates; (2) write the lens hunt-lists for your
slice into the Attempt log as an explicit "review pending" entry; (3) leave
the work UNCOMMITTED (or on a branch, never on `dev`) and end the session,
telling the owner review is outstanding. A protocol/security slice merged
without adversarial review is a playbook violation even if every test is
green — the reviews on R2/R3 found seven real bugs that green suites missed.

### 0.5 Hard invariants and traps (violating any of these is a stop-ship)

- **Export byte-parity.** `renderMapDocumentSvg` output must stay
  byte-identical for every possible MapDocument across renderer refactors.
  Pinned by golden snapshots in
  `__tests__/terrainRenderParity.frozen.test.ts` — that file is
  **hash-locked**: `scripts/check-frozen-tests.mjs` runs inside `pnpm lint`
  and fails the build if it is edited, renamed, or deleted. If those tests go
  red, the bug is in your code — fix the code. (`exportMapDocument.test.ts`
  is add-only: new tests fine, editing existing assertions is not — that one
  is enforced by the diff-read step in §0.3, so actually read the diff.)
  Lesson from R2: edge orientation is an explicit `"h" | "v"` field — never
  re-derive geometry facts from float coordinates.
- **350-LOC file guard** (`pnpm lint:structure:enforce`, separate from lint).
  If a file approaches the cap, split by responsibility (precedent:
  `gridRenderCore.ts` split out of `tileRenderCore.ts`). Never update the
  baseline to excuse a new violation.
- **Stale shared dist:** rebuild `@herobyte/shared` after ANY shared edit.
- **175KB gzip entry guard.** Renderer code must not grow the entry chunk.
  Slice L (DONE) moved the Map Studio editor into a lazy chunk — entry is now
  ~69KB (was ~87KB). Atlas image/manifest are `public/` statics and never count.
- **1MB WS inbound cap.** The server SILENTLY drops any inbound WebSocket
  message over 1MB (`connectionHandler` maxMessageSize). Publish payload must
  stay under `MAX_PUBLISH_BACKGROUND_BYTES` (1MB − 16KB margin) — extend the
  guard if you add payload fields, never bypass it.
- **pnpm store trap: DO NOT `pnpm add` anything.** node_modules is linked
  from store v11; the PATH pnpm (10.17.1) wants v10 — any install errors with
  ERR_PNPM_UNEXPECTED_STORE and would force a full relink. If a slice seems to
  need a dependency, find a no-dependency route (precedent:
  `scripts/build-tile-atlas.ps1` uses PowerShell + System.Drawing instead of
  sharp) or stop and ask the owner.
- **Units:** tokens/props are grid CELLS; geometry/pointers are PIXELS.
  Convert via shared `gridCellToWorldPoint`. Terrain lattice: pixel =
  `offset + cell * size`.
- **Reduced motion** must freeze all ambient animation to frame 0 — you get
  this for free by driving everything through
  `features/render/animationClock.ts` / `useAnimationFrameIndex`. Never add a
  second timer.
- **Player-safe rendering:** anything the table renders must come from
  player-safe data (compiledScene already strips secret doors). Terrain is
  visible map art — fine — but never move hidden-info rendering client-side.

### 0.6 Conventions

- **Commits:** one slice per commit, on `dev`, style
  `feat|fix: <thing> — <one-line flavor>` + a body paragraph explaining what
  and why + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  (keep this trailer even when another model executes; it marks the plan
  lineage). Multi-line commit messages in PowerShell: `git commit -m @'...'@`
  with the closing `'@` at column 0.
- **Testing tools you'll reuse:**
  - `features/render/__tests__/recordingContext.ts` — mock 2D context that
    records method calls AND property sets in order (`["set:fillStyle", ...]`,
    `["fillRect", ...]`), plus `hasCallPair`. Use it for every canvas test.
  - jsdom canvases: install `vi.spyOn(HTMLCanvasElement.prototype,
    "getContext"/"getBoundingClientRect")` BEFORE `render()`.
  - Clock-driven tests: `vi.useFakeTimers()` +
    `__resetJuiceSettingsForTests({motion:"full"})` +
    `__resetAnimationClockForTests()` in beforeEach; advance by
    `ANIMATION_STEP_MS`; wrap advances in `act()`. Reset the clock again in
    afterEach.
  - react-konva is mocked to divs exposing a props array — see
    `ui/__tests__/MapBoard.test.tsx`. Konva `sceneFunc`s are NOT executed by
    that mock: extract draw logic into pure functions and test those with the
    recording context instead.
  - Server contract tests: real `Container` + fake
    `{readyState:1, send:vi.fn()}` sockets, inspect every frame per recipient
    (`apps/server/src/ws/__tests__/multiRoom.contract.test.ts`).
  - Client vitest `localStorage` global is broken — mock via
    `Object.defineProperty(globalThis, "localStorage", ...)`
    (pattern in `features/rooms/__tests__`).
- **Out-of-scope discoveries:** don't fold them in. Spawn a background-task
  chip (spawn_task) with a self-contained prompt, or add a line to the plan
  doc. Precedents: task_f3d374a0 (/assets hardening), task_7f6ecfca
  (lazy-split).
- **End of session:** update slice status in BOTH plan docs
  (`shared-tile-renderer-plan.md` and this file's checklist in §8), and if the
  session's model has project memory, update the frontier note in
  `herobyte-north-star-vision.md` with commit hashes.

### 0.7 Anticipated failure modes — prevention and recovery

These are the specific ways executor sessions go wrong. Each has a
prevention rule, a detection signal, and a recovery procedure. When you
notice a detection signal, STOP and run the recovery — do not push through.

**F1. Editing tests to force green.**
- Prevent: the parity pins are hash-locked (fails `pnpm lint`). For all other
  tests the rule is: a test you didn't write in this slice that goes red is
  evidence about YOUR code. Never weaken an assertion, never delete a test,
  never run `vitest -u` / `--update` (banned outright — it rewrites every
  snapshot in reach).
- Detect: your diff touches a `__tests__` file you weren't instructed to
  touch, or a snapshot block changed that you didn't deliberately author.
- Recover: `git checkout -- <test file>`, re-run the failing test, and debug
  the product code. If you genuinely believe the old expectation is wrong,
  that is an owner decision — Attempt log + stop.

**F2. Improvising past a STOP condition.**
- Prevent: the "Expected findings" in each slice's recon are load-bearing;
  the designs assume them.
- Detect: you are writing code that isn't described in your slice's Steps, or
  you're adding a workaround for something the plan says shouldn't happen.
- Recover: `git stash`, write what you found in the Attempt log (§9), end
  the session. An unimplemented slice costs a day; an improvised protocol
  costs a migration.

**F3. Touching dependencies.**
- Prevent: NEVER run `pnpm add`, `pnpm install`, `pnpm update`, or delete
  `node_modules`. The store-version mismatch (§0.5) makes all of these
  destructive. Every slice in this playbook is designed to need zero new
  packages.
- Detect: the exact error `ERR_PNPM_UNEXPECTED_STORE` means you already
  crossed the line.
- Recover: if you only ran `pnpm add` and it errored, nothing changed — carry
  on. If you ran `pnpm install` and it started relinking: stop everything,
  do NOT try to fix it, write exactly what you ran in the Attempt log, end
  the session. Restoring node_modules is an owner action (nothing in git is
  harmed; the working tree code is safe).

**F4. Staging the wrong files.**
- Prevent: explicit `git add <file list>` only (§0.3 checklist). Known
  bystanders that must never be committed: `assets/images/Inspiration/`,
  `assets/images/logo/*.png`, `.gitignore`, `.agents/AGENTS.md`.
- Detect: `git status --short` shows staged files outside your slice.
- Recover: before commit: `git reset <file>`. After commit (not yet pushed):
  `git reset --soft HEAD~1`, restage correctly, recommit with the same
  message. Never `git reset --hard` (it destroys working-tree changes).

**F5. Committing on the wrong branch.**
- Prevent: `git branch --show-current` in the pre-commit checklist.
- Recover: if you committed to `main` by mistake: do not push, do not try
  branch surgery — Attempt log with the commit hash, end the session.

**F6. Running suites during a live review Workflow.**
- Detect: batched client tests fail with contention/worker errors while your
  Workflow is running.
- Recover: it's transient. Wait for the Workflow to complete, re-run — it
  goes green. Do not start "fixing" those failures.

**F7. Context exhaustion.**
- Prevent: one slice per session; recon via §0.8 pointers instead of
  searching; Read big files only at the listed offsets; never re-read files
  you already have; summaries not transcripts in the Attempt log.
- Detect: you have burned most of your window and implementation hasn't
  started — or you feel pressure to "skip the ritual just this once."
- Recover: the ritual is never the thing to cut. Write the Attempt log entry,
  end the session; the next session picks up from a clean tree + your notes.

**F8. Hallucinated APIs.**
- Prevent: only call functions/types you have SEEN in a file during this
  session (§0.8 tells you where everything is). If you "remember" an API but
  can't cite the file, look it up first.
- Detect: typecheck errors about missing exports/properties.
- Recover: believe the compiler. Read the actual source file, don't guess a
  second spelling.

**F9. E2E flake vs. real failure.**
- Rule: same test failing twice in a row = real. Failing once then passing =
  flake, note it and move on. If e2e fails with port errors, a leftover dev
  server is running: `pnpm dev:free` (frees 5174/8787) and
  `pnpm e2e:free` (5175/8788), then re-run.

**F10. Fixing symptoms at the wrong layer.**
- Rule: terrain geometry has ONE source of truth
  (`buildStructuredTerrainLayers`); grid geometry has ONE
  (`getGridGeometry`'s path strings). If two render surfaces disagree, the
  bug is in exactly one consumer or in the shared source — never patch both
  sides to converge, and never fork the math into a second implementation.

**F11. Auto-written snapshots hiding drift.**
- `vitest run` AUTO-POPULATES empty `toMatchInlineSnapshot()` calls by
  editing your test file. That's the pinning technique (§0.2) — but it means
  a test file can change without you typing in it. The diff-read in the
  pre-commit checklist is the catch: any snapshot content in the diff must be
  content you deliberately pinned.

**F12. Leaving processes running.**
- Dev servers, vite watchers, or preview browsers left running cause port
  conflicts and flaky suites later. Before running `pnpm test:e2e`, and at
  session end, kill what you started (`pnpm dev:free`). Also note: the app
  renders a MOBILE layout below ~1280px width — a "missing DM MENU button"
  during manual smoke means your window is too narrow, not a bug.

### 0.8 Context index — where everything lives (read this, don't search)

Line numbers verified 2026-07-06; if a file has drifted, the grep pattern
finds the symbol in one call. Strategy column says how to load it without
wasting context.

**Renderer core — small files, read whole when your slice touches them:**

| File | LOC | What's in it |
|---|---|---|
| `apps/client/src/features/render/tileRenderCore.ts` | ~210 | `drawTerrain`, `TerrainCellRect` (has `cellX/cellY`), `TerrainBoundaryEdge` (explicit `orientation`), `StructuredTerrainLayer`, `TerrainStyleResolver`, `RenderViewRect`, `TileRenderContext2D`, `TerrainAtlasSource`, `TerrainDrawOptions` |
| `apps/client/src/features/render/gridRenderCore.ts` | ~175 | `drawGrid`, `GridPattern`, `GridDrawStyle`, `parseGridPatternPath` |
| `apps/client/src/features/render/tileAtlas.ts` | ~120 | `TileAtlas`, `createTileAtlas`, `variantIndexForCell`, `loadTileAtlas` (singleton), `useTileAtlas`, `__resetTileAtlasForTests` |
| `apps/client/src/features/render/animationClock.ts` | 86 | `ANIMATION_STEP_MS` (300), `subscribeAnimationClock`, `animationClockStep`, `__resetAnimationClockForTests` |
| `apps/client/src/features/render/useAnimationClock.ts` | ~40 | `useAnimationFrameIndex(frameCount, enabled)` |
| `apps/client/src/features/render/__tests__/recordingContext.ts` | ~60 | `createRecordingContext` (mock 2D ctx), `hasCallPair` |

**Map Studio:**

| File | LOC | Strategy / anchors |
|---|---|---|
| `features/map-studio/terrainRender.ts` | ~100 | read whole. `buildStructuredTerrainLayers` (single source of terrain geometry), `buildTerrainRenderLayers` (byte-parity SVG adapter) |
| `features/map-studio/tileAutotiling.ts` | ~125 | read whole. `buildTileOccupancy` (image-tile exclusion inside the element loop), `isAutotileCandidate`, `tileBoundaryPath` |
| `features/map-studio/starterTiles.ts` | ~190 | read whole. `MAP_STUDIO_TILE_ASSETS`, `getMapStudioTileAsset`, `terrainFillForFrame`, `terrainStyleForFrame` |
| `features/map-studio/gridGeometry.ts` | 35 | read whole. `getGridGeometry` — the ONLY source of grid path strings |
| `features/map-studio/exportMapDocument.ts` | ~300 | read whole for R4b/R5a. `renderMapDocumentSvg`:20, `renderTerrain`:47, `MAX_PUBLISH_BACKGROUND_BYTES`:74, `backgroundExceedsPublishLimit`:76, `createMapDocumentSvgDataUrlWithAssets`:86, `rasterizeMapDocument`:146, `renderElement`:203 |
| `features/map-studio/components/MapStudioCanvasUnderlay.tsx` | ~200 | read whole — it is the REFERENCE implementation for every new canvas surface (camera transform, offscreen opacity composite, DPR listener, atlas usage) |
| `features/map-studio/components/MapStudioCanvas.tsx` | ~300 | read whole only for editor-JSX work; underlay wiring is near the top of the JSX |
| `features/map-studio/components/useStudioCamera.ts` | 94 | read whole |
| `features/map-studio/components/mapStudioWorkspaceUtils.ts` | ~305 | grep `renderedSvgViewport` (letterbox math, exported), `eventToMapPoint`:11 |
| `features/map-studio/index.ts` | small | the barrel — Slice L's target |
| `features/map-studio/uploads/assetUpload.ts` | small | `uploadHashFromAssetId`, `uploadedAssetUrl`, `clampImageMime` |

**Shared package (`packages/shared/src`) — index.ts is 602 LOC, NEVER read whole:**
- `index.ts:329` `mapBackground?: string` on the snapshot; `:340`
  `compiledScene?: CompiledScene`; `:520–536` the client→server message
  union — publish is `:528` `{ t: "map-studio-publish"; documentId; background }`.
  Grep `"RoomSnapshot"` for the snapshot interface head.
- `terrain.ts` — `TerrainMap`, `forEachTerrainCell`, `getTerrainCell`,
  `paintTerrain`, RLE codec (read whole, it's the R5a payload type).
- `sceneGeometry.ts` — `gridCellToWorldPoint`. `sceneCompiler.ts` —
  `CompiledScene`, `CompiledDoorState`. `mapStudioGrid.ts` — `sanitizeMapGrid`.
- After ANY shared edit: `pnpm --filter "@herobyte/shared" build`.

**Server (`apps/server/src`) — targeted reads:**
- `domains/map/service.ts` (390 LOC) — publish/compile handling; `:78` sets
  `state.mapBackground`. Read whole for R5a.
- `ws/dispatchers/MapDispatcher.ts` — message routing; grep
  `"map-studio-publish"` across `apps/server/src` to walk the publish chain.
- `middleware/validators/mapValidators.ts:19` + neighbors — message
  validation; publish cases in
  `middleware/__tests__/mapStudioValidation.test.ts:21,152–155`.
- 1MB inbound cap: grep `maxMessageSize` in `apps/server/src/ws`.
- `http/routes.ts` + `domains/assets/` — Slice S surface.
- Contract-test pattern: `ws/__tests__/multiRoom.contract.test.ts`.

**Live table (R5b):**
- `ui/MapBoard.tsx` (660 LOC — NEVER read whole). Background `<Layer>` at
  `:506–535`: `MapImageLayer` (src = `mapObject?.data.imageUrl ??
  snapshot?.mapBackground`), `GridLayer` (the table's OWN grid — leave it),
  `DoorsLayer`. `useGridConfig` around `:271`. Read `:460–540` for the stage
  + background region; grep for anything else.
- `features/map/components/` — `MapImageLayer.tsx`, `GridLayer.tsx`,
  `DoorsLayer.tsx`, `FogLayer.tsx` (read MapImageLayer + GridLayer whole to
  copy the `cam`/transform conventions). Avoid `TokensLayer.tsx` (806) and
  `DrawingsLayer.tsx` (564).
- Konva mock pattern: `ui/__tests__/MapBoard.test.tsx`.

**Client plumbing:**
- `ui/App.tsx` (801 LOC — NEVER read whole): `:42` imports `useMapStudio`;
  grep `matchMedia` for the mobile-layout query.
- `layouts/CenterCanvasLayout.tsx`: `:29` static `MapStudioWorkspace` import
  (Slice L removes), `:32` the `React.lazy` MapBoard pattern to copy.
  `layouts/MobileLayout.tsx`: `:18/:22` same pair.
  `layouts/FloatingPanelsLayout.tsx:26` — lazy `DMMenuContainer` precedent.
- Client publish send site: grep `"map-studio-publish"` in `apps/client/src`.

**E2E, scripts, assets:**
- `apps/e2e/helpers.ts:3–4`: passwords `Fun1` / `FunDM`;
  `joinDefaultRoomAsDM`:22, `elevateToDM`:27.
  `apps/e2e/map-studio.smoke.spec.ts` — the studio flow to extend.
- `scripts/`: `check-bundle-size.mjs` (175KB guard),
  `structure-report.mjs` (350-LOC guard), `check-frozen-tests.mjs` (+
  `frozen-tests.lock.json`), `build-tile-atlas.ps1` (atlas bake, Windows),
  `run-vitest-batched.mjs` (what `pnpm test` runs for the client),
  `run-e2e.mjs`, `dev-port-preflight.mjs` (powers `pnpm dev:free`).
- `apps/client/public/tiles/tileset-v1.{png,json}` — the baked atlas +
  manifest (license: UNSPECIFIED — owner question).
- Docs: `VISION.md` (Pillar 2 ≈ line 40, M3 exit ≈ 138, client budgets ≈
  162), `docs/planning/shared-tile-renderer-plan.md` (slice statuses).

**Command quick reference:**
```powershell
pnpm --filter herobyte-client exec vitest run <paths>   # client tests, targeted
pnpm --filter vtt-server test -- <path>                 # one server test file
pnpm test / pnpm test:e2e / pnpm test:e2e:smoke         # suites
pnpm lint / pnpm lint:structure:enforce / pnpm lint:frozen
pnpm --filter herobyte-client build; node apps/client/scripts/check-bundle-size.mjs
pnpm dev            # both dev servers (client 5174, server 8787)
pnpm dev:free       # free stuck dev ports        pnpm e2e:free  # e2e ports
pwsh scripts/build-tile-atlas.ps1                       # rebake atlas (art changes only)
```

### 0.9 Per-slice kickoff prompts (owner: paste one per session)

Start every executor session with exactly one of these. They scope the
session and pre-empt the failure modes in §0.7.

> You are executing **Slice <L | R5a | R5b | R4b | S | R4c-prep>** of
> `docs/planning/renderer-endgame-playbook.md` in `D:\HeroByte`. First read
> §0 of that file in full, then your slice's section, then begin with its
> recon commands. Binding rules: one slice this session; stop conditions are
> real — when recon contradicts an expected finding, stash and stop; use the
> §0.8 context index instead of searching; never edit frozen or existing
> tests to make them pass; never run `pnpm add/install`; stage explicit file
> lists only; commit to `dev` only with every §0.3 gate green in this
> session. If you cannot finish cleanly, leave the tree stashed and write the
> Attempt log entry (§9) instead of committing.

For R5a and S append:
> This slice REQUIRES the adversarial review in §0.4. Run it (or the
> no-Workflow fallback if your harness lacks the tool), fix confirmed
> findings, re-run the gates — then STOP WITHOUT COMMITTING. Post the full
> `git diff` summary, the review verdicts, and the gate results, and leave
> the tree for the owner to read and commit. Protocol/security slices do not
> land on `dev` without owner eyes.

### 0.10 Escape hatches

- A gate won't go green and you can't see why within ~30 min → stop, revert to
  clean tree (`git stash`), write what you tried + the failing output into
  this file under the slice's "Attempt log", end the session. A red `dev` is
  worse than a missing slice.
- Review confirms a defect you can't fix cleanly → same: stash, document, stop.
- Recon contradicts an "Expected finding" → re-plan before coding; if the
  re-plan changes protocol or removes a safety property, stop and ask the
  owner.

---

## 1. The day at a glance

Priority order (each slice = one commit = one session; time boxes include
ritual + review):

| # | Slice | What | Time box | Review | Risk |
|---|-------|------|----------|--------|------|
| 1 | **L** | Lazy-load Map Studio out of the entry | 1.5 h | self-review | low |
| 2 | **R5a** | Publish carries terrain (protocol) | 3 h | **REQUIRED (full)** | medium |
| 3 | **R5b** | Live table draws terrain via the core | 3 h | focused (rendering) | medium |
| 4 | **R4b** | Raster export composites via the core | 2 h | focused (export surface) | medium |
| 5 | **S** | /assets rate limit + body cap | 2 h | **REQUIRED (security)** | medium |
| 6 | **R4c-prep** | 47-blob math behind a flag | optional | self-review | low |

Dependencies: R5b needs R5a. R4b is independent of R5 (do it 4th regardless).
L first — it's the calibration slice (teaches the ritual end-to-end with low
stakes) and buys entry-budget headroom before R5b adds table code.
If the day ends after #3, the pillar's headline (one renderer, both surfaces,
water animating at the table) is DONE; #4–6 carry over.

**Owner routing note (risk allocation by executor capability):**
- Safe to hand to any executor: **L, R4b, R5b, R4c-prep** — client rendering,
  visible-and-revertible failure modes, strong unit/e2e nets.
- **R5a and S** are protocol/security: their failure modes are silent and
  persistent, AND the adversarial-review safety net runs on the same model
  that wrote the code (weaker executor ⇒ weaker reviewers). Prefer the
  strongest available model for these two; if a lesser model executes them,
  the OWNER must personally read the full diff before it lands on `dev` — the
  kickoff prompt for these slices tells the executor to stop before
  committing and leave the diff for review.

---

## 2. Slice L — Lazy-load Map Studio (chip task_7f6ecfca) — DONE ✅

Shipped (commit on `dev`; self-review). **Entry chunk 87.14 KB → 69.17 KB
gzipped** (~18 KB drop): the Map Studio editor graph now lives in a lazy
`MapStudioWorkspace-*.js` chunk. **Actual shipped shape:**
- `features/map-studio/index.ts` (barrel) no longer re-exports
  `MapStudioWorkspace` — a static re-export dragged the editor into the entry
  because `App.tsx` imports the barrel for `useMapStudio`. The barrel keeps
  `useMapStudio`, types, and the `exportMapDocument` utils (already in entry via
  `useMapStudio`, so free).
- `CenterCanvasLayout.tsx` + `MobileLayout.tsx`:
  `const MapStudioWorkspace = React.lazy(() => import(".../components/
  MapStudioWorkspace").then((m) => ({ default: m.MapStudioWorkspace })))`
  (named export → default), each render site wrapped in
  `<Suspense fallback={<MapLoading />}>` (copies the MapBoard lazy pattern).
- `MobileLayout.test.tsx`: mock moved from the barrel to the direct import path;
  the map-studio-mode test is now async (`await findByTestId` — the lazy chunk
  resolves after the Suspense fallback). It was the one test that broke on the
  new Suspense boundary; `MapStudioWorkspace.test.tsx` imports by path and was
  unaffected. No `CenterCanvasLayout.test.tsx` exists.
- Verified: the editor's cyan-grid marker `127,214,255` is now ONLY in
  `MapStudioWorkspace-*.js`, gone from the entry chunk.

Below is the original decided design (historical):

**Goal:** the Map Studio feature (editor components + renderer core it pulls)
moves out of the entry chunk into a lazy chunk, like MapBoard already is.
**Why:** VISION requires "DM Deck and Forge in lazy chunks"; today the whole
editor ships in the entry (~87KB of the 175KB guard) because of static imports.

**Preconditions:** frontier at `0e944a8b`+.

**Recon (expected findings — verify, don't trust):**
- `Grep "from \"../features/map-studio\"" apps/client/src` and
  `Grep "from \"../../map-studio\"" apps/client/src` — expected import sites:
  - `ui/App.tsx:42` — `useMapStudio` (HOOK — must stay statically importable
    without dragging components).
  - `layouts/CenterCanvasLayout.tsx:29`, `layouts/MobileLayout.tsx:18` —
    `MapStudioWorkspace` (COMPONENT — this is what goes lazy).
  - Several `import type { MapStudioController }` sites — types are erased at
    build; they cost nothing and can stay.
  - `features/dm/components/map-controls/*` — real value imports
    (`downloadMapDocument`, `MapElementInspector`, `getGridGeometry`, …).
    Check whether the DM controls are inside the already-lazy DMMenuContainer
    chunk (`layouts/FloatingPanelsLayout.tsx:26` lazy-loads it). If yes, those
    imports are fine as-is.
- Read `features/map-studio/index.ts` (the barrel). Expected: it re-exports
  both the hook and the components — that's the leak.

**Design (decided):**
1. Split the barrel: `index.ts` keeps ONLY `useMapStudio`, types, and pure
   utilities needed by entry code. Components are imported by path
   (`features/map-studio/components/MapStudioWorkspace`) — never re-exported
   from the barrel.
2. `const MapStudioWorkspace = React.lazy(() => import(".../MapStudioWorkspace"))`
   in `CenterCanvasLayout` and `MobileLayout`, wrapped in
   `<Suspense fallback={null}>` (copy the MapBoard pattern at
   `CenterCanvasLayout.tsx:32` exactly, including its fallback style).
3. CRITICAL CHECK: `useMapStudio` transitively imports `exportMapDocument`
   (for publish) which imports `terrainRender`/`starterTiles`. That keeps a
   few KB in entry — acceptable; do NOT try to sever it in this slice.

**Steps:**
1. Recon; TaskCreate.
2. Make the change (barrel split + two lazy sites). Fix any import fallout
   (`typecheck` will list it).
3. Tests: existing suites cover behavior. Add nothing unless a test breaks on
   the Suspense boundary — if `MapStudioWorkspace.test.tsx` renders the
   workspace directly (it does, by direct import) it is unaffected.
4. Verify the split materially:
   ```powershell
   pnpm --filter herobyte-client build
   # the editor's cyan grid string must LEAVE the entry chunk:
   Get-ChildItem apps/client/dist/assets/*.js | % { if ((Get-Content $_ -Raw) -match "127,214,255") { $_.Name } }
   node apps/client/scripts/check-bundle-size.mjs   # expect a meaningful drop
   ```
   Expect: marker only in a new lazy chunk; entry drops (tens of KB raw).
5. Full ritual. E2E matters most here (map-studio.smoke exercises the lazy
   boundary for real).
6. Self-review the diff; commit:
   `feat: the Forge loads when summoned — Map Studio leaves the entry bundle`.
7. Update the plan doc line about Map Studio laziness; note the new entry size.

**If blocked:** if the barrel split cascades (more than ~15 files needing
import fixes), stop — commit nothing, log the import graph you found in the
Attempt log, and move to R5a; this slice is valuable but not on R5's critical
path.

---

## 3. Slice R5a — Publish carries terrain (protocol) — DONE ✅

Shipped (commit on `dev`; adversarial review clean, one contested opacity
finding fixed). The design below is preserved as the record of what landed;
R5b (§4) consumes it. **Actual shipped shape (use these, not the sketch):**

- Shared (`packages/shared/src/index.ts`): `MapPublishBackgroundMode =
  "full" | "elements-only"`; `MapTerrainSnapshot = { terrain: TerrainMap;
  grid: { size, offsetX, offsetY }; opacity: number }` (opacity REQUIRED —
  the terrain layer's baked opacity, applied at the table as globalAlpha);
  `RoomSnapshot.mapTerrain?`; publish message gains `backgroundMode?`.
- Server: `deriveMapTerrain` in `apps/server/src/ws/handlers/
  MapStudioMessageHandler.ts` — server-derived from its stored document
  ONLY (never client-trusted), `structuredClone`d point-in-time, undefined
  unless `elements-only` + non-empty + visible terrain layer. Passed through
  `toSnapshot` (both roles — terrain is visible art), persisted in
  `StatePersistence` (save list + load map) and `SnapshotLoader`.
- Client: `renderMapDocumentSvg(doc, uploads?, { omitTerrain, omitGrid,
  transparentBackground })` + same options on
  `createMapDocumentSvgDataUrlWithAssets`; `publishDocument(bg, docId?,
  backgroundMode?)`. **The real publish flow (`useStudioPublish.ts`) still
  sends full-render backgrounds — R5b flips it to elements-only.**

Below is the original decided design (historical; the shipped shape above
wins where they differ):

**Preconditions:** none besides frontier. Slice L merged is nice-to-have.

**Recon (expected findings — verify):**
- `packages/shared/src/index.ts:528` — publish message is
  `{ t: "map-studio-publish"; documentId: string; background: string }`.
- `packages/shared/src/index.ts:329,340` — snapshot has `mapBackground?:
  string` and `compiledScene?: CompiledScene`.
- Map Studio documents are stored SERVER-side (`map-studio-list/get/command`
  messages; `apps/server/src/domains/map/service.ts` compiles on publish —
  read the publish handler end-to-end). **Expected:** at publish time the
  server has the full `MapDocument`, so the server derives the terrain
  snapshot itself — the client does NOT send terrain.
- `packages/shared/src/terrain.ts` — RLE codec already on the wire (used by
  `paint-terrain`). Reuse its types verbatim.
- Find where the room snapshot is assembled + persisted
  (`domains/__tests__/roomService.test.ts` neighborhood) and confirm optional
  fields flow through persistence (Redis) untouched.
- Check `middleware/validators/mapValidators.ts` +
  `mapStudioValidation.test.ts` — publish validation shape.

**Design (decided — do not re-litigate):**
1. Shared: snapshot gains
   ```ts
   mapTerrain?: {
     terrain: TerrainMap;          // existing RLE type from ./terrain.js
     grid: { size: number; offsetX: number; offsetY: number };
   };
   ```
   Optional field ⇒ old persisted snapshots and old clients are unaffected.
2. Publish message gains an OPTIONAL discriminator from the client:
   `backgroundMode?: "full" | "elements-only"`. New clients send
   `"elements-only"`; the server only attaches `mapTerrain` when the mode says
   the background lacks terrain (prevents double-drawing if an old client
   publishes a full SVG). Absent ⇒ treat as `"full"`.
3. Server publish handler: when mode is `"elements-only"`, copy
   `document.terrain` + grid slice into `state.mapTerrain`; when `"full"` (or
   terrain empty), set `state.mapTerrain = undefined`. Respect the
   terrain-layer visibility rule (hidden terrain layer ⇒ no `mapTerrain`) —
   mirror `renderTerrain`'s check in `exportMapDocument.ts:47`.
4. Client (`exportMapDocument.ts`): `renderMapDocumentSvg` gains an options
   arg `{ omitTerrain?: boolean; transparentBackground?: boolean; omitGrid?: boolean }`.
   The PUBLISH path calls it with all three true; the DOWNLOAD paths call it
   with none (byte-parity untouched — the no-options call must produce
   byte-identical output, pinned by existing tests).
5. Publish size guard: keep `backgroundExceedsPublishLimit`; add the encoded
   `mapTerrain` size into the check (the whole WS message must clear the 1MB
   silent-drop cap).

**Steps (tests first):**
1. Shared: add the type; **rebuild shared** (`pnpm --filter "@herobyte/shared" build`).
2. Server tests FIRST (contract style):
   - publish with `backgroundMode: "elements-only"` on a doc with painted
     terrain ⇒ broadcast snapshot has `mapTerrain` with the doc's RLE + grid.
   - publish with mode absent ⇒ `mapTerrain` undefined (back-compat).
   - hidden terrain layer ⇒ `mapTerrain` undefined.
   - re-publish of a full-mode doc CLEARS a previously set `mapTerrain`.
   - validator: mode value outside the enum rejected.
   Run → red. Implement handler + validator → green.
3. Client tests: `exportMapDocument.test.ts` — ADD (never edit existing):
   - options render omits `data-terrain`, background rect, and grid pattern;
   - no-options render byte-equals the pre-change output (the existing
     goldens already enforce this — just run them);
   - publish flow (`useMapStudio` or wherever `map-studio-publish` is sent —
     grep `"map-studio-publish"` in client) sends `backgroundMode:
     "elements-only"` and an SVG without `data-terrain`.
4. Full ritual (shared build first!).
5. **Adversarial review (REQUIRED — protocol).** Lenses:
   - `protocol-compat`: old client→new server, new client→old server, old
     persisted snapshots rehydrated from Redis, player-safety of the new field
     (is `mapTerrain` stripped for players? It should NOT be — terrain is
     visible art — but confirm nothing secret can ride in it), size-cap
     bypasses, validator gaps (malformed RLE from a hostile DM client — the
     server derives terrain from ITS document, so client-supplied terrain must
     never be trusted; confirm none is accepted).
   - `state-lifecycle`: re-publish, room reset, scene un-publish, snapshot
     broadcast fan-out, Redis round-trip of the new field.
6. Fix confirmed findings → re-run ritual → commit:
   `feat: terrain rides the wire — publish sends data, not pixels`.

**If blocked:** if recon shows the server does NOT hold the document at
publish (contradicting expected finding), fall back to: client sends
`terrain + grid` in the publish message, server validates it against the
stored document if available, size-guarded. That is strictly worse (trust +
size) — write up why before choosing it, and keep the review lens on
validation of client-supplied RLE.

---

## 4. Slice R5b — Live table draws terrain through the core — DONE ✅

Shipped (commit on `dev`; focused rendering review run — 2 confirmed findings
fixed, see below; browser-smoked: painted water + atlas grass render at the
table under the elements-only transparent background). **Actual shipped shape
(use these, not the sketch):**

- `features/map/components/TerrainLayer.tsx` (new, ~130 LOC): renders
  `snapshot.mapTerrain` under `MapImageLayer` inside MapBoard's background
  `<Layer>`, gated on `snapshot?.mapTerrain`. Two nested `<Group>` apply cam +
  `mapObject.transform` (mirrors `MapImageLayer`). Renders **one `<Shape>` per
  terrain family** (not one shared Shape) — dummy `fill`/`stroke` attrs trip
  Konva's buffer canvas so a terrain-layer `opacity < 1` composites per family
  (flatten-then-fade), matching the editor underlay + SVG export. Geometry memo
  keyed on `JSON.stringify(mapTerrain)` (RLE is compact) and the Shape elements
  memoized, so unrelated snapshot broadcasts (which churn `mapTerrain` identity
  ~60x/sec) do not rebuild geometry or force a background-layer repaint.
- `features/map/components/terrainSceneFunc.ts` (new): pure
  `drawTableTerrain(ctx, layers, atlas, frame, boundaryWidth?)` → `drawTerrain`.
- `features/map-studio/tileAutotiling.ts`: `buildTerrainOnlyOccupancy(terrain)`
  (seeds occupancy from painted cells only — the table has no autotile ELEMENTS).
- `features/map-studio/components/useStudioPublish.ts`: the studio Publish
  button now renders `{ omitTerrain, omitGrid, transparentBackground }` and
  calls `publishDocument(bg, id, "elements-only")`.

**Review-fixed (both confirmed 2/2):** (1) opacity `< 1` was tinting boundary
strokes via per-primitive globalAlpha → per-family Shapes + Konva buffer canvas;
(2) geometry rebuilt + full repaint on every unrelated snapshot → value-keyed
memo + memoized Shape elements.

**Follow-up — DONE ✅ (task_1adf30a1, commit on `dev`):** the SECOND publish
entry point, the DM-menu button (`MapStudioControl.handlePublish` →
`onPublishToLiveMap` → `MapTab.tsx`), now also publishes elements-only. Both
publish buttons carry live terrain. `MapStudioControl` renders with
`{ omitTerrain, omitGrid, transparentBackground }` and threads
`backgroundMode: "elements-only"` (+ `documentId`, enabling the mid-render-switch
guard) through the `onPublishToLiveMap` payload; `MapTab` passes them to
`publishDocument(bg, id, mode)`. Existing `objectContaining` tests stayed green.

Below is the original decided design (historical; the shipped shape above wins
where they differ):

**Preconditions:** R5a merged (it is — §3 DONE).

**FIRST also flip the publish path to elements-only (R5a shipped the
capability but left the switch off):** in `features/map-studio/components/
useStudioPublish.ts`, call `createMapDocumentSvgDataUrlWithAssets(doc, {
omitTerrain: true, omitGrid: true, transparentBackground: true })` and
`publishDocument(background, doc.id, "elements-only")`. Add a
`useStudioPublish` test asserting the mode + that the background lacks
`data-terrain`. Without this flip, `snapshot.mapTerrain` is never populated
and R5b renders nothing — so this is step 0 of R5b, same commit.

**Recon (expected findings — verify):**
- `ui/MapBoard.tsx:506-535`: background `<Layer>` = `MapImageLayer`
  (src = `mapObject?.data.imageUrl ?? snapshot?.mapBackground`), then
  `GridLayer` (the table's OWN grid — different styling from the studio;
  leave it alone), then `DoorsLayer`. Fog/tokens live in later layers ⇒
  anything added to the background layer is automatically under fog. Confirm
  fog layer order.
- Layers receive a `cam` prop — read `MapImageLayer` and `GridLayer`
  (`features/map/components/`) to see exactly how `cam` (and the optional
  `mapObject.transform`) are applied (expected: a Konva `Group`/props with
  x/y/scale). The terrain layer must apply BOTH the same way, or terrain will
  misalign the moment a DM moves/scales the map in transform mode.
- `ui/__tests__/MapBoard.test.tsx` — the konva mock renders divs with a props
  array. `sceneFunc` bodies do NOT run in unit tests.
- MapBoard is 660 LOC and flagged — you may not grow it more than ~10 lines.

**Design (decided):**
1. New file `apps/client/src/features/map/components/TerrainLayer.tsx`
   (< 200 LOC):
   - Props: `{ cam, mapTerrain, mapTransform }` (match sibling layer prop
     conventions exactly).
   - Inside: `useTileAtlas()` (the R4a singleton — it is surface-agnostic),
     `useAnimationFrameIndex(4, hasAnimatedFamily)`, and a Konva `Shape` with
     `listening={false}` `perfectDrawEnabled={false}` whose `sceneFunc`
     delegates to an EXTRACTED PURE FUNCTION:
     ```ts
     // features/map/components/terrainSceneFunc.ts (new, pure, ~60 LOC)
     export function drawTableTerrain(
       ctx: TileRenderContext2D,
       layers: StructuredTerrainLayer[],   // memoized from mapTerrain
       atlas: TerrainAtlasSource | null,
       frame: number,
     ): void
     ```
     which calls `drawTerrain(ctx, layers, terrainStyleForFrame, frame,
     undefined, { atlas: atlas ?? undefined })`.
   - Structured layers come from the SAME single source of truth:
     `buildStructuredTerrainLayers(mapTerrain.terrain, mapTerrain.grid,
     occupancyFromTerrainOnly)` — at the table there are no autotile tile
     ELEMENTS, so occupancy = terrain cells seeding themselves. Grep
     `buildTileOccupancy` — it takes a MapDocument; do NOT synthesize a fake
     document. Instead add a tiny exported helper in `tileAutotiling.ts`
     (`buildTerrainOnlyOccupancy(terrain): TileOccupancy`) reusing
     `forEachTerrainCell`, with a unit test proving it matches
     `buildTileOccupancy` on an elements-free document.
   - Konva raw context: `sceneFunc(context, shape)` — use
     `(context as unknown as { _context: CanvasRenderingContext2D })._context`
     (Konva.Context wraps the native ctx; `_context` is the escape hatch —
     comment this).
   - Clock redraw: `useEffect` subscribing via the frame value — when `frame`
     changes, call `shapeRef.current?.getLayer()?.batchDraw()`.
   - **Apply `mapTerrain.opacity`** (R5a carries it, REQUIRED field) as the
     Konva `Shape`'s `opacity` prop (or `ctx.globalAlpha` in the sceneFunc) —
     it is the terrain layer's baked opacity; skipping it makes translucent
     terrain render fully opaque, diverging from the editor/export.
2. MapBoard change (minimal): render `<TerrainLayer …/>` BEFORE
   `MapImageLayer` inside the background Layer, only when
   `snapshot?.mapTerrain` exists. The elements-only background then draws
   above terrain — correct z-order (terrain under elements), fog/tokens above.
3. Do NOT view-cull in v1 at the table (stage transform makes the visible
   rect derivation error-prone; a 100×100 map = 10k drawImage per redraw at
   300ms only while water exists). Add culling ONLY if the perf check in §8
   fails, deriving the world rect from `cam` (`x: -cam.x/cam.scale, …`).

**Steps (tests first):**
1. Unit tests:
   - `terrainSceneFunc.test.ts` with the recording context: atlas path,
     flat-fallback path, frame animation (water fill changes at frame 1),
     empty terrain no-ops.
   - `buildTerrainOnlyOccupancy` equivalence test.
   - `MapBoard.test.tsx` (konva-div mock): snapshot WITH `mapTerrain` renders
     a TerrainLayer div before the MapImageLayer div; snapshot without it
     renders none (back-compat).
2. Implement.
3. Full ritual.
4. Manual smoke (REQUIRED for this slice — pixels matter): use the repo's
   `.claude/launch.json` (server 8787, client 5174) or
   `pnpm --filter vtt-server dev` + `pnpm --filter herobyte-client dev`.
   Login password `Fun1`; elevate to DM in the browser console:
   `window.__HERO_BYTE_E2E__.sendMessage({ t: "elevate-to-dm", dmPassword: "FunDM" })`.
   NOTE: the app renders its MOBILE layout below a width threshold and the
   preview harness has shown a zero-size-viewport bug — if the DM MENU button
   is missing, you are in mobile layout; use a real browser window ≥1280px.
   Paint water + grass in the studio, publish, confirm at the table: textures
   visible, water shimmering, tokens/fog above, map transform drag keeps
   terrain glued to the background.
5. Focused review (rendering): lenses `table-parity` (z-order vs fog/drawings,
   cam + mapTransform alignment, reduced-motion freeze, back-compat snapshots)
   and `perf-lifecycle` (batchDraw storms, unsubscribe leaks, redraw on every
   snapshot broadcast?).
6. Commit: `feat: the table joins the cartridge — live terrain and shimmering
   water through the shared core`.

---

## 5. Slice R4b — Raster export composites through the core

**Goal:** PNG/WebP download (and the export preview) show atlas-textured
terrain. SVG download stays flat-color BY DESIGN (portable, byte-stable,
documented) — do not embed the atlas into SVG.

**Preconditions:** R5a merged (needs `renderMapDocumentSvg` options).
Independent of R5b.

**Design (decided):**
1. `rasterizeMapDocument` (exportMapDocument.ts:146) currently draws the full
   SVG onto a canvas. Change it to compose exactly like the editor underlay:
   - canvas sized to the document;
   - fill `#24212b`; draw grid via `gridRenderCore.drawGrid` (export style =
     defaults) if `grid.visible`; draw terrain via `drawTerrain` at frame 0
     with the atlas (await `loadTileAtlas()`; null ⇒ flat fills — export must
     never fail on a missing atlas);
   - then `drawImage` the SVG rendered with
     `{ omitTerrain: true, transparentBackground: true, omitGrid: true }` on
     top (elements only).
2. The default SVG download path stays exactly as today (goldens keep it
   honest).
3. Structured layers for the raster: reuse `buildStructuredTerrainLayers` +
   `buildTileOccupancy(document)` — the FULL occupancy this time (documents
   can contain autotile tile elements; the upload-exclusion fix `73dc254d`
   already handles image tiles).

**Steps:** tests first in `exportMapDocument.test.ts` (ADD only):
- rasterize draws terrain fills/atlas calls BEFORE `drawImage` of the SVG
  (spy `getContext` with the recording context — precedent at line ~377);
- rasterize of a doc without terrain behaves as before;
- atlas-load failure falls back to flat fills (stub `fetch` to 404).
Then implement → ritual → focused review lens `export-surface`
(z/grid/terrain order vs the live editor, publish path untouched, no
regression to `createMapDocumentSvgDataUrl`) → commit:
`feat: raster exports inherit the cartridge — atlas terrain in PNG/WebP`.

**Trap:** `rasterizeMapDocument` runs in the browser (window.Image). The
atlas loader is also browser-only — fine. Keep everything async-guarded so a
test env without fetch falls back silently.

---

## 6. Slice S — /assets rate limit + body cap (chip task_f3d374a0) [REVIEW REQUIRED]

**Goal:** POST /assets gets (a) a per-client rate limit and (b) a streaming
body cap that aborts oversized uploads mid-flight instead of buffering them.

**Recon:** `apps/server/src/http/routes.ts` (Hono), `domains/assets/*`, how
auth (room secret) is checked, existing size checks (expected: a post-buffer
length check exists; the gap is stream-time enforcement + request rate).

**Design (decided):**
1. Body cap: enforce BEFORE buffering — reject on `content-length` header >
   cap when present; otherwise read the stream chunk-wise and abort (413) the
   moment the running total exceeds the cap. Cap = existing max asset size
   (find the constant; do not invent a new number).
2. Rate limit: fixed-window or token bucket PER ROOM SECRET (uploads are
   authenticated by room secret — keying by IP breaks shared-NAT parties),
   e.g. 30 uploads/min with a small burst. In-memory Map with periodic sweep
   is fine (single-process server today); note Redis migration in a comment.
   429 with `retry-after`.
3. No new dependencies (pnpm trap!) — hand-roll the bucket (~30 LOC).

**Steps:** contract tests first (fake requests through the Hono app — find
the existing /assets tests and extend): oversized content-length ⇒ 413 before
body read; chunked body exceeding cap ⇒ aborted 413; burst beyond limit ⇒ 429
then recovers after window; distinct rooms don't share buckets. Implement →
ritual → **adversarial review (REQUIRED — security)**, lenses `bypass`
(header spoofing, chunked-encoding tricks, cap off-by-one, secret-less paths,
GET untouched?) and `dos-resource` (memory growth of the bucket map, sweep
correctness, does the abort actually free the stream?). Commit:
`fix: the asset door gets a bouncer — rate limit and streaming cap on /assets`.

---

## 7. Slice R4c-prep — 47-blob quarter-tile math (OPTIONAL, art-blocked)

Only if time remains. The ART does not exist (no corner/edge quarter tiles;
also `path` variants need curation — two are transition tiles, one has a
baked-in frame border). Land the software so art drops in later:

1. Pure function in a new `features/render/blobAutotile.ts`:
   `quarterTileVariant(neighbors: 8-bit mask, corner: "tl"|"tr"|"bl"|"br") →
   0..4` implementing the standard 47-blob quarter-tile reduction (each corner
   quarter is decided by its two adjacent edges + diagonal). Exhaustive
   table-driven tests (all 256 masks × 4 corners — assert against a hand-built
   reference table for the 47 canonical classes; cite the class list in the
   test).
2. Manifest schema: optional `families[id].blob47: { col, row }` origin of a
   quarter-tile sheet region; `tileAtlas.tileForCell` untouched; new
   `quarterRectsForCell(assetId, cellX, cellY, neighborMask)` returning 4
   sub-rects or null.
3. Core: `drawTerrain` uses quarter rects when the atlas provides them
   (4 drawImages per cell), else the R4a whole-tile path. Feature is inert
   until a manifest ships `blob47` — zero behavior change, prove it with the
   existing test suite untouched.
4. Neighbor mask source: occupancy — same-family test on the 8 neighbors,
   computed in `buildStructuredTerrainLayers` and carried on the cell
   (`neighborMask: number`) — additive field, byte-parity unaffected
   (goldens prove it).

Commit: `feat: 47-blob autotile math — the sockets are wired, awaiting art`.

---

## 8. M3 exit checklist & wrap-up duties (end of the day)

- [ ] **Tavern test:** in a real browser, build a tavern from bundled assets
      only (wood/stone floors, walls, tables, crates, water feature). Publish.
      Screenshot both surfaces. This is the roadmap's own exit criterion —
      judge it honestly and file chips for what looks bad (expected gaps:
      structures/objects still flat-color swatches; path variant curation).
- [ ] **100×100 perf:** paint a 100×100 map (scatter or room-fill big areas),
      pan/zoom in the editor and at the table on the dev machine. Editor
      redraw and table shimmer must feel smooth (~60fps interaction; the
      300ms shimmer redraw must not hitch). If it hitches: editor already
      culls; table culling is the designed follow-up (see R5b §design.3).
- [ ] **Bundle guard** after all slices: expect ≤ ~90KB entry WITH Slice L
      landed (a large drop from 87KB pre-split because the editor leaves,
      then table terrain code adds a little to the MapBoard lazy chunk).
- [ ] **Open questions for the owner** (do not resolve unilaterally):
      tileset provenance/license (manifest says UNSPECIFIED — blocks any
      public release), pnpm store reconciliation (v10 vs v11), whether SVG
      download should eventually embed textures (currently: documented no).
- [ ] Update `shared-tile-renderer-plan.md` statuses + this file's table.
- [ ] Update project memory frontier (if the session has memory) with commit
      hashes; keep `MEMORY.md` index lines intact.

## 9. Attempt log

(append entries here: date, slice, what was tried, outcome, blocking output)
