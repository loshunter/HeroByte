# Interface arc U2 — Escape ownership inventory

**Fresh scan:** 2026-09-23. **Accepted U1 HEAD:** `290f9a3df3b20b6b5e77e14b336e3ea9444c3762`.
**Execution base:** `44c6ab8236368724732a46ed83b8f9362a29ea12`, after the separate generated-name fix.
The AST scan was repeated at this commit immediately before adopting characterization tests:
694 source files, 15 owners, 16 Escape sites, and all 35 owner/context fingerprints unchanged.
**Status:** U2 pre-implementation inventory complete; characterization and implementation
are not established by this record.

This refresh replaces the preparation scan of `0007e517` and satisfies the fresh-source
inventory prerequisite for [U2](../planning/interface-clarity-arc-plan.md#u2--cancel-means-cancel-and-escape-has-one-owner).
The inventory task changed no production source or tests and ran no test, build, browser,
or server. U1 acceptance is recorded separately in the execution ledger. All fifteen
owner files are unchanged between the original audit and the accepted U1 HEAD.

Method: repository-wide `rg` over non-test application/package source, manual reads of
each handler and its callbacks, then a TypeScript AST scan of **694 tracked non-test
JS/TS files**. The AST found **16 executable Escape comparisons in 15 files**; the two
DiceToken inputs account for the extra site. It found no additional `Esc` spelling or
direct `keyCode`/`which` comparison with 27. The broader text search also covers current
untracked non-test source and rules out comment-only hits. These bounded syntactic scans
are discovery aids; the owner classifications below come from the current source.

Raw scan, complete file list, timestamps, full source SHA-256 values and counted lines:
`output/interface-u2-preparation/fresh-inventory/source-scan.json`. Its adjacent `scan.cjs`
is a read-only reproduction script. Graphify's CLI still fails with **Failed to canonicalize
script path**; `.graphify_python` is absent. A read-only adjacency fallback against the
existing graph used its actual vocabulary `escape, keyboard, cancel, map, edit, tool`.
It confirms the extracted `useMapEditTool()` → `useMapEditCancel()` call/import seam
(`useMapEditTool.ts:L112`, `useMapEditCancel.ts:L47` in the graph). That graph was built at
`ea7c05e1`, so it is navigation evidence only, not evidence of current ownership or behavior.
The fallback output is `fresh-inventory/graph-recon.json`; no graph was rebuilt.

## 1. Scope and priority

There are **15 files with executable Escape handlers: 8 native global listeners and
7 React-local owners**. The global listeners comprise six on `window` and two on
`document`. Comments describing Escape, the selection manager's example, and the
authentication hook named `useConflictEscape` are not additional keyboard owners.

Plan §3.1 defines this priority:

1. Native control popups and IME composition handle their own Escape.
2. Close/cancel the topmost modal or foreground popover, preserving underlying state.
3. Cancel an active canvas gesture and its unsent accumulation; retain the tool.
4. Close the topmost content panel/sheet and return focus to its launcher.
5. Leave the active tool for Move; a later Escape may clear a Move selection.

The table uses **L1–L5** for those levels. Existing field-local cancellation is preserved
after native-popup/IME handling and before dismissal of its enclosing layer. Classification
does not authorize a redesign of every owner: new window close/focus-return behavior is
scoped to **Character settings, World, Chat & Rolls, and DM**.

Across the inspected handler bodies, none checks `isComposing`, the legacy composing
keycode, `defaultPrevented`, `repeat`, or Escape modifiers; none explicitly restores focus
to a launcher. The three global editable guards inspect `event.target` only through
`isEditableTarget` (input, textarea, select, or `isContentEditable`); they do not fall back
to `document.activeElement` for events dispatched at `window`.
The focus column distinguishes initial focus from return-focus behavior; a callback's
caller may own other behavior that this inventory does not establish.

## 2. Actual owners

### Native global listeners

| File / target and phase | Activation | Escape action, editable handling and propagation | Focus / intended owner |
| --- | --- | --- | --- |
| **Q** [MapEditQuickWheel.tsx:62](../../apps/client/src/features/map-edit/MapEditQuickWheel.tsx#L62) — `window`, capture | Wheel mounted; effect depends on `onClose` | Calls `onClose`. No editable guard. Calls `preventDefault`, `stopPropagation` and `stopImmediatePropagation`. | No explicit focus return. **L2** foreground popover. |
| **M** [useMapEditCancel.ts:75](../../apps/client/src/features/map-edit/useMapEditCancel.ts#L75) — `window`, capture | `active`; action requires live `currentDrag()` | Clears the drag only, not the full `cancelGesture`; brush and touch aim bypass this branch. No editable guard. Calls `preventDefault` and `stopImmediatePropagation`. | No focus action. **L3** gesture. |
| **S** [useKeyboardNavigation.ts:50](../../apps/client/src/hooks/useKeyboardNavigation.ts#L50) — `window`, bubble | `onSelectObject` exists; action requires truthy `selectedObjectId` | Calls `onSelectObject(null)`. No editable guard or event consumption; the separate Delete handler has an editable guard. | No focus action. **L5**, after higher-priority owners decline. |
| **T** [useToolMode.ts:133](../../apps/client/src/hooks/useToolMode.ts#L133) — `window`, bubble | `activeTool` non-null | Sets tool to null. Skips editable targets. Does not consume. | No focus action. **L5** tool exit. |
| **I** [InitiativeModal.tsx:142](../../apps/client/src/features/initiative/components/InitiativeModal.tsx#L142) — `document`, bubble | Component mounted; closes only when `!isLoading` | Calls `onClose`. No editable guard or consumption. Loading blocks closure but does not consume Escape. | No explicit focus return. **L2** modal. |
| **A** [useAtlasLinkAim.ts:124](../../apps/client/src/features/atlas/useAtlasLinkAim.ts#L124) — `window`, bubble | `armed && activeTool === "atlas-link"` | Calls `cancelLinkAim`: clears pending ref, disarms, **also sets tool to null**. Skips editable targets; does not consume. | No focus action. **L3** one-shot pending aim; current cancellation also exits the tool, so do not assume the reusable-brush retention contract already exists here. |
| **K** [useKickedInDoor.ts:247](../../apps/client/src/features/atlas/useKickedInDoor.ts#L247) — `window`, bubble | `open`; separate from its DM-only G shortcut | Sets `open=false`; does not cancel an already-sent kick. Skips editable targets; catches focus outside the form. Does not consume. | No explicit focus return. **L2** foreground panel. |
| **H** [HelpMenuButton.tsx:68](../../apps/client/src/features/help/HelpMenuButton.tsx#L68) — `document`, bubble | Help `open` | Sets `open=false`. No editable guard or consumption. | No explicit focus return. **L2** popover. |

### React-local handlers

These are React `onKeyDown` handlers on the named element, in the bubble phase. They are
not seven more global listeners. IME composition is not checked in any of them.

| File / element | Activation and action | Propagation / focus / intended owner |
| --- | --- | --- |
| **m** [MacroBar.tsx:105](../../apps/client/src/components/dice/MacroBar.tsx#L105) — macro name input | `naming`; Escape closes editor and clears label. | No prevention or consumption. Input autofocuses; no return-focus action. **Field-local cancellation**. |
| **h** [HandEntry.tsx:106](../../apps/client/src/components/dice/HandEntry.tsx#L106) — numeric input | `open`; Escape calls `close`, clears value. | Prevents default, does not stop bubbling. Input receives focus on open; no return-focus action. **Field-local cancellation**. |
| **d** [DiceToken.tsx:131](../../apps/client/src/components/dice/DiceToken.tsx#L131) and line 230 — quantity/modifier inputs | `isEditing`; `token.kind` chooses one input. Escape sets editing false. Both inputs submit on blur. | No prevention or consumption. Autofocus; no return-focus action. **Field-local cancellation**; characterize Escape/blur before changing it. |
| **a** [AtlasNodeRow.tsx:65](../../apps/client/src/features/atlas/AtlasNodeRow.tsx#L65) — rename input | `editingName !== null`; Escape sets it null without calling rename. | No prevention, consumption, autofocus, or return-focus action. **Field-local cancellation**. |
| **k** [KickPanel.tsx:78](../../apps/client/src/features/atlas/KickPanel.tsx#L78) — form | Mounted, including `presentation="content"`; any descendant Escape calls `closeKick`, including native selects and while kick pending. | Prevents default and stops propagation. Name focuses/selects on mount; no return-focus action. **L2**, after native popup/IME **L1**. |
| **b** [MapEditBrushDeck.tsx:108](../../apps/client/src/features/map-edit/MapEditBrushDeck.tsx#L108) — search input | Mounted, even query already empty; Escape clears query. | Stops propagation for **every key**, then Escape prevents default. Input remains mounted/focused. **Field-local cancellation**. |
| **c** [CharacterCreationModal.tsx:80](../../apps/client/src/features/players/components/CharacterCreationModal.tsx#L80) — name input | `isOpen && !isCreating`; calls Cancel. Only name input owns the handler; disabled while creating. | No prevention or consumption. Autofocus; no explicit return. **L2** modal; other focus locations and loading have no modal-level Escape guard. |

**Disposition before implementation:** Q/M need coordinated arbitration rather than
retaining competing capture listeners. S/T/A/K/I/H must participate in the same ownership
decision if migrated; preserve non-Escape behavior and all server-command boundaries.
The cancellation meanings of m/h/d/a/b remain field-local; any eligibility/IME/consumption
changes need regressions without redesigning those editors. k/c retain their existing
close/loading intent while their containing foreground layer blocks lower owners. No
new launcher-focus contract is authorized for these unrelated windows. This inventory
does not prescribe a registry implementation or make all fifteen files mandatory edits.

## 3. Overlap characterization targets

The following event-path matrix covers **every pairwise handler family** from §2. It is
source-based routing analysis, not a claim that every combination is reachable through
ordinary UI in the same frame. Actual activation predicates and surface visibility still
matter. Native element-originated keydown travels window-capture → local React handler
→ document-bubble → window-bubble; a synthetic event dispatched on window bypasses the
document/local path and must not be used as the only integration proof.

| Pair/family | Current routing when both predicates hold |
| --- | --- |
| Q × M | First registered active capture listener wins by `stopImmediatePropagation`; a non-drag M declines. Mount/effect order, not visual priority, decides. |
| Either Q/M × any S/T/I/A/K/H or m/h/d/a/k/b/c | Active capture action runs before the other owner and suppresses it. Thus it can cancel a hidden drag or close the wheel before a higher modal, native select or field sees Escape. |
| I × H | Both document listeners act in registration order; neither consumes. Loading I declines without blocking H. |
| Either I/H × any S/T/A/K | Document handler acts before window; eligible window handlers then act too. Editable input skips T/A/K but does not skip S. |
| Any pair among S/T/A/K | Neither consumes, so both eligible callbacks run. A also calls `setActiveTool(null)`, overlapping T. T with S can both exit and clear. K can close while T exits or A cancels. |
| Any m/h/d/a/c × any I/H/S | Local callback acts first, then eligible globals act. h's `preventDefault` does not stop these globals. Loading c does nothing and does not block lower globals. |
| Any m/h/d/a/c × any T/A/K | All these local handlers are on inputs, so the global editable guard declines. This does **not** protect from Q/M/I/H/S. |
| Either k/b × any bubble-global I/H/S/T/A/K | Local `stopPropagation` blocks those global listeners; it cannot stop the earlier Q/M capture phase. k also blocks its counterpart K, preventing a second close on that path. |
| Any distinct pair among m/h/d/a/k/b/c | Current rendered controls are separate event paths, not nested Escape owners. DiceToken's two sites are mutually exclusive per instance. Focus in one local field does not invoke a sibling local handler; global owners can still span both surfaces. |

Stable map-edit M and atlas-link A are mutually exclusive through the tool axis; tests
must not invent that composition as a reachable steady state. Likewise current selection
cleanup often removes S's predicate after leaving Select/Transform. These are **state
constraints, not event arbitration**; test actual transition ordering and selection
retention instead of relying on a listener's incidental absence. A focused field behind
a higher visible window remains an important case: local cancellation must first be
eligible for the highest surface, including b before its unconditional stopPropagation.

Additional foreground surfaces have **no executable Escape handler today** and therefore
do not inflate the fifteen count: DM elevation, the Character Status Effects dropdown,
Character/World/Chat & Rolls/DM windows, and the generic DraggableWindow/MobileScreen.
They still affect priority. DM elevation must block fallthrough while loading; the Status
Effects dropdown must dismiss before Character. Native `window.confirm` owns its browser
dialog outside this JavaScript ladder. Existing Draw/build palettes are persistent tool
surfaces, not content blockers that may consume every idle Escape forever.

Paint order also matters: Chat's window has z-index 999 **inside DicePanels' 1000 stacking
context**; World and DM use 1002, Help 2000, Character 2500, DM elevation 3000, and Initiative/
Character creation 10000. Quick Wheel is 1200. These numbers belong to actual ancestry,
not a flat list: do not register Chat's wrapper and frame as two owners, or decide the
topmost layer by hook registration order. Responsive DraggableWindow adds its own +100
overlay band. Portal and same-band DOM ordering need browser coverage.

Before extracting or changing handlers, use production hooks/components together in a
small characterization harness under `__tests__/characterization/`. Dispatch bubbling,
cancelable events from mounted descendants as well as from `window`; a fake bubble
listener alone cannot establish priority between capture owners.

| Interaction to characterize | Current risk / subsequent U2 acceptance target |
| --- | --- |
| Quick wheel plus active map drag, in both listener registration orders | Both window-capture handlers call `stopImmediatePropagation`; registration order can choose the winner. The foreground wheel must win regardless of order, without cancelling the hidden gesture through the same Escape. The plan requires discarding unsent work when opening a foreground **modal**; any additional cancellation on opening this popover must be resolved explicitly. |
| Map drag plus brush search, modal input or native select | Capture can intercept Escape before React-local handling. Native popup/IME handling and valid local cancellation must be protected before the canvas owner acts. |
| Help or Initiative plus active tool and selection | The document listener can close its layer, then both window listeners also act. One Escape must change only the highest eligible owner. Include loading Initiative, whose refused close must not leak to the underlying tool. |
| Tool exit plus selected object | One Escape currently reaches both bubble owners. Pin the current overlap, then require separate steps for tool exit and subsequent Move-selection clearing. |
| Composing text or open native select in KickPanel/other foreground layer | No owner currently checks composition. The layer must not close or cancel when Escape belongs to L1. Native-popup behavior needs a real-browser check, not a jsdom-only claim. |
| Grass/erase press → move → Escape → release | Brush Escape bypasses drag-only cancellation; tool exit currently flushes accumulated cells. U2 must send zero terrain commands, clear preview, retain the brush, ignore the release and allow the next stroke to work normally. |
| Touch placement aim → cancel → move → release | `start` and `move` currently share the same aim setter. Cancellation clears the point, but a later move can recreate it. Require an armed gesture before moving; cancel/release disarm it. Preserve zero commands on release, including second-finger and external Cancel paths. |
| Desktop Place/Scatter/Light press → Escape | Desktop press already dispatches. Do not assert rollback or zero commands after that point; preserve the single dispatch and the distinct acknowledged-edit Undo path. |
| DiceToken Escape with its blur submission handler | Preserve abandonment without accidentally recording an edit through blur. This is a characterization target, not a verified submission defect. |
| Foreground content panel plus active gesture/tool | Character settings, World, Chat & Rolls and DM must close only at their proper priority, with focus returned to their own launcher. Panel-close scope does not extend to redesigning all fifteen owners. |

## 4. Existing tests and their limits

- [useMapEditTool.test.ts](../../apps/client/src/features/map-edit/__tests__/useMapEditTool.test.ts)
  exercises a nonzero wall drag cancelled by Escape. Its external-cancellation section
  covers drag, terrain and touch aim, a later release producing no command, and the next
  gesture still committing. These are useful production-hook foundations; they do not
  establish combined Escape ownership.
- [MapEditQuickWheel.test.tsx](../../apps/client/src/features/map-edit/__tests__/MapEditQuickWheel.test.tsx)
  and [MapEditBrushDeck.test.tsx](../../apps/client/src/features/map-edit/__tests__/MapEditBrushDeck.test.tsx)
  protect against fake window-bubble listeners. Neither proves ordering against another
  capture listener.
- [useToolMode.escapeGuard.test.ts](../../apps/client/src/hooks/__tests__/useToolMode.escapeGuard.test.ts)
  exercises the real hook's editable-target guard.
- [useKeyboardNavigation.test.ts](../../apps/client/src/hooks/__tests__/useKeyboardNavigation.test.ts)
  covers selected-object Escape and Delete's editable guard, but not Escape's editable
  or overlapping-owner behavior.
- [useToolMode characterization](../../apps/client/src/ui/__tests__/characterization/useToolMode.test.ts)
  tests a copied local `useToolModeCharacterization` function. It is historical evidence,
  not proof that changes to the current production hook preserve behavior.
- Existing Initiative, Character creation, Help, Kick, atlas aim and HandEntry tests
  assert their own Escape actions in isolation. Extend a shared production-owner harness
  for overlap rather than treating those isolated assertions as a global priority proof.

No test result is recorded here: these files were inspected, not executed.

## 5. Minimal extraction recommendation

At `290f9a3d`, `useMapEditTool.ts` still measures **349 lines**, using the structure guard's
newline-split counting convention. Its exit effect clears a drag and flushes an
in-progress brush when `active` becomes false. Current headroom is below; a negative value
is an extraction requirement, not permission to raise a baseline or grow the file.

| Current source | LOC | Remaining to 348 | Relevance |
| --- | ---: | ---: | --- |
| `features/map-edit/useMapEditTool.ts` | 349 | -1 | U2's first characterized cancellation extraction. |
| `features/map-edit/useMapEditCancel.ts` | 99 | 249 | Existing full cancel primitive and drag-only Escape. |
| `features/map-edit/useMapEditTouchAim.ts` | 91 | 257 | Distinguish pending touch gesture from armed tool. |
| `hooks/useDrawingTool.ts` | 335 | 13 | Reuse cancellation; characterize same-frame move/release. |
| `hooks/useKeyboardShortcuts.ts` | 318 | 30 | Exclusive history route, including empty history. |
| `features/selection/SelectionManager.ts` | 330 | 18 | Mode cleanup also clears selection independently of Escape. |
| `components/dice/DraggableWindow.tsx` | 310 | 38 | Four-window opt-in only; avoid broad frame growth. |
| `layouts/mobile/MobileScreen.tsx` | 106 | 242 | Explicit close/focus adapter, not generic unmount focus. |
| `features/players/components/PlayerSettingsMenu.tsx` | 665 | -317 | Characterize/extract Status Effects state/markup before additions. |
| `features/dm/components/DMMenu.tsx` | 333 | 15 | Scoped dismissal; no DM-menu restructure in U2. |
| `features/map-edit/MapEditBrushDeck.tsx` | 326 | 22 | Eligibility must precede local event consumption. |
| `features/initiative/components/InitiativeModal.tsx` | 328 | 20 | Loading is a blocking layer, not fallthrough. |
| `features/map-edit/useMapEditState.ts` | 347 | 1 | U3b boundary; avoid incidental growth from U2 plumbing. |
| `features/map-edit/MapEditToolbar.tsx` | 341 | 7 | Cancel control needs a bounded adapter. |
| `features/dm/components/map-controls/MapStudioControl.tsx` | 349 | -1 | U6 extraction boundary; no U2 feature edit. |
| `features/players/components/PlayerCard.tsx` | 480 | -132 | U7 boundary; do not grow for launcher wiring. |
| `apps/server/src/domains/map/service.ts` | 413 | -65 | If history repair is adopted, characterize/extract first. |

Client paths above are relative to `apps/client/src`; the server path is repository-relative.
Counts are direct source measurements, **not a structure-guard run**. Owner counts and
full hashes are also retained in §7 and the raw source manifest.

The smallest natural extraction is to move that existing exit effect into the existing
`useMapEditCancel` module, passing `flushStroke` during the characterization/refactor
commit and preserving behavior first. That removes roughly ten lines from the driver
and keeps gesture-ending behavior together. Recount after formatting; keep new/changed
modules inside the plan's 348-line working budget without raising a baseline.

The subsequent focused IA-04 fix can change explicit cancellation to discard through
the shared primitive. Do not preserve the known flush-on-Escape defect as a final
invariant. Keep normal release-to-commit and already-dispatched desktop point actions
distinct from cancellation of unsent work.

[useMapEditTouchAim.ts](../../apps/client/src/features/map-edit/useMapEditTouchAim.ts)
currently keeps the aimed point private and exposes start/move/commit/cancel, but no
pending-aim predicate. Escape ownership needs a truthful pending-gesture check for this
case; an armed click tool alone must not consume Escape as though a gesture were active.
Characterize any added seam before integrating it. Replacing the camera/touch router is
outside this bounded extraction.

## 6. Characterization handoff and scope

The fresh scan is complete; the next step is to adopt and run the bounded production-owner
characterization groups, then include this document in U2's first inventory/characterization
commit **before changing any Escape handler**. The ignored preparation's integration map
lists 77 proposed baseline cases and 120 written cases in total; those are drafts, not
results. This inventory task did not adopt, execute, compile, or verify them.

The plan requires one explicit ownership contract; the proposed window-bubble dispatcher
is one candidate, not an accepted implementation. It cannot arbitrate ahead of surviving
capture owners. Live pending-gesture refs must be authoritative; an armed tool, idle hover,
or a dispatched command awaiting its reply is not an unsent gesture. Plain input editing
does not globally disable panel dismissal, but native popup/IME and eligible local field
cancellation come first. Editable guards protect canvas/tool/selection fallthrough.

New close/focus-return behavior remains scoped to **Character, World, Chat & Rolls, and
DM**. Capture the correct launcher before child autofocus; return focus after an explicit
close, not raw unmount, role loss, or responsive teardown. Do not let a delayed return
steal focus from a newly opened surface. Mobile World needs an explicit return-to-Tools
path; automatically closing it must not reopen Tools. Other windows may need to register
as blockers without acquiring an unrequested close/focus redesign.

Cancellation regressions must cover normal event turns and cancel → move → release in the
same turn. Existing touch aim shares `start` and `move`, so a move can re-arm after cancel;
the drawing driver also has rendered-state guards that need a same-frame proof. Preserve
normal release, next-gesture recovery, desktop pointerdown dispatch, and second-finger
camera behavior. Opening a foreground **modal** cancels the old unsent gesture under the
plan; clarify any additional popover-opening behavior rather than silently broadening it.

Undo labels and keyboard routing must share one history owner even when its history is
empty. Drawing Ctrl+Z currently can fall through to DM selection Undo in that case. For
the previously reproduced stale player Undo after remote Clear All, authoritative
recipient-only snapshot availability is a proposed repair requiring its own protocol,
privacy and export-byte characterization. Empty drawings do not imply empty Redo. Never
treat unrelated snapshots or dispatch as an acknowledged history change.

All live/browser acceptance, meaningful red/green characterization, full house gates,
and U2 review-convergence remain separate work. This document establishes the source
inventory only; it does not establish gesture safety, native-popup behavior, focus return,
or U2 completion.

## 7. Owner source fingerprint

SHA-256 values below cover the actual source bytes read at accepted U1 HEAD. The IDs map
to the exact paths and listener sites in §2. The JSON manifest also fingerprints the
context/headroom files, carries the UTC scan time and lists all 694 scanned source files.
No Escape source changed during this inventory; recheck these hashes before applying the
first behavior edit if other work has touched a listed owner.

| ID | LOC | SHA-256 |
| --- | ---: | --- |
| Q | 211 | `8bb85352185f77b418488991b451a1cfac2299e7161dc9e38d366ef2d7f26456` |
| M | 99 | `128c5b0c0065577bb32463bfdf8d6b56a02b91049cd064ad888815a60c568848` |
| S | 59 | `34638f2350812d2465130f5095969cc574349c8035207cd806328d1b4d16820d` |
| T | 154 | `ce67a22bac03c88c6176244325b8ee3759c6ac5fd864a73492db8da3ff3fc322` |
| I | 328 | `d950db011cd48c878bc366d4f9713d0a2ab4496279a12248f630ea3022e0021a` |
| A | 133 | `ef78394bb9425818301cb9645df8f041fb55b6342be734e2f414f86361323558` |
| K | 273 | `baa18aaa3226e0b597b3f8155ef506cdf63b675419dd62b6e05dd51e5c1f9bc1` |
| H | 154 | `3a26d27f5c4309bdc1e95990b09e4aa67a5e4eeb0bab5af59574daa7e324a4cb` |
| m | 131 | `25948c6645d1944b18ef49a335d69add5021f5801005aaab54766700fd66d31e` |
| h | 133 | `f9c8227becef0ce32978550c8a9a29dacdc7737aaff91bad9b64f2e7715571fe` |
| d | 286 | `c43597c432ad42b582c3e21f65007d063abf7d7cec6764392106ddad923ecb9d` |
| a | 146 | `fa5d44bfc28e90a692019c57e5f8313ccd37702f883f8a7173a9c623da544a81` |
| k | 216 | `c8cdf6eea159c4ccc1ed12462ba9650d0e846d8ef6ea5926d205ec8811467224` |
| b | 326 | `9fe7a84b3a49517bf42fa26fbc65933a4c647dee4297851204edfded492ac704` |
| c | 201 | `85186bc24046559862ca4366b69eed215ffc90e72a5163d6b38953ecb70fd5ca` |
