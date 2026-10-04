# Map keyboard history with floating windows

Date: 2026-09-24. Local development fix; no deployment.

The owner reported that Ctrl+Z could not undo a completed hallway even though toolbar Undo worked. A two-client desktop reproduction isolated one cause: leaving Chat open blocked map history shortcuts after drawing on the uncovered map. The shortcut guard treated an open content window as the keyboard owner. The owner's exact original window setup was not confirmed.

In map-edit mode, pressing the actual canvas now focuses the map. That focused map can receive Ctrl/Cmd+Z and redo shortcuts beside explicitly opted-in desktop floating panels. The opt-in is revoked when a responsive window enters mobile layout. Text editors retain native undo; modal dialogs, popovers, mobile screens and sheets, composition and consumed key events remain protected. Escape ownership is unchanged. This does not add a global map shortcut while focus belongs to another window.

## Manual check

1. As DM, open Map Tools and leave Chat open beside the map.
2. Draw and release a hallway on the uncovered map; wait for it to save.
3. Press Ctrl+Z. The hallway disappears for the DM and player.
4. Press Ctrl+Shift+Z. The same hallway returns for both clients.
5. Click the Chat message field and type a draft. Ctrl+Z edits the draft instead of the map.

## Evidence

- Corrected two-client reproduction failed before implementation: the hallway replicated and Undo was enabled, but Ctrl+Z sent no undo command. An earlier attempt crossed the Chat window and failed setup; it is not counted as behavioral evidence.
- New focus regression failed before implementation, with 17 control tests passing. Authored unit and browser tests passed strict TypeScript checks before the behavior repair.
- The initial repair passed 352 focused tests and both real two-client browser journeys. The first full ladder passed: **9,954 unit tests / 4 existing skips**, **250 browser cases / 3 existing skips**, with no failures or retries; isolated 30-second boot also passed.
- First scoped review found one P2: real mobile panels also register panel owners, so the initial exception was too broad. Eight new cases reproduced history beneath real screens, sheets, Dice/Results and windows resized into phone layout. All eight failed before repair and passed strict TypeScript checks.
- After narrowing the exception to explicit desktop floating panels, **395 focused tests passed**, including all eight new cases. Strict TypeScript checks and both real two-client hallway journeys passed again.
- The final full ladder passed: all 84 client unit batches, **9,957 reported unit passes / 4 existing skips**, **250 browser passes / 3 existing skips**, no browser failures, retries or flaky cases; bundle 134.57 KB against 175 KB. Fresh isolated 30-second boot passed again. All 82 frozen source/doc hashes matched. The aggregate unit summaries rose by three despite eight new cases; the captured batch totals do not resolve that difference. Both new test files were included by the full runner, and their individual cases passed in focused testing. No inferred per-file or unique-test total is claimed.

Live mode: **live-two-client**, Chromium desktop at 1440×900. Root inspected both saved DM screenshots. Functionality 8, multiplayer integrity 8, craft 8, reach 4; weighted score **7.4/10**. This focused score is limited by no physical mobile keyboard, native macOS or WebKit test; Cmd shortcuts have unit coverage only. Existing mobile regression cases passed in the full suite. No new privacy behavior is claimed.

Raw evidence is in `output/interface-u3a-execution/hallway-hotkey-*`, including the reproduction, strict checks, focused run, two-client report, full gate report and boot record. Source remained unchanged during the full ladder. Scoped review outcomes are recorded in the execution ledger.

This repair is separate from U3a's Generate recovery correlation finding. U3a's
subsequent bounded repair is now verified and remains uncommitted pending its
[owner checkpoint](interface-clarity-u3a-checkpoint.md); the hotkey fix neither
accepts U3a nor starts U3b.

**2026-09-24 count correction:** the earlier reported 9,957 above is retained as
history. A read-only reconciliation found the omitted five-test summary at line 568
of `hallway-hotkey-r1-gate-test.log`: `apps/client test: ·      Tests  5 passed (5)`.
The old anchored parser missed the progress-dot prefix. All 84 actual client
summaries total 6,782 passes, giving **9,962 passes / 4 existing skips** with server
2,728 and shared 452. The eight-case increase over 9,954 is resolved. The raw old
report is unchanged; this is a corrected batch aggregate, not a deduplicated
per-file claim. Evidence: `output/interface-u3a-execution/postcap-unit-count-reconciliation.json`.
