# Slice 4 Handoff — publish → first-class image map [PROTOCOL/SECURITY]

Written 2026-07-07 by the session that shipped Slices 2b + 3 (procedural terrain
in the editor and in raster export). You are executing **Slice 4** of the
procedural-terrain rework in `D:\HeroByte` (branch `dev`, Windows/PowerShell; a
Bash tool is also available). This is the workflow-unification the owner wants —
and the first slice this arc that touches `packages/shared` + the server, so it
is **protocol/security** and its safety net is different from 2b/3. Read this
whole file, then stop exploring: the context index in §4 has every `file:line`
you need (verified 2026-07-07 by a 5-agent recon sweep).

---

## 0. Bootstrap — do in this order, then STOP exploring

1. **`docs/planning/renderer-endgame-playbook.md` §0 IN FULL** — Fable 5's
   binding method: the slice loop (§0.2), the verbatim verify ritual (§0.3), the
   ADVERSARIAL REVIEW workflow (§0.4), hard invariants/traps (§0.5), conventions
   (§0.6), failure modes F1–F12 (§0.7). It is BINDING. §1 below only highlights
   what's *different* for a protocol slice.
2. **This file.** The plan (§3), the context index (§4), the review workflow
   (§5), gotchas (§6), kickoff (§7).
3. **`docs/planning/procedural-terrain-handoff.md`** — the arc's general handoff;
   its §2 lists the DONE API surface (proceduralTerrain / proceduralTerrainSurface
   / rasterUnderlay) you'll reuse. Its §4 Slice 4 sketch is SUPERSEDED by this doc.
4. Project memory `dirt-path-transitions-direction` (auto-loaded) — the one-para why.
5. `git log --oneline -6`; confirm `200871d4` (Slice 2b), `e1691696` (Slice 3),
   `5eb79795` (docs) are on `dev`.

Do NOT re-read the whole render/publish tree — §4 is the map.

---

## 1. Fable 5's method — what's DIFFERENT for this protocol slice

Everything in playbook §0 still binds. The deltas from the 2b/3 client-only slices:

- **The FULL verify ritual (§0.3), not the client-only subset.** You edit
  `packages/shared` + the server, so:
  - **Rebuild shared FIRST after any shared edit:** `pnpm --filter "@herobyte/shared" build`
    (the stale-dist trap — server/client import `dist`, not `src`; §0.5).
  - **Server tests are back in:** `pnpm --filter vtt-server test -- <path>` (targeted)
    and the full `pnpm test` covers server too.
  - Order: shared build → targeted client+server tests → `pnpm --filter herobyte-client typecheck`
    → `eslint --fix` changed files → `pnpm lint` (root: shared+server+client prettier
    + frozen gate) → `pnpm lint:structure:enforce` → `pnpm test` → `pnpm test:e2e`
    → `pnpm --filter herobyte-client build` + `node apps/client/scripts/check-bundle-size.mjs`.
- **Adversarial review is REQUIRED (full), not optional.** §0.4. Protocol/security
  slices do NOT land on `dev` without it. Run the §5 workflow AFTER the suites pass
  (NEVER run `pnpm test` while a Workflow is live — F6). Fix every 2/2-confirmed
  finding, re-run the ritual from the failing gate, then review the diff again.
- **Owner sign-off before commit.** Per the R5a/S kickoff rule: because the failure
  modes are silent + persistent, STOP before committing, post the full `git diff`
  summary + the review verdicts + the gate results, and let the OWNER read it and
  say "commit". Do not self-land a protocol slice. (The owner has been eyeballing
  every visible slice this arc; keep that.)
- **The load-bearing invariant here is the 1MB WS cap** (§6). And **server-derived-
  only**: the client may supply the raster *bitmap* (cosmetic art), but grid/scale/
  dimensions must be recomputed server-side from the stored MapDocument, never
  trusted off the wire (mirror `deriveMapTerrain`).
- **Player-safety** (§0.5): the published raster becomes `mapBackground`, broadcast
  to ALL clients UNFILTERED. Prove no secret/DM-only pixels bake in (§6).
- Conventions/commit/trailers unchanged (§0.6): `Co-Authored-By: Claude Fable 5`
  + your own model. Explicit staging only (never `git add -A`); bystanders that must
  NEVER be staged: `.agents/AGENTS.md`, `.gitignore`, `assets/images/{Inspiration,logo}`,
  `temp/`. (`.claude/` is gitignored.)

---

## 2. The big picture — most of the image-map stack ALREADY EXISTS

The recon's key finding: **a published map already becomes a manipulable "map"
scene object today.** The chain that already works:

`map-studio-publish` handler sets `state.mapBackground` → `SceneGraphBuilder.buildMapObject`
derives a `type:"map"` SceneObject (`imageUrl = mapBackground`, **preserving** the
previous `transform`/`locked`/`zIndex`) → the table's `MapImageLayer` renders it
with camera + `mapObject.transform` → the DM's `MapTransformControl` (scale/move/
rotate/lock), `GridAlignmentWizard` (grid-match), and the `transform-object`
message already drive it. **All of scale/move/grid-match/lock/relock is FREE** for
anything that lands in `mapBackground` as a map object.

So Slice 4 is NOT "build an image-map system." It is:
1. **Swap the publish producer**: rasterise the map to a **full, opaque PNG**
   (terrain baked in — reuse `rasterizeMapDocument`, already shipped) instead of the
   current `elements-only` transparent SVG. Use `backgroundMode: "full"`; **stop
   attaching `mapTerrain`** so the table doesn't double-draw (live terrain under +
   baked-in). This *supersedes R5a/R5b live-terrain-on-the-wire for tile maps* —
   keep the `MapTerrainSnapshot` type + the table's `TerrainLayer` for legacy/back-compat.
2. **Solve the 1MB inbound cap** (§3 — the one real decision).
3. **Player-safety + grid-match + transform-reset** loose ends (§6).

---

## 3. The plan + the one design fork (confirm with the owner FIRST)

### THE decision: inline data-url vs upload-by-reference
A full-map PNG will **routinely exceed the 1MB inbound WS cap** (§6). Two paths:

- **(A) Inline data-url** — put the PNG data-url in the existing
  `map-studio-publish.background` string. Minimal protocol change (reuses the field),
  but oversize maps are **rejected by `backgroundExceedsPublishLimit` (~1MB) or
  silently dropped** by the server. Fine only if maps stay small. Fragile.
- **(B) Upload-by-reference (RECOMMENDED)** — upload the rasterised Blob to the
  EXISTING content-addressed `/assets` HTTP endpoint (`uploadAssetFile`, 5MB cap,
  same-origin, png/webp accepted), then publish the returned **URL reference**
  (`uploadedAssetUrl(hash)`) in `background`. The WS message stays tiny; the 1MB cap
  stops mattering; same-origin avoids the Konva canvas-taint that a cross-origin asset
  would cause (`MapImageLayer` passes no `crossOrigin`). No new wire message needed —
  `background` just carries a URL instead of bytes; the server stores it in
  `mapBackground` exactly as today.

**Recommendation: (B).** It reuses shipped infrastructure (`rasterizeMapDocument` →
`uploadAssetFile` → `uploadedAssetUrl`), dodges the cap by construction, and keeps the
protocol change minimal (the server still just stores a string). **Confirm with the
owner before coding** — it's their protocol call, and it decides the whole slice shape.
The one server-side follow-up (B) raises: content-addressed raster assets are never
garbage-collected on re-publish — flag a lifecycle answer for the review.

### Decided steps (assuming (B); RED-first per §0.2)
1. **Recon** only §4 files. `TaskCreate` the steps.
2. **Client producer** (`useStudioPublish.ts` + `MapStudioControl.tsx`, the two send
   sites; both funnel through `publishDocument` in `useMapStudio.ts`):
   - `rasterizeMapDocument(document, "image/png")` → Blob (wrap `new File([blob], name, {type})`).
   - `uploadAssetFile(file, credentials)` → `{hash,url}`. Thread `uploadAsset` (already on
     the controller, `useMapStudio.ts:89`) into both publish components (neither has it today).
   - `publishDocument(uploadedAssetUrl(hash), documentId, "full")`. Carry grid dims from
     BOTH callers (only the DM-menu path sends `gridSize` today).
   - Handle the no-credentials / upload-failure path gracefully (upload throws without a room).
3. **Shared** (`packages/shared/src/index.ts`): the `map-studio-publish` message shape is
   unchanged if `background` stays a string; confirm `backgroundMode:"full"` semantics are
   documented; **rebuild shared**. (Only add fields if you must persist grid-match/opacity —
   `MapSceneData` lacks them.)
4. **Server** (`MapStudioMessageHandler.ts`): on `"full"` mode, set `state.mapBackground =
   message.background` (the URL) and **do NOT** attach `mapTerrain`. Keep `compiledScene`.
   Re-derive grid/dimensions from the server document (server-derived-only). `buildMapObject`
   already turns it into the map object — verify transform-preservation vs. new-map-reset.
5. **Table**: NO render change expected (`MapImageLayer` already handles a URL map object).
   Add a `MapBoard.test.tsx` case (extend the `useSceneObjectsData` mock to return a
   `mapObject` with `data.imageUrl`) asserting the published bitmap renders as the image-map
   and that `TerrainLayer` does NOT also draw when terrain is baked in.
6. **Persistence**: if you add any new field, thread it through ALL THREE sites
   (`StatePersistence.saveToDisk` + `loadFromDisk` + `SnapshotLoader.mergeSnapshot`).
7. **Full ritual** (§1) → **REQUIRED full review** (§5) → fix 2/2 → re-ritual →
   **STOP, owner reads the diff + verdicts, owner says commit** → commit to `dev`.
8. **Manual smoke** (REQUIRED — pixels + wire): publish a painted tile-map, confirm at the
   table it renders as an image map, the DM can scale/move/grid-match/lock/relock it, terrain
   is NOT double-drawn, and the WS publish message is small (upload path). Reduced motion N/A
   (raster is static). Note: DM MENU is hidden below ~1280px (mobile layout) — use a wide window.

**If recon contradicts an expectation** (e.g. `buildMapObject` no longer preserves transform):
STOP, re-plan, and if it changes protocol/safety, ask the owner (§0.10).

---

## 4. Context index — verified `file:line` (2026-07-07). Read targeted ranges, don't search.

### Shared protocol — `packages/shared/src/index.ts` (602 LOC; grep + targeted reads; REBUILD after edits)
- `:555-560` **`map-studio-publish`** msg `{ documentId; background:string; backgroundMode? }` — `background` is the inline field (the 1MB-risk one).
- `:440` **`ClientMessagePayload`** union head (add a new client→server msg here only if you go beyond a string `background`).
- `:531` `map-background` msg `{ data:string }`; `:576` **`transform-object`** `{ id; position?; scale?; rotation?; locked? }` — id `"map"`; THE scale/move/lock/relock message.
- `:348-371` **`RoomSnapshot`**: `mapBackground?:string @355` (flat, no transform), `compiledScene? @366`, `mapTerrain? @367`, `assets? @369`, `assetRefs? @370`.
- `:329` `MapPublishBackgroundMode = "full" | "elements-only"` (absent==full, legacy).
- `:337-346` `MapTerrainSnapshot` (R5a live terrain — superseded for tile maps; keep the type).
- `:310-321` `SnapshotAsset`/`SnapshotAssetType` (incl `"map-background"`)/`SnapshotAssetRefs` — content-addressed dehydration (server→client only).
- `:57-116` `SceneObjectTransform{x,y,scaleX,scaleY,rotation}:57` · `SceneObjectBase{transform,locked?,zIndex}:65` · `MapSceneData{imageUrl?,width?,height?}:74` · `SceneObject` "map" variant `:111`. **This is the model to reuse.**
- `terrain.ts:16` `TerrainMap` (schemaVersion:1, golden-tested — don't touch the wire format). `sceneCompiler.ts:47` `CompiledScene` (unaffected). Barrel re-exports `:27/:32/:45`. `package.json:8` build (`tsc -b --force`).

### Server — `apps/server/src`
- `ws/connectionHandler.ts:67` **`maxMessageSize: 1MB`** (THE inbound cap) → `ws/message/MessagePipelineManager.ts:143` `checkMessageSize` (drops >1MB BEFORE validate/parse; silent to sender).
- `middleware/validation.ts:196` validator-table entry (exhaustive over `ClientMessage['t']` — new msg = compile error until registered).
- `middleware/validators/mapStudioValidators.ts:310` `validateMapStudioPublishMessage` (`background` max 10MB @316 — **unreachable** under the 1MB cap); `constants.ts:13` `PAYLOAD_LIMITS.MAP_SIZE=10MB`.
- `ws/handlers/MapStudioMessageHandler.ts:85` **publish handler** (isDM@38; `state.mapBackground=message.background @90`, `mapTerrain @91`, `gridSize/gridSquareSize @92-93`, `compiledScene=compileScene(document) @94`, returns `{broadcast,save} @95`); `:143` `deriveMapTerrain` (server-derived-only pattern to copy).
- `domains/room/model.ts:39` `RoomState.mapBackground`/`compiledScene@52`/`mapTerrain@53`; `toSnapshot@136` (role-filters compiledScene @292-317; mapTerrain rides all roles @321-323; `buildSnapshotAssets(state)@271`).
- `domains/room/scene/SceneGraphBuilder.ts:71` **`buildMapObject`** (THE BRIDGE — derives the "map" object from `mapBackground`; `imageUrl=mapBackground @89`; **preserves** prev `transform/locked/zIndex @85-87`).
- `domains/room/assets/SnapshotAssetBuilder.ts:19` `buildSnapshotAssets` (mapBackground→content-addressed asset, sha1-dedup, still inlined per snapshot).
- `domains/room/service.ts:18` `SNAPSHOT_SIZE_LIMIT_BYTES=750KB` (warn-only, no drop); broadcast@175, saveState@213.
- `domains/room/transform/TransformHandler.ts:99` `applyMapTransform` (DM-only@104; lock DM-only@60-64) — secure, reuse as-is.
- **Persistence (THREE sites)**: `persistence/StatePersistence.ts` saveToDisk `mapBackground@167`/loadFromDisk `@99`; `snapshot/SnapshotLoader.ts:33` `mergeSnapshot` (`resolveMapBackground @148-161` handles inline string AND `assetRefs['map-background']`).
- `ws/services/RouteResultHandler.ts:121` turns handler `{broadcast,save}` into broadcast+persist.
- Tests to copy: `ws/handlers/__tests__/MapStudioMessageHandler.test.ts:185` (handler; broadcast+save @227; point-in-time derive test @326-339); `middleware/__tests__/mapStudioValidation.test.ts:21` (validator valid/reject).

### Client publish + assets — `apps/client/src`
- `features/map-studio/useMapStudio.ts:72` **`publishDocument`** (THE wire send @77-83); `:89` `uploadAsset(file)` (controller upload entry, has credentials).
- `features/map-studio/components/useStudioPublish.ts:43` `handlePublish` (**SEND SITE #1**; builds elements-only SVG @51, guard @56, `publishDocument(bg,id,"elements-only")@60`; only receives `publishDocument`).
- `features/dm/components/tab-views/MapTab.tsx:147` `onPublishToLiveMap` (**SEND SITE #2** @152); `features/dm/components/map-controls/MapStudioControl.tsx:85` `handlePublish` (feeds #2; sends `gridSize` via `toLiveGridSize@107,242`; has `controller` but doesn't use `uploadAsset`).
- `features/map-studio/exportMapDocument.ts:167` **`rasterizeMapDocument`** (the bitmap bake — returns Blob, terrain composited in); `:159` `downloadRasterMapDocument`; `:94` `MAX_PUBLISH_BACKGROUND_BYTES` (~1008KB); `:96` `backgroundExceedsPublishLimit`; `:307` `visible()` player-safety element filter.
- `features/map-studio/uploads/assetUpload.ts:87` **`uploadAssetFile`** (POST `/assets`, 5MB cap `MAX_UPLOAD_BYTES@13`, needs creds → throws `no-credentials@92`, takes a **File** not Blob); `:76` `uploadedAssetUrl(hash)`; `:66` `uploadAssetId`; `:70` `uploadHashFromAssetId`; `:23` `clampImageMime`/`ACCEPTED_MIME_TYPES@16` (png+webp OK).
- `features/map-studio/types.ts:111` `publishDocument` signature; `features/map-studio/index.ts:14` barrel (rasterize/guard exported; assetUpload NOT — import from `./uploads/assetUpload`).
- `hooks/useMapActions.ts:60` `setMapBackground` (emits `map-background`); `features/dm/components/map-controls/MapBackgroundControl.tsx:33` `handleMapApply` (image-found-online entry; **NO size guard**).

### Table render + DM controls (reuse — little/no change)
- `ui/MapBoard.tsx:508` background `<Layer>`; `:511` `TerrainLayer` (gated on `snapshot.mapTerrain`, draws UNDER map); `:518-520` `MapImageLayer` (`src = mapObject?.data.imageUrl ?? snapshot?.mapBackground`, `transform=mapObject?.transform`); `:114` `mapObject` via `useSceneObjectsData`; `:415-435` gizmo/selection.
- `features/map/components/MapImageLayer.tsx:32` (78 LOC; `useImage@33` **no crossOrigin@45**; camera Group + transform Group; renders any map object identically).
- `hooks/useSceneObjectsData.ts:40` `mapObject = first sceneObject type==="map"` (publish must REPLACE, not append).
- `features/dm/components/map-controls/MapTransformControl.tsx:53` (scale/rotate/move/lock); `GridAlignmentWizard.tsx:64` (grid-match, disabled when locked@147) → `features/map/useMapAlignment.ts:235` `applyAlignment` (→ transform-object); `hooks/useSceneObjectActions.ts:163` `transformSceneObject`/`:180` `toggleSceneObjectLock`; `layouts/FloatingPanelsLayout.tsx:198` wiring; `MapTab.tsx:136` DM surface.
- Konva mock test pattern: `ui/__tests__/MapBoard.test.tsx:53` (Stage/Layer mocked to testid divs; order via `compareDocumentPosition`); `:100` the `useSceneObjectsData` mock returns NO `mapObject` (extend it for image-map tests).

---

## 5. Adversarial review — REQUIRED (full). Paste-ready (from playbook §0.4/§6).

Run AFTER all suites pass; NEVER run `pnpm test` while it's live (F6). Only 2/2-upheld
findings get fixed; verify each scenario against the code yourself before fixing.

```js
export const meta = { name: 'slice-4-review',
  description: 'Full protocol/security review of publish → first-class image map',
  phases: [{ title: 'Find' }, { title: 'Verify' }] }
const FINDINGS_SCHEMA = { type:'object', required:['findings'], properties:{ findings:{ type:'array',
  items:{ type:'object', required:['title','file','description','failureScenario','severity'],
    properties:{ title:{type:'string'}, file:{type:'string'}, line:{type:'number'},
      description:{type:'string'}, failureScenario:{type:'string'},
      severity:{type:'string', enum:['critical','major','minor']} } } } } }
const VERDICT_SCHEMA = { type:'object', required:['refuted','reasoning'],
  properties:{ refuted:{type:'boolean'}, reasoning:{type:'string'} } }
const CONTEXT = `Repo D:\\HeroByte (Windows). Review the UNCOMMITTED working-tree changes
(git diff HEAD + untracked) for Slice 4: publish rasterises the map to a bitmap that flows to
the table as a first-class image map (map SceneObject), superseding R5a/R5b live-terrain for tile
maps. Files: packages/shared/src/index.ts (rebuild!), apps/server/src/ws/handlers/
MapStudioMessageHandler.ts + validators + persistence, apps/client/src/features/map-studio
(useStudioPublish, MapStudioControl, useMapStudio, exportMapDocument, uploads/assetUpload), table
MapImageLayer/MapBoard. RULES: READ-ONLY. Do NOT run pnpm test/vitest/builds. git + file reads ok.
Report only defects with a concrete failure scenario; no style nits. Unit+e2e already pass.`
const LENSES = [
 { key:'protocol-compat', prompt:`${CONTEXT}\nLENS — protocol back-compat + the 1MB cap:
   old client→new server and new client→old server; backgroundMode undefined==full; a full-map PNG vs
   the 1MB inbound drop (connectionHandler maxMessageSize) — is oversize handled, guarded, or silently
   dropped; if upload-by-reference: the new inbound path, cross-origin canvas taint, asset lifecycle/GC;
   old persisted snapshots + Redis/disk round-trip of any new field through ALL THREE persistence sites.` },
 { key:'player-safety', prompt:`${CONTEXT}\nLENS — player-safety + server-derived-only:
   mapBackground is broadcast UNFILTERED to all clients — does the rasterised bitmap bake ANY secret/DM-only
   art (secret doors live in compiledScene, hidden layers/element.hidden/non-visibleToPlayers text via the
   SVG visible() filter — confirm the raster excludes them)? Is any authoritative geometry (grid/scale/dims)
   trusted from the client instead of re-derived from the server document? Can a hostile DM/client inject a
   malicious URL/data-url as the background?` },
 { key:'state-lifecycle', prompt:`${CONTEXT}\nLENS — state lifecycle + double-draw:
   re-publish (transform preserved vs reset — buildMapObject:85-87), a genuinely new map inheriting an old
   transform, publish must REPLACE not append the map object (useSceneObjectsData picks the first),
   TerrainLayer double-draw if mapTerrain still ships for a baked map, room reset / un-publish, snapshot
   fan-out, the redundant save flag.` } ]
const found = await parallel(LENSES.map((l)=>()=>agent(l.prompt,{label:`find:${l.key}`,phase:'Find',schema:FINDINGS_SCHEMA})))
const findings = found.filter(Boolean).flatMap((r,i)=>r.findings.map((f)=>({...f,lens:LENSES[i].key})))
if (findings.length===0) return { confirmed:[] }
const judged = await parallel(findings.map((f)=>()=>parallel(Array.from({length:2},(_,k)=>()=>
  agent(`${CONTEXT}\nYou are skeptic #${k+1}. A reviewer claims:\nTITLE: ${f.title}\nFILE: ${f.file}\nCLAIM: ${f.description}\nSCENARIO: ${f.failureScenario}\nRead the code and try to REFUTE concretely. If it cannot occur, is pre-existing, or has no user-visible/invariant consequence, refuted=true. Default refuted=true if uncertain.`,
    {label:`verify:${f.title.slice(0,30)}`,phase:'Verify',schema:VERDICT_SCHEMA})))
  .then((v)=>({...f, upheld:v.filter(Boolean).filter((x)=>!x.refuted).length}))))
return { confirmed: judged.filter((f)=>f.upheld===2), contested: judged.filter((f)=>f.upheld===1),
         refuted: judged.filter((f)=>f.upheld===0).map((f)=>f.title) }
```

---

## 6. Gotchas this recon surfaced (save yourself the time)

- **The 1MB cap is the whole ballgame.** `connectionHandler.ts:67` drops any inbound WS
  message >1MB at `MessagePipelineManager.ts:143` BEFORE the validator runs — silent to the
  sender. The validator's 10MB `background` ceiling (`mapStudioValidators.ts:316`) is dead code.
  A full-map PNG data-url routinely exceeds 1MB. This is why §3 recommends upload-by-reference.
- **The map object is DERIVED, not sent.** No "set map object" message — `buildMapObject`
  rebuilds it from `mapBackground` every broadcast. Set `mapBackground` and the transform/lock/
  grid-match plumbing attaches automatically. Corollary: **transform/locked are PRESERVED across
  background changes** (`SceneGraphBuilder.ts:85-87`) — great for re-publish/relock, but a brand-new
  map silently inherits the old map's scale/position unless Slice 4 resets it.
- **`mapObject.data.imageUrl` WINS over `snapshot.mapBackground`** at the table
  (`MapBoard.tsx:520`). Route the bitmap through the map object (it already is, via buildMapObject).
- **Terrain double-draw**: if the raster bakes terrain in, the server must STOP shipping
  `snapshot.mapTerrain` for that map, or `TerrainLayer` (`MapBoard.tsx:511`) draws terrain twice
  (live under-layer + baked-in image). Keep the `mapTerrain` block for legacy/back-compat only.
- **Triple persistence**: any new field must be threaded through `StatePersistence.saveToDisk`
  AND `loadFromDisk` AND `SnapshotLoader.mergeSnapshot` or it survives live but dies on restart/reload.
- **Player-safety**: `mapBackground` is broadcast UNFILTERED (unlike `compiledScene`, which strips
  secret doors per role). The SVG `visible()` filter (`exportMapDocument.ts:307`) already drops hidden
  layers / `element.hidden` / non-visibleToPlayers text — but secret-door state lives in `compiledScene`,
  not the SVG. Confirm `rasterizeMapDocument` bakes ONLY player-visible art.
- **Two publish callers, one send site.** Both `useStudioPublish` and `MapStudioControl` funnel through
  `publishDocument` (`useMapStudio.ts:72`), but they build the background + pre-flight guard separately,
  and only the DM-menu path sends `gridSize`. Change both. Neither has `uploadAsset` wired in yet.
- **`uploadAssetFile` takes a `File`, not a `Blob`; needs room credentials.** Wrap the rasterize Blob
  (`new File([blob], name, {type})`); handle the no-credentials throw (`assetUpload.ts:92`).
- **`MapImageLayer` passes no `crossOrigin`** (`:33`) — a cross-origin asset renders but taints the
  Konva canvas (blocks future pixel reads/export). Serve published assets same-origin.
- **Rebuild `@herobyte/shared` after ANY shared edit** (`tsc -b --force`) or server/client see stale dist.
- **The `MapBoard.test.tsx` `useSceneObjectsData` mock returns NO `mapObject`** (`:100`) — no existing
  test exercises the image-map path. New tests must extend it.

---

## 7. One-line kickoff (owner pastes to start the Slice 4 session)

> You are executing **Slice 4** (publish → first-class image map) of the procedural-terrain rework in
> `D:\HeroByte` (branch `dev`). Read `docs/planning/renderer-endgame-playbook.md` §0 IN FULL, then
> `docs/planning/slice-4-handoff.md` IN FULL, then begin from its §3. Binding rules: one slice this
> session; this is PROTOCOL/SECURITY — the FULL verify ritual (rebuild `@herobyte/shared` first, run
> server tests), the **REQUIRED full adversarial review** (§5), RED-first tests, explicit staging only
> (never `git add -A`), never `pnpm add/install`, keep files <350 LOC and the SVG frozen goldens
> byte-identical. FIRST confirm the §3 design fork (inline vs upload-by-reference) with the owner before
> coding. STOP before committing: post the full `git diff` summary, the review verdicts, and the gate
> results, and let the owner read and say "commit" — protocol slices do not land on `dev` without owner eyes.
