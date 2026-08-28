# Map Editor Guide

HeroByte's map editor runs **on the live table**: every room, wall, door, and brushstroke appears for your players the moment you commit it. No export step, no "load map" — you build the dungeon around the party, even mid-session.

It's DM-only: [elevate first](getting-started.md#becoming-the-dm), then press **🏗️ MAP** in the top toolbar. On a phone or tablet the door is a different one — see [On a phone or tablet](#on-a-phone-or-tablet) at the end.

## Starting a live map

The palette opens with one button:

**▶ START LIVE MAP** creates a fresh editable map (date-stamped, huge — 8192×8192), binds it to the table, and lights up the **● LIVE** badge — `loading…` sits beside the badge while that round trip runs. From now on every edit auto-compiles and broadcasts; you'll see a brief `saving…` flicker in the same spot as each commit lands.

![The map tools palette, live and ready](img/mapedit-start.jpg)

Things to know before your first wall:

- **Escape** cancels an in-progress drag; pressing it again (with nothing in progress) leaves map-edit mode. The map _stays_ live — closing the palette never unbinds it, and reopening resumes where you left off.
- **↶ UNDO / ↷ REDO** at the palette's foot work on map edits (Ctrl+Z / Ctrl+Y while in the mode). Each drag, stroke, or generate is exactly one undo step.
- Only one edit is sent at a time. If you finish a drag or a click while the previous one is still in flight, that gesture is dropped rather than queued, and you'll get **"Still saving the last change — draw that again."** Draw it again — nothing was half-applied. You'll notice this most on a phone, where the round trip is longest.
- Tokens don't respond to clicks while you're editing — leave the mode to move them.
- If the table still has a raster background image, the palette warns you: live terrain and a background photo fight visually. Clear the background (DM Menu → Map Setup) for a clean canvas.

## 🏠 Room and 🚇 Hall — the structural tools

**Room** drags a rectangle; on release you get floor terrain, a painted wall band, and a real blocking wall around the perimeter — one committed room, one undo step. The preview shows the true baked art plus a live `cols × rows` readout while you drag.

![Room tool armed: the brush deck picks the floor, the wall ring picks the walls](img/mapedit-room-options.jpg)

- The **brush deck** (below the tools) chooses the floor — any of the 34 terrain families.
- **Wall ring:** picks the wall style — **None, Stone, Brick, Timber, Dark**.

![A committed room: floor, wall band, and blocking walls](img/mapedit-room-done.jpg)

**Hall** is the corridor sibling: drag along its length, choose **Width (cells)** 1–4, and only the two long sides get walls — the ends stay open for connecting. Halls and rooms are polite neighbors: where they touch an existing floor, the shared wall band steps aside.

![A hallway heading east from the room](img/mapedit-hall.jpg)

## 🧱 Wall and 🚪 Door

- **Wall**: drag point-to-point for one straight blocking wall. Walls are invisible to players — they exist to block movement and sight (fog). While editing you always see them as a translucent overlay; **📐 PIN WALLS OVERLAY** keeps that overlay up after you leave the mode (players never see it).
- **Door**: drag across a wall to set a door — its length is the drag, its angle follows. Doors author **closed**.

![A door cut into the east wall](img/mapedit-door.jpg)

Door states go beyond open/closed — select a door with **👆 Select**, open **🔍 Inspect**, and the door section offers **Closed / Open / Locked / Secret** plus a width field:

- **Locked** — players get "Door is locked"; you can force it (Alt-click a door at the table cycles its lock).
- **Secret** — invisible to players entirely, dashed seam for you. Alt-click reveals it when the rogue finds it.

At the table, anyone can click a door to swing it — creak and slam included.

## 💡 Light — torches and night

Click to drop a warm torch pool (fixed radius). The trick is in the **Layers panel**: the **Lighting layer's opacity is the ambient light level** — `1` is full day; drag it down and the map cools into night, and your torch pools start to glow.

![Night ambient with two torch pools burning](img/mapedit-night-lights.jpg)

Some placed assets (street lamps, braziers) are **emissive** and cast their own glow automatically — no Light click needed.

## 🖌️ Paint and 🧹 Erase — freehand terrain

**Paint** brushes terrain cell-by-cell as you drag; each stroke is one undo. The **brush deck** is your palette:

![The brush deck: shelves, search, and pinned favorites](img/mapedit-brush-deck.jpg)

- **Eight shelves**: Ground (grass, dirt, sand, paths, cavern floor…), Water (including abyss depths and bioluminescence), Molten (lava and cooled crust), Stone (floors, walls, stairs, cliffs, a dais), Wood (plank floors, bridges, timber walls), Roofs, Canopy, and Crystal — 34 families total.
- **Search** filters instantly; **right-click a tile to pin it** to a ★ Pinned shelf; your six most recent brushes keep a Recent shelf warm. Hover a tile for a preview card and a one-line description.
- Terrain is procedural: water finds its depth, cliffs get contact shadows, grass mottles — you paint intent, the renderer does the art.

![A painted pond south of the room](img/mapedit-paint-water.jpg)

**Erase** clears painted terrain the same way (one stroke, one undo). It only erases terrain paint — placed objects come off with Select + Inspect → DELETE.

## 📦 Place, 🎲 Scatter, and 📏 Row — set dressing

Three tools share one **asset picker**:

![The asset picker: Objects, Structures, Terrain, Decals, Inlays, and My Stuff](img/mapedit-asset-picker.jpg)

- **Objects** (crates, tables, boats, standing stones…), **Structures**, **Terrain** (stamp a terrain patch as an object), **Decals** (scorch craters, stains, wax drips), **Inlays** (medallions, rugs, tracery), and **My Stuff** — **⬆ UPLOAD IMAGE** turns your own PNG/JPEG/WebP/GIF into a placeable asset.
- **Place**: click to drop grid-snapped; **hold Alt** for a free-floating stamp at any angle; **R / Shift+R** rotates in 15° steps. A ghost previews the exact landing spot.
- **Scatter**: one click throws a natural-looking cluster of seven — same spot, same scatter, so you can undo and redo identically.
- **Row**: drag a line and the asset repeats along it with lived-in jitter and the occasional gap — fences, torch-lined corridors, market stalls.
- **Eyedropper**: **Ctrl/Cmd-click** anything on the map (with Place, Scatter, or Paint armed) to sample it as your active asset or brush.

## ✨ Populate — instant set dressing

After you commit a room or hall, the **Populate** block targets it: pick a category — **Objects, Structs, Terrain, Wear** — and a density (low / medium / high), and translucent ghosts preview the exact stamps. **✨ POPULATE** commits the fill: furniture hugs walls, clutter respects doorways, and the whole fill is one undo.

![A populated hallway: set dressing where it belongs](img/mapedit-populated.jpg)

## 🏰 Gen — the dungeon generator

Drag a region (at least **20×20 cells** — zoom out if needed), pick a theme (**🪨 Stone / 🪵 Wood**) and density, and press **🎲 GENERATE**:

![A generated dungeon wing: rooms, corridors, doors, and dressing](img/mapedit-generated-dungeon.jpg)

- The server lays rooms, corridors, wall bands, doors (authored closed), lights, and scatter — and lands it all as **one undo step**. Don't like it? Undo, **⟳** re-roll the seed, generate again. The same seed always builds the same dungeon.
- Generated dungeons contain **no secret doors, deliberately** — a generated "secret" could be reverse-engineered from the data players receive. Add secrets by hand with the Door tool where only you know to look.

## 👆 Select and 🔍 Inspect — precision edits

**Select** clicks the topmost element under the cursor — **everything you can place**: objects, floor tiles, shapes, walls, doors, lights, text and splines. **Inspect** then edits it numerically: X/Y, scale, rotation, layer, a **Hidden** checkbox, **DELETE** — and the door state controls.

Walls, doors and splines are thin, and lights are a single point, so those are caught by proximity: click within half a cell and the dashed outline traces what you actually got. It follows the wall itself rather than boxing it, so you can see you have the right one before you delete it. Where a door crosses a wall the **door** wins, since that is what you were almost certainly aiming at. A light's ring is drawn at that same half-cell — worth knowing, because a light with the Lighting layer at full day draws nothing else at all.

Two things Select still cannot reach. A room's **floor is terrain**, not an element, so it comes off with **🧹 Erase**. And a room's walls are separate pieces — deleting one cuts a gap rather than removing the room, which is what you want when you are opening a doorway.

## 〰️ Spline — rope, chain, ribbon, filigree

Drag two anchors: **Rope** and **Chain** sag naturally; **Ribbon** and **Filigree** run straight. Dockside rigging, chained gates, ceremonial bunting.

## 🗂 Layers

Six layers, top to bottom: **GM Notes, Lighting, Walls & Doors, Objects, Terrain, Background** — each with visibility, lock, reorder, and an opacity slider (remember: Lighting's opacity _is_ the ambient light). Background ships locked so you can't paint under the floor by accident. GM Notes never reach players.

## The quick wheel

**Right-click anywhere on the canvas** (while editing) for the radial quick wheel: Room, Wall, Paint, and Erase on top, plus your four go-to brushes (pinned and recent favorites fill the slots). Escape or click away to dismiss.

![The quick wheel: everyday tools at cursor distance](img/mapedit-quick-wheel.jpg)

## What players see (and don't)

While you build, players receive every committed edit instantly — terrain, doors, lighting, the lot. They never receive:

- **Secret doors** (stripped server-side, not just hidden),
- the **GM Notes** layer,
- anything **Hidden** or on a hidden layer,
- the **walls overlay** (walls themselves are invisible; they act through fog and movement).

Flip on **👁 PLAYER VIEW** any time to see the table through their eyes — and keep building while you're in it.

## Cheat sheet

| Shortcut                    | Effect                                        |
| --------------------------- | --------------------------------------------- |
| **Esc**                     | Cancel drag → close wheel → leave map-edit    |
| **Ctrl/Cmd+Z / Ctrl/Cmd+Y** | Undo / redo map edits                         |
| **Right-click**             | Quick wheel                                   |
| **R / Shift+R**             | Rotate pending stamp ±15° (Place/Scatter/Row) |
| **Alt + click** (Place)     | Free stamp, unsnapped, rotated                |
| **Ctrl/Cmd + click**        | Eyedropper — sample asset or terrain          |
| **Alt + click a door**      | Cycle lock / reveal secret (at the table)     |

## On a phone or tablet

The editor is not desktop-only. On a touch layout it is a **mode**: the dock at the bottom of the screen is replaced by the palette, and nothing covers the map.

**Getting in:** **DM** (dock slot five) → **🏗️ Edit the live map**. The DM screen closes itself on the way — the mode needs the whole canvas, so it will not sit behind the menu you just used.

The dock becomes five slots:

| Slot                | What it does                                                                                                                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **✕ Exit**          | Leaves the mode. The map stays live.                                                                                                                                                                                                                                                                  |
| **⚒ Tool**         | Opens the sheet: **▶ Start live map** before you have one, then the nine tools below, **👆 Select**, that tool's own dials, and **◇ Recenter**. Picking a tool with no dials closes the sheet, because you picked it in order to use it; a tool that _has_ dials leaves it open so you can set them. |
| **↶ Undo / ↷ Redo** | The same map-edit history the desktop palette drives. Both stay greyed until the map is live.                                                                                                                                                                                                         |
| **⨯ Abort**         | Abandons the drag in progress.                                                                                                                                                                                                                                                                        |

**Nine tools are here.** **🖌️ Paint** and **🧹 Erase** lead, then the seven drag tools — **🏠 Room**, **🚇 Hall**, **▬ Wall**, **🚪 Door**, **📏 Row**, **〰️ Spline** and **🏰 Gen**. All nine work the same way with a finger: press, move, lift. **👆 Select** sits beside them and is the exception — it is a tap, not a drag, and it is there so you can delete something (see below).

**Painting.** Arm **🖌️ Paint** and the sheet stays open over the family picker, because Paint needs to know what to paint with. Pick a material shelf, then a floor, then **▶ To the map** and drag. A tap paints a single cell. **🧹 Erase** takes no such argument, so it closes the sheet and puts you straight on the map — drag over anything you want to take back up, including a room's floor.

> **The picker is a deck, and it remembers.** Two extra shelves appear once there is something to remember: **★** for the floors you pinned and **Recent** for the last six you used. They are the same memory the desktop palette keeps, so a floor you pin at the desk is on the star shelf when you pick up the tablet. **☆ Pin** under the swatches pins whatever is armed — the desktop pins by right-click, which a finger cannot make.

What is still desktop-only is the click half — **Place**, **Scatter** and **Light**. Each is aimed by a ghost that follows the mouse, and a finger has no hover to follow: you would be dropping objects blind. They are waiting on an aiming design of their own, not on an oversight.

> **Deleting on a phone.** Tap **⚒ Tool**, tap **👆 SELECT**, then tap the thing on the map — the sheet names what you picked — and tap **🗑 DELETE**. Select reaches everything you can place: objects, floor tiles, shapes, walls, doors, lights, text and splines. Walls and the like are thin, so you get a half-cell of slack — tap near one and it will take it, and the dashed outline traces what you actually caught before you commit to deleting it.
>
> Two things it cannot do. A room's **floor is terrain**, not an element, so it comes off with **🧹 Erase** rather than Select — which is now a tool you have on the phone too. And a room's walls are separate pieces, so deleting one cuts a gap rather than removing the room — which is exactly what you want when you are opening a doorway.

Two things behave differently from a mouse, and both are worth knowing before your first drag:

- **Lifting your finger commits.** There is no Escape key, which is what **⨯ ABORT** is for — press it with a second finger while the first is still down, and the release lands nothing.
- **A second finger always means the camera.** Reach for a pinch mid-drag and the drag is _discarded_, not committed — you wanted to zoom, not to stamp a half-built room on the table.

A **SAVING…** chip appears just above the dock while an edit is on its way to the server. It matters more here than on a desktop, because a phone's round trip is longer: finish a gesture while the chip is up and that gesture is dropped rather than queued, and you get the "Still saving the last change" notice instead of a wall. The chip is how you learn the table's rhythm and time the next drag.

**Start live map** is the same button as on desktop and creates the same document, so a map begun on a tablet opens on a laptop and the other way round. Rotating the device, or resizing a window across the phone/desktop boundary, keeps the mode armed and simply swaps which palette you get.
