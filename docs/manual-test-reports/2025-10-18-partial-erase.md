# Partial Erase Sync – Manual QA Checklist

Date: 2025-10-18  
Scope: Verify partial erase behaves correctly with two concurrent clients and remains undo/redo safe.

## Environment

- Launch the dev server (`pnpm dev`) so both the API and client are live.
- Open two isolated browser profiles or windows (Client A and Client B). Sign both into the same room using the default QA password.
- Ensure neither profile carries cached state from earlier tests (Incognito/private windows help).

## Test Steps

1. **Baseline snapshot**
   - On Client A, open the developer console and confirm `window.__HERO_BYTE_E2E__?.snapshot?.drawings` is defined.
   - Repeat on Client B. Record the initial drawing count in this document.

2. **Create source drawing**
   - Client A: open Draw Tools, select Freehand, draw a horizontal stroke across the center of the map.
   - Wait for the stroke to appear in QA logs (`drawings.length` increases) and record the new drawing id (from `__HERO_BYTE_E2E__`).
   - Confirm the same id appears on Client B. If it does not within 5 seconds, note the failure and abort the run.

3. **Partial erase from owner**
   - Client A: switch to the eraser, drag vertically across the middle of the stroke.
   - Watch both clients:
     - Original drawing id disappears.
     - Two replacement freehand segments appear.
   - Record the new segment ids on each client. They must match and there should be no stale original id.

4. **Undo propagation**
   - Client A: press Undo in the Draw Tools panel.
   - Confirm both clients show the original stroke restored and segments removed.
   - Record the timestamp and state.

5. **Redo propagation**
   - Client A: press Redo.
   - Confirm both clients switch back to the split segments (original id absent).
   - Record any lag or mismatches.

6. **History cleanup**
   - Client A: press Undo twice to return to the pre-test state.
   - Confirm both clients now have the original baseline drawing count from Step 1.

## Expected Results

- Each step updates both clients within ~2 seconds.
- There are no orphaned selections and undo/redo leaves history consistent.
- No console warnings or network errors appear on either client; server logs stay clean.

## Observed Results

- Record outcomes, timestamps, and any anomalies here.
- Attach screenshots or console logs as needed.

## Follow-ups

- Note any defects discovered.
- If all steps pass, mark the `Manual QA with two clients (erase + undo/redo sync)` task as complete in TODO.md.
