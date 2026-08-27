# Prompt — walls, doors, lights, text and splines become selectable

Five of the eight element kinds cannot be selected, so they cannot be deleted — on a phone or at a
desktop. Place a wall slightly wrong, keep building, and it is permanent: Undo is the only way
back, and only until you make another edit. The user guide currently documents this as a
limitation rather than a bug.

Nobody had it on a list. It surfaced on 2026-08-26 when an e2e spec tried to delete a wall and
could not, and was verified from the code the same day.

**Owner decisions (2026-08-26), already made — do not re-litigate:**

- **Extend Select by proximity**, rather than an eraser tool or a layers list. Everything
  downstream then works for free: the desktop Inspector, the mobile Select panel, DELETE, on both
  platforms, with no new tool and no new UI.
- **Tolerance is half a grid cell, in DOCUMENT units** — zoom-independent, so it feels the same
  whether zoomed in or out, and forgiving without grabbing a neighbouring wall in a tight corridor.

---

## 0. Orient

```bash
git log --oneline -3                       # expect 6a605af4 (production) or later
git status --porcelain | grep -v 'temp/'   # expect empty (unanchored 'temp/' — quoted names)
```

Read before writing anything:

1. `apps/client/src/features/map-edit/elementHitTest.ts` (99 lines, whole file) — what you extend.
2. `packages/shared/src/sceneCompiler.ts:76-90` and `:179-192` — how a wall's geometry is REALLY
   computed. This is the load-bearing fact (§1.1).
3. `apps/client/src/features/map-edit/MapEditPreviewLayer.tsx:118-137` — the highlight, which is a
   `<Rect>` and cannot outline a line.
4. HANDOFF-NEXT.md §2 (the gate) and §8 (method).

---

## 1. The facts this slice turns on

### 1.1 Element points are LOCAL, and the compiler already knows the transform

`MapWallElement.data.points` and `MapSplineElement.data.points` are **transform-relative**, not
document coordinates. `sceneCompiler.ts:77-79` maps every wall point through `toWorld(transform,
x, y)` before it becomes a wall segment, and `toWorld` (`:179-192`) applies scale, then rotation,
then translation:

```ts
const scaledX = localX * transform.scaleX;
const scaledY = localY * transform.scaleY;
const radians = (transform.rotation * Math.PI) / 180;
x: transform.x + scaledX * cos - scaledY * sin,
y: transform.y + scaledX * sin + scaledY * cos,
```

**`toWorld` is currently NOT exported.** Export it rather than re-deriving the same math in the
hit test. Two copies is how the hit test and the renderer end up disagreeing about where a wall
is — a selection outline drawn a few pixels off the wall it claims to be selecting, which reads as
a rendering bug and is really a second definition of the truth. This repo has paid for that class
of drift before (see `mapEditFamilies.ts`'s header on hand-kept lists).

It is a function on a sub-module already re-exported by the barrel (`export * from
"./sceneCompiler.js"`), NOT a bare `export const` in `index.ts` — so it does not hit the
runtime-erasure trap that `wsCloseCodes.ts` exists to document.

### 1.2 What each kind needs

| Kind | Geometry it carries | Hit test |
| ---- | ------------------- | -------- |
| `wall` | `data.points[]`, local | distance to the polyline, through `toWorld` |
| `spline` | `data.points[]`, local | same (sample the curve or use the control polyline — see §5) |
| `door` | `transform` + `data.width` | distance to the segment centred on the transform, rotated |
| `light` | `transform` + `data.radius` | distance to the ORIGIN, within a grab radius — **not** `radius`, which can span half the map |
| `text` | `transform` + `data.fontSize`/`text` | distance to the origin within a grab radius |

Tiles, stamps and shapes keep their existing paths untouched.

### 1.3 Ordering, and the tie that will bite

`topmostTileAtPoint` (`mapStudioWorkspaceUtils.ts:57-74`) sorts by `layerOrder(layer)` (the
layer's `zIndex`) then reverse document index, and filters on `isVisible`. **Follow the same
rule** — a second ordering convention is the same drift problem as a second transform.

The tie that matters: **a door sits ON a wall**, so a click near a doorway is within tolerance of
both. Resolve **more specific first** — door before wall — or a DM aiming at a door to change its
state deletes the wall behind it. Pin that with a test; it is not obvious from either element's
data that they overlap.

### 1.4 The highlight has no shape for a line

`elementSelectionRect` returns `SelectionRect | null` and explicitly returns null for
wall/door/light. `MapEditPreviewLayer.tsx:118-137` renders it as a single Konva `<Rect>` inside a
rotated `<Group>`.

A rectangle is the wrong outline for a wall: the bounding box of a diagonal wall is a large square
that touches the wall at two corners. Widen the return to a union — the existing rect case, plus a
polyline case and a point case — and render `<Line>` / `<Circle>` accordingly. Keep the same
stroke, `strokeWidth: 2 / cam.scale` and dash scaling, so a selected wall reads as the same kind
of selection a selected tile does.

### 1.5 Mobile gets it for free

`MobileSelectPanel` reads `selectedElement` off the toolbar bag and names `element.type` from a
closed `Record<MapElement["type"], string>` that already has entries for all eight kinds. Nothing
in the mobile tree changes. The e2e that proves it (`apps/e2e/mobile/mobile-map-edit-delete.spec.ts`)
currently authors a Row **because a wall could not be selected** — its header says so, and that
comment becomes wrong the moment this lands. Update it.

---

## 2. The commits

### Commit 1 — shared: one definition of where an element is

Export `toWorld` from `sceneCompiler.ts`. Give it a doc comment saying why it is exported: the
hit test needs the compiler's exact answer, and a second copy would drift.

Gate, commit. No behaviour change, so the whole existing suite is the test — but confirm the
shared build still emits it (`packages/shared/dist`), because the server resolves shared from
`dist/` while the client resolves it from `src/`.

### Commit 2 — proximity hit testing

In `elementHitTest.ts`:

- A `distanceToSegment(point, a, b)` helper, and `distanceToPolyline(point, points)` over it.
  Pure, no document knowledge — its own tests.
- `SELECT_TOLERANCE_CELLS = 0.5`, converted with `document.grid.size` at the call site so the
  tolerance is document-space and zoom-independent (the owner's decision — state it in a comment,
  because "why not screen pixels" is the obvious question a reader will have).
- Extend `selectElementAtPoint`: after the existing tile/stamp and shape passes, a proximity pass
  over the five new kinds, honouring `isVisible` and the layer-then-index order, door before wall.

Tests: the helper's geometry (including the degenerate zero-length segment, which is a point and
must not divide by zero); each kind selectable at its own geometry; each NOT selectable just
outside tolerance; door beats wall at a doorway; a hidden layer's wall is not selectable.

### Commit 3 — a highlight that fits what it outlines

Widen `elementSelectionRect` to return a discriminated union (rect | polyline | point) — consider
renaming it `elementSelectionShape`, since it no longer returns only rects. Thread the union
through `useMapEditSelection`, `MapBoard`, and `MapEditPreviewLayer`, and render `<Line>` for
polylines and `<Circle>` for lights/text.

Watch the LOC guard: `MapEditPreviewLayer.tsx` is 182 lines and `elementHitTest.ts` is 99 — both
have headroom, but measure AFTER `prettier --write`, never before (the trap that turned 348 into
353 in the initiative slice).

### Commit 4 — the docs stop calling it a limitation

- `docs/user-guide/map-editor-guide.md` — the "Deleting on a phone" callout says walls, doors,
  lights and splines **cannot be picked, on a phone or at a desktop**. That becomes false. Rewrite
  it, and keep the honest part: a Room's floor is TERRAIN and comes off with Erase, not Select.
- `apps/e2e/mobile/mobile-map-edit-delete.spec.ts` — the header explains at length why the target
  is a Row stamp rather than a wall. Update it; consider adding a wall case now that one works.
- `docs/planning/HANDOFF-NEXT.md` — it is stale again (it still calls M8's Select half unstarted
  and the `ref: dev` fix unproven; both landed on 2026-08-26, merge `6a605af4`).

---

## 3. Traps

1. **`data.points` are LOCAL.** Hit-testing them as document coordinates works perfectly for every
   element at the origin with no rotation — which is most of them in a fresh test — and fails
   silently for the rest. Go through `toWorld`.
2. **Light `radius` is not a grab radius.** A torch pool can span half the map; using it makes a
   click anywhere in the room select the light. Use a fixed small handle.
3. **Zero-length segments.** A one-point polyline, or two identical points, divides by zero in the
   naive projection formula. It happens: a degenerate drag can commit one.
4. **A Room emits a RING of separate walls.** Deleting one leaves a gap — correct for cutting a
   doorway, surprising if the DM expected "delete the room". Not a bug; do not "fix" it.
5. **A Room's floor is terrain, not an element.** "Delete this room" is not expressible however
   good the hit test gets. Say so in the guide rather than implying otherwise.
6. **An invisible light is still selectable.** With the lighting layer at full day a light renders
   nothing, so a DM can select and delete something they cannot see. That is arguably right
   (otherwise it is unreachable) but the highlight is the only feedback — make sure the point
   highlight actually draws for lights.
7. **Measure LOC after prettier, never before.**
8. **`pnpm lint:structure:enforce` is NOT part of `pnpm lint`.**
9. **Sabotage every test, and prove the sabotage APPLIED** — a `from` string that never matched
   proves nothing, and CRLF from a Python `open(p,'w')` on Windows is how that happens silently.

---

## 4. The gate — all of it, before every commit

```bash
CI=true pnpm build
CI=true pnpm typecheck && CI=true pnpm lint && CI=true pnpm lint:structure:enforce && CI=true pnpm format:check
CI=true pnpm test
CI=true pnpm --filter herobyte-client build:check
CI=true pnpm test:e2e --reporter=list
```

Baselines at `6a605af4`: shared 424, server 2185, client all 45 batches, e2e **139 passed / 0
failed / 3 skipped**. Put your numbers in each commit body.

---

## 5. Judgement calls you may reverse

- **Splines hit-tested on the CONTROL polyline, not the rendered curve.** Cheaper and simpler; a
  ribbon bows away from its controls, so a click on the visible curve near the bow may miss. If it
  feels wrong in the browser, sample the curve — the renderer already knows how.
- **A fixed grab radius for lights and text** rather than deriving text bounds from the string.
  Deriving is more correct and needs font metrics the hit test does not have.
- **`elementSelectionShape` as a rename.** If the churn is not worth it, keep the old name and let
  it return the union.

---

## 6. Definition of done

- Every one of the eight element kinds can be selected and deleted, desktop and mobile.
- A wall's highlight follows the wall, not its bounding box — checked in a browser, not inferred.
- Clicking a doorway selects the DOOR.
- The guide no longer lists kinds that cannot be picked.
- Full gate green before every commit, e2e included, numbers in the commit body.
- **Stop before merging to `main`.** That is the owner's call, and it deploys immediately to Render
  and Cloudflare, ungated by CI. Players with a tab open must reload.
