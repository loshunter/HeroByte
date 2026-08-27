# Initiative → server-side rolls, in the roll log, with a manual override

Owner-chosen design, 2026-08-14 (HANDOFF-NEXT §3D). Planned 2026-08-18 against `dev` =
`bada72e0`. Every path below was read, not assumed; where something is a judgement call it says
so.

## 1. What is wrong today

Two client-side `Math.random()` callers decide initiative, and the server accepts whatever number
arrives:

- `apps/client/src/hooks/useBulkInitiativeRoll.ts:76` — `Math.floor(Math.random() * 20) + 1`, once
  per NPC, in a loop that yields every `RATE_LIMIT_SAFE_BATCH` rolls so the limiter does not eat
  the tail.
- `apps/client/src/features/initiative/components/InitiativeModal.tsx:63` — the same expression for
  a single character.

`{ t: "set-initiative" }` carries the RESULT. `InitiativeMessageHandler.handleSetInitiative`
(`apps/server/src/ws/handlers/InitiativeMessageHandler.ts:63`) checks ownership and stores it
verbatim. **Correcting §3D's older claim once more:** this is not a DM-only path —
`EntitiesPanel.tsx` passes `onInitiativeClick` unconditionally, so a player opens the same modal
for their own character, and the SERVER is what enforces ownership.

The result: nobody at the table can see an initiative roll happen. It is not a security hole —
manual entry is a deliberate feature — but it is the one roll in HeroByte that the roll log never
witnesses, and it is the last `Math.random()` in a rules-bearing path.

## 2. The shape

**Rolling moves server-side and lands in the roll log.** A new `{ t: "roll-initiative" }` carries a
`characterId` and NOTHING else. The server rolls d20 on `cryptoDiceRng` — the one RNG caller,
`apps/server/src/domains/dice/roller.ts:30` — adds the character's stored `initiativeModifier`,
writes the initiative, and appends a `DiceRoll` to `state.diceRolls` so the table sees it.

**This must follow the dice rule or it reintroduces arc defect D2.** `{ t: "dice-roll" }` carries a
FORMULA, never a result, because a client-built roll shape is exactly what made dice forgeable
(`packages/shared/src/index.ts:189`, and the `DiceService` header comment at
`apps/server/src/domains/dice/service.ts:6-16`). `roll-initiative` carries neither a formula nor a
result — just the target — which is strictly safer than both.

**Manual override stays, because it is the point.** A bad roll, the DM allows a physical re-roll,
the real number goes in by hand and is recorded as that player's roll. So `{ t: "set-initiative" }`
survives as the MANUAL path, and the log line it produces is marked as manual rather than dressed
up as a server roll.

**The superseded value is struck through**, reusing `DiceRoll.breakdown[].dropped`
(`packages/shared/src/index.ts:207`) — the channel advantage/disadvantage already renders as a
strike-through. An override of a previous roll emits a breakdown entry with `rolls: [entered]` and
`dropped: [superseded]`. No new rendering work, and the roll log stays one shape.

**The override is a DM-toggleable table setting, ON by default.** `set-player-props-enabled` is the
exact template to copy: a message
(`packages/shared/src/index.ts:863`), a `RoomState` field
(`apps/server/src/domains/room/model.ts:64`), a snapshot field, persistence in both
`StatePersistence.ts` and `SnapshotLoader.ts`, and a validator. Note the one difference: props
default to **false** and this defaults to **true**, so every default and every `=== true` coercion
inverts to `!== false`. Get that wrong and the feature silently ships off.

## 3. Commits, in dependency order

1. **shared** — `roll-initiative` and `set-initiative-manual-override` message types; the
   `initiativeManualOverride?: boolean` snapshot field. Read §7 of HANDOFF-NEXT before adding any
   shared constant: an `export const` in the barrel is erased for the server at runtime and every
   gate stays green while `pnpm dev` cannot boot.
2. **server: the roll** — `InitiativeMessageHandler.handleRollInitiative`, taking a `DiceService`
   and an injectable `rng` defaulting to `cryptoDiceRng`, exactly as `DiceService.rollFor` does so
   a golden seed can pin the sequence. Ownership check identical to `handleSetInitiative`.
3. **server: the toggle** — `RoomState.initiativeManualOverrideEnabled` defaulting **true**, the
   DM-only setter, persistence both ways, validator. **Expect the fixture ripple** — a new required
   `RoomState` field broke five server fixtures last time; use `/fix-fixture-ripple`, do not
   hand-edit.
4. **server: manual entry logs too** — `handleSetInitiative` appends its own `DiceRoll` marked
   manual, with `dropped` carrying the superseded value, and refuses a player's manual entry when
   the toggle is off (the DM is never blocked).
5. **client: single roll** — the modal's Roll button sends `roll-initiative`; its `Math.random()`
   goes. `InitiativeModal.test.tsx:692` **pins `Math.random()` as behaviour and must be rewritten,
   not deleted** — the replacement asserts the message, not a number.
6. **client: bulk roll** — `useBulkInitiativeRoll` sends ONE `roll-initiative-all`, DM-only, and
   the server loops. This deletes the batching-around-the-limiter machinery rather than porting it
   (§11 established the real bound was 500, not 20). Watch the single-flight trap: a count must
   ride ONE message, because N messages get dropped by the guard.
7. **client: the DM toggle + mobile surface** — desktop DM menu, and the phone's DM menu via
   `buildDMMenuProps`, which is the one bag→menu mapping both layouts share. Ship it in this slice
   (§8) and MEASURE it in a browser rather than computing it.

## 4. Traps this slice will hit

- **A new required `RoomState` field breaks five server fixtures** (§5). `/fix-fixture-ripple`.
- **`diceRolls` is ALREADY in `SNAPSHOT_LIMITS`** at 1000
  (`apps/server/src/middleware/validators/sessionValidators.ts:93`), so putting initiative in the
  roll log needs no new limits entry. **Any genuinely new collection would** — omit it and
  load-session crashes.
- **Default-true inverts every coercion.** `playerPropsEnabled` persists as `=== true`
  (`StatePersistence.ts:154`, `SnapshotLoader.ts:190`); this field must persist as `!== false` or a
  saved session comes back with the override silently disabled.
- **The 350-LOC guard.** `InitiativeMessageHandler.ts` is 260 today, so it has room, but check
  after `prettier --write` — formatting EXPANDS files.
- **Prove every test can fail** (§8). For the RNG swap specifically, a sabotage that changes the
  die size is more honest than one that changes a returned constant: the seeded-sequence assertion
  must fail for the right reason.

## 5. What this does NOT do

Initiative ORDER, turn advancement, and combat lifecycle are untouched — `getCharactersInInitiativeOrder`
and the turn handlers keep their current behaviour. Ending combat still deliberately does not clear
initiative (`InitiativeMessageHandler.ts:173-177`); that comment explains why and stays true.
