# HeroByte Map Studio Roadmap

## Product position

HeroByte should compete first as an integrated **battlemap-to-live-session** tool, not as a general-purpose world cartography suite. The commercial wedge is a shorter workflow than exporting from one tool, importing into a VTT, rebuilding walls/lights, and then maintaining two copies of the map.

The comparison target is the battlemap-authoring category represented by tools in [Tabletop Bellhop's mapping tools survey](https://tabletopbellhop.com/gaming-advice/mapping-tools/): asset-based desktop editors, browser map builders, quick dungeon sketchers, and VTT-integrated map tools.

## Current capability (implemented)

- Versioned, room-scoped map documents persisted separately from the live token scene.
- DM-only create, list, open, edit, and delete workflow.
- Ordered, revision-aware commands with conflict recovery and idempotency.
- Server-backed undo/redo with monotonic revisions.
- Layer visibility, opacity, locking, and reordering.
- Square, row-hex, column-hex, and isometric grid configuration with size, distance, offsets, visibility, and snapping metadata.
- Rectangle and ellipse creation with fill/stroke controls.
- Wall segment and door creation with movement/vision-blocking metadata and door state.
- Element position, scale, rotation, layer, visibility, locking, and deletion.
- Pointer selection, drag-to-move, keyboard nudging, selection outlines, and grid-snapped movement for authored elements.
- Preview rendering for shapes, text, walls, and lights.
- One-click publish from a Map Studio document to the live tabletop as an SVG map background, with live grid size synchronization.
- Portable SVG, PNG, and WebP export plus lossless versioned JSON backup.
- Atomic file persistence behind a replaceable store interface.
- Production-start, domain, UI, conflict, persistence, and browser smoke coverage.

This is an editor foundation and a usable geometry workflow. It is not yet a DungeonDraft- or DungeonFog-class authoring product.

## Live map toolbar (shipped — Phase 1, S1–S8)

Authoring has moved **onto the live table**. A room's live-bound map document auto-compiles onto the play surface as it is edited, so walls, doors, rooms, painted terrain, and editor-grade procedural terrain appear for every connected player instantly — no separate publish step. The DM-only floating palette carries room/wall/door/terrain-brush/eraser tools plus Ctrl+Z/Ctrl+Y undo/redo routed to the live document, and door-runtime-state is preserved across live recompiles. See [live-map-toolbar-plan.md](./live-map-toolbar-plan.md) for the slice-by-slice record and the senior-review gates.

Owner decision (2026-07-11): once the palette reaches full Studio parity (Phase 2, S9–S13 — player-visible live elements, tile/stamp placement, hallway + populate, layers/inspector, exports), the separate Map Studio **scene UI is retired**. The document/command/validation/history/compile **engine is kept forever**; only the standalone editor surface dies.

## Studio scene retired (Phase 2 complete, S9–S13)

The palette reached parity and the full-screen Map Studio editor scene was **deleted** (S13). Live on-table authoring is now the only editing surface: place tiles/stamps and scatter set dressing (S10), drag hallways and POPULATE rooms algorithmically (S11), and manage layers / inspect-and-edit elements / eyedrop assets from the palette (S12). Players see every tile, stamp, shape, and public text live via the sanitized `mapElements` snapshot (S9), with GM notes and hidden elements stripped server-side. The DM menu's **Map** tab keeps document management, raster PUBLISH, PNG/WEBP/SVG **export**, and JSON backup **import/export** — the engine's prep-time surface. The `map-studio-*` wire protocol, validators, server service, and the compile/undo engine are untouched.

## Dungeon generation (shipped — M4 Phase 1, G1–G6)

The roadmap's "AI generation before the deterministic editor is reliable" non-goal below still stands, and this is not that: the dungeon recipe is a **pure, seeded, server-side function**, not a model. A DM arms 🏰 Gen, drags a region, sets theme / density / secret-door odds / seed, and a stocked dungeon — rooms, corridors, blocking walls, working doors (some secret), brazier lights, and GM-only spawn keys — compiles onto every player's table as **ONE undoable command**. Same seed, same dials → the same dungeon forever, which is what makes Cartridge Codes possible later.

It rides the rails the live-map arc laid: generators emit MapDocument elements (never rasters), so a generated dungeon is editable with every existing tool the moment it lands, and fog/vision/movement-blocking work by construction. See [m4-dungeon-recipe-plan.md](./m4-dungeon-recipe-plan.md) for the slice record, the two spec corrections found in flight, and the gate findings — including three independent attacks that defeated the secret-door disguise for generated maps (fixed in G4.5).

Deferred (not blockers for the table loop):

- **Raster-hybrid backgrounds** — an uploaded raster image coexisting under live-authored terrain. Today a raster background and live terrain can double-draw; the palette warns the DM to clear the raster for a clean live map.
- **On-canvas vertex/point editing** — dragging individual wall/door endpoints or reshaping existing geometry after creation. Current editing is create + undo/redo + erase; richer point handles remain a Phase 3-class refinement.

## Competitive gaps and delivery order

### Phase 1 — Table-ready map loop (next)

The map must become useful in a live game before the asset catalog becomes large.

- Preserve authored walls, doors, lights, and player-visible layer semantics as live scene systems during publish.
- Add resize handles, rotate handles, and richer point editing for authored geometry.
- Add direct wall/door editing on the canvas, including point handles and door state changes after creation.
- Add autosave status, dirty-state feedback, and recovery after reconnect.

**Exit criterion:** a DM can build a simple dungeon, publish it, place tokens, and run an encounter without another mapping tool.

### Phase 2 — Asset-based authoring

This is the minimum feature class needed to challenge asset-based battlemap editors.

- Upload and organize reusable tiles, stamps, textures, and map backgrounds.
- Drag assets from a searchable library onto terrain/object layers.
- Support tile painting, scatter brushes, rotation/scale randomization, and erase/replace brushes.
- Add texture fills, borders, shadows, tinting, and reusable style presets.
- Ship a small, clearly licensed starter asset pack; track license/source metadata for every asset.
- Add folders, tags, favorites, recent assets, and campaign-scoped libraries.

**Exit criterion:** a DM can produce a visually complete tavern or dungeon using only bundled and uploaded assets.

### Phase 3 — VTT-native advantage

HeroByte should outperform standalone editors on play integration rather than merely copy their drawing surface.

- Convert authored walls and doors into movement/vision blockers.
- Add ambient and point lights, darkness, soft shadows, and player-specific vision.
- Add fog-of-war painting, reveal/hide regions, secret doors, and GM-only notes.
- Support map variants, floors, scenes, and encounter-ready token/prop staging.
- Allow non-destructive republishing while preserving live tokens and encounter state.
- Add a player-preview mode showing exactly what a selected player can see.

**Exit criterion:** publishing produces a playable scene with no manual reconstruction of walls, lighting, or fog.

### Phase 4 — Faster creation and commercial differentiation

- Room/corridor generators with editable results, not flattened images.
- Procedural cave, forest, road, river, and settlement brushes.
- Template gallery for encounter sizes and common locations.
- Optional AI-assisted layout or decoration with deterministic undo and clear provenance.
- Shared campaign workspaces, co-author presence, comments, and document permissions.
- Marketplace-ready asset pack format, previews, licensing fields, and creator attribution.
- Cloud version history, duplication, templates, and cross-campaign sharing.

**Exit criterion:** HeroByte has a defensible reason to pay beyond basic VTT hosting: faster prep plus immediate playable output.

## Deliberate non-goals for the first commercial release

- Full continent/world-map cartography comparable to dedicated world builders.
- 3D cinematic map generation.
- A public asset marketplace before licensing, moderation, storage quotas, and creator payouts are designed.
- AI generation before the deterministic editor, export, and publishing pipeline is reliable.

## Product metrics

- Median time from new map to playable encounter under 10 minutes.
- At least 80% of created maps successfully reopen after a later session.
- Publish succeeds without manual wall/light reconstruction for at least 90% of Map Studio maps.
- First-party starter assets can produce three common scenes without external downloads.
- Editing remains responsive at 2,000 elements and conflict-safe with two DMs.
- Export/import round trips preserve all authored data and pass visual regression tests.
