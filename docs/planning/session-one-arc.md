# Session One — the table runs a whole game without leaving it

**Status:** S0–S4 SHIPPED. S0–S3 are deployed to production (dev→main `1dc00e00`, 2026-08-04);
S4 (token nameplates + HP bars + DM monster-HP redaction) is on `dev`, CI green, awaiting the next
deploy. Two slices grew beyond plan under adversarial review: S3's reclaim became
condemn/resurrect/expire (grace-windowed deletion, `HEROBYTE_ASSET_RECLAIM_GRACE_HOURS`) and its
quota fossil is now statfs-derived; S4 closed a pre-existing hole where any player could rewrite
any character's HP. Next: S5 (honest dice). Runs before the damage loop, mobile authoring, and the
Atlas.

**Thesis.** The hardest thing is built — live on-table authoring, server-compiled scenes with real
wall collision, per-recipient fog filtering with contract-test proof. What is missing is the part
of a VTT that is not a map. A group cannot type a word to each other, cannot upload a face, cannot
tell Goblin 3 from Goblin 5, and can forge a d20. This arc buys the most "the session actually ran"
per day of work, and most of it re-wires machinery that already exists.

Every claim below was verified against the code, then re-verified by an adversarial pass that found
12 errors in the first draft. Where something is unverified, it says so.

---

## 0. Read this first

- **`main` IS production.** Pushing it auto-deploys server → Render, client → Cloudflare Pages.
  Branch off `dev` as `feature/<scope>-<description>`; PRs target `dev` (`CONTRIBUTING.md:30-32`).
  Commit style on `dev` is Conventional Commits (`feat(ui):`, `fix(auth):`, `docs:`).
- **Production is on a PAID Render plan with a persistent disk** (`DEPLOYMENT.md:12-21`). No idle
  spin-down; all four on-disk stores are durable. Notes elsewhere about the free tier's ephemeral
  filesystem describe a self-hosted copy, not this deployment.
- **`dev` is ahead of `main`.** iPhone-verified mobile touch work (drawing + marquee select) is on
  `dev` and NOT deployed.
- **Verify before asserting.** This repo punishes confident claims from partial reads. An absence
  is not evidence; exit 0 is not a pass; read the file.

## 1. Running it

```bash
pnpm install
pnpm dev          # client http://localhost:5174, server http://localhost:8787
```

Table password `Fun1`, DM password `FunDM`. The default table is the public "Main Hall".
DM elevation from a console: `window.__HERO_BYTE_E2E__.sendMessage({ t: "elevate-to-dm", dmPassword: "FunDM" })`
— that hook exists only in dev/test builds (gated on `import.meta.env.MODE !== "production"`).

`pnpm dev` also sets `HEROBYTE_DEV_ALLOW_LAN=true`, so a phone on the same Wi-Fi can reach the
Network URL Vite prints. See `DEVELOPMENT.md`.

## 2. The verification gate

**Build first. This is not optional and it is the single easiest way to waste an hour.**

```bash
pnpm build                                  # MUST precede typecheck and test
pnpm typecheck && pnpm lint && pnpm lint:structure:enforce && pnpm format:check
pnpm test
pnpm --filter herobyte-client build:check   # 175KB gzip entry guard (currently ~86KB)
pnpm test:e2e                               # projects: chromium + mobile-chromium
```

**Why build first.** `packages/shared/dist/` is gitignored and untracked, and the two halves of the
monorepo resolve `@herobyte/shared` differently: `apps/server/tsconfig.json:17` maps it to
`packages/shared/dist/index.d.ts`, while `tsconfig.base.json:11` (which the client uses) maps it to
`packages/shared/src`. So a new shared type is **visible to the client and invisible to the server**
until `pnpm build` runs. `pre-push-check.sh:9` and CI both build first for exactly this reason.
S2, S5 and S7 all add to `packages/shared/src` — rebuild after every edit there.

**Single test, not the whole suite** (6,753 unit tests, 331 files — the full run is minutes):

```bash
pnpm --filter herobyte-client exec vitest run src/path/to/file.test.ts
pnpm --filter vtt-server exec vitest run src/path/to/file.test.ts
pnpm test:e2e --project=mobile-chromium --grep "some name"
```

**E2E mechanics.** E2E boots its _own_ stack on 5175/8788 (a freshly built client served by vite
preview), so `pnpm dev` can stay running on 5174/8787. Note: `pnpm test:e2e -- <filter>` is WRONG
despite what `EXECUTION-HANDOFF-2.md:106` says — the `--` reaches Playwright as a literal argument
and you get `Error: No tests found`. Omit it.

**Gotchas in the gate itself.**

- `pnpm lint:structure:enforce` is **NOT** part of `pnpm lint`. Run it separately.
- `pnpm lint` _does_ include `lint:frozen`, a sha256 gate over
  `apps/client/src/features/map-studio/__tests__/terrainRenderParity.frozen.test.ts`. Nothing here
  should touch it; if it trips, you changed terrain render output — fix the product code, never the
  frozen test.
- The 350-LOC guard scans `apps/` and `packages/` only and fails only on **new** violators. It
  will not stop an already-flagged file from getting worse, and it keys on the exact repo path — so
  renaming a baselined file makes it a new violator.
- `prettier --write` expands files. Re-check LOC after formatting.
- On Windows (the owner's environment) `kill -9` does not exist — use `Stop-Process -Force` or the
  repo's `kill-windows-port.bat`.

**Known-failing on `dev`, pre-existing, NOT yours.** `apps/e2e/comprehensive-mvp.spec.ts:33`
"Authentication Flow" — and note this is a **wrong test**, not an app defect: it asserts the
password field clears after a rejected attempt, which the gate does not do by design. It is not in
the 4-spec CI smoke set. `shadowTint.test.ts` and `staging-zone-visual.spec.ts` are load-flaky;
both pass in isolation.

**CI** (`.github/workflows/ci.yml`, every push/PR to `dev` and `main`): lint → format:check →
structure guard → build → typecheck → bundle size, then unit tests on Node 18 and 20, then a 4-spec
e2e smoke. The full e2e suite runs nightly. ~4 minutes.

## 3. The defects this arc fixes

All verified in code.

| #   | Defect                                                                                                                                                                                                                                                                                                        | Where                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D1  | **No text chat exists at all** — no `chat` type in the wire protocol, no handler, no UI                                                                                                                                                                                                                       | `packages/shared/src/index.ts`                                                 |
| D2  | **Dice are forgeable** — the handler receives only `(state, roll)` and never learns the sender; the validator length-checks `playerUid` and `playerName` and accepts any finite `total`, all stored verbatim                                                                                                  | `DiceMessageHandler`, `roomValidators.ts`, `domains/dice/service.ts`           |
| D3  | **`HEROBYTE_DATA_DIR` fails silently** — `dataDir \|\| ""`, no log, no boot assertion                                                                                                                                                                                                                         | `apps/server/src/config/serverPaths.ts`                                        |
| D4  | **Room state is written non-atomically**, and the loss is permanent: a truncated file makes `JSON.parse` throw, the catch only logs, `setState` is never called, the room stays empty — and then saves over the file                                                                                          | `StatePersistence.ts` (compare the tmp+rename in `domains/assets/service.ts`)  |
| D5  | **Combat state is dropped on restart** — load reads it, save omits it as "session-specific"; `VISION.md:163` calls persisting it a launch gate. Caveat: it DOES survive the explicit session export/import path (`SnapshotLoader.ts`), so a passing round-trip test is not evidence                           | `StatePersistence.ts`                                                          |
| D6  | **A 5-minute lid-close deletes your tokens** — and the same call passes `removePlayer: true`. NPC tokens are owned by the placing DM's uid, so a DM timeout can take the monsters with it                                                                                                                     | `HeartbeatTimeoutManager.ts`                                                   |
| D7  | Rate limiting is keyed on a **client-supplied uid** and there is no per-IP logic. The limiter lives in `MessagePipelineManager` (constructed in `container.ts`); `ConnectionLifecycleManager` is only where the uid is read from the query string. Auth runs a sync ~30ms `scryptSync` on the one Node thread | `MessagePipelineManager.ts`, `ConnectionLifecycleManager.ts`, `authCrypto.ts`  |
| D8  | **No player-facing image upload.** Exactly ONE file input in the whole client picks an image and pushes it through `/assets` (`MapEditAssetPicker`, DM-only). The other three are JSON. The `/assets` pipeline itself is built, room-credential gated, MIME-sniffed, quota'd and rate-limited                 | `apps/server/src/http/routes.ts`, `features/map-studio/uploads/assetUpload.ts` |
| D9  | Tokens have **no name and no persistent HP**                                                                                                                                                                                                                                                                  | `TokensLayer.tsx`                                                              |
| D10 | Vision has **no radius**; fog has **no memory**                                                                                                                                                                                                                                                               | `packages/shared/src/visibility.ts`, `FogLayer.tsx`                            |
| D11 | Measurement is **Euclidean** — a 2-square diagonal reads "2.8 Squares (14 ft)" where 5e says 10                                                                                                                                                                                                               | `MeasureLayer.tsx`                                                             |

D3–D6 bite while nobody is watching. Ship them first, alone.

## 4. Cross-cutting rules for this arc

- **A new `ClientMessage` type is rejected unless you register a validator.** `validateMessage`
  looks the type up in `messageValidators` and returns `Unknown message type: <t>` otherwise
  (`apps/server/src/middleware/validation.ts:266-272`). Applies to S2 and S5.
- **Never trust a client-supplied identity.** D2 exists because the server stored a client's
  `playerUid`. Bind the author from the connection — in chat (S2) and dice (S5) alike.
- **Enforce secrecy in the snapshot filter, not the renderer.** Hidden HP, private rolls and
  whispers must never serialize to a client that should not see them. The per-recipient pattern is
  already proven in `domains/room/model.ts` and `scene/visionFilter.ts`; reuse it and add a
  contract test.
- **Files sitting just under the 350-LOC guard that this arc touches** — unprotected, so crossing
  350 fails the build: `apps/server/src/domains/room/model.ts` (**345**, S2 touches it),
  `apps/client/src/components/dice/RollLog.tsx` (**317**, S2 adds a tab).
  Already over and baselined (extract rather than grow): `TokensLayer.tsx` (~807, S4),
  `PlayerSettingsMenu.tsx` (629, S3), `MapBoard.tsx` (~817, S4).

## 5. Slices

**S0 and S1 land and deploy on their own, before anything else.**

### S0 🔴 — Don't lose the table (~1 day)

**Goal.** A redeploy, a crash, or a bathroom break never costs you state.

**Changes.** Log the resolved data dir at boot; refuse to start in production when
`HEROBYTE_DATA_DIR` is unset (D3). tmp+rename in the two stores that lack it —
`domains/room/persistence/StatePersistence.ts` and `domains/auth/secretPersistence.ts` — copying
the asset store's pattern (D4). Persist `combatActive`/`currentTurnCharacterId` (D5). Change the
heartbeat timeout to keep tokens (D6). **Fix the SIGTERM handler, not SIGINT** — `index.ts:157-164`
registers only SIGTERM, that is the signal Render sends, and its `server.close(cb)` callback never
fires while a WebSocket is open. Flush behind a hard timer.

**Tests.** Truncated-state-file recovery; save/load round-trip asserting combat survives a
_restart_ (not the session export path, which already works); a timeout test asserting tokens
persist.

**Done when.** Start the app, `Stop-Process -Force` mid-session, restart — initiative and every
token are where you left them.

**Traps.** `saveState()` runs on every broadcast; the atomic rename must not become a hot-path
bottleneck — keep the existing write-queue serialization. Checking in `render.yaml` does **not**
make a dashboard-created Render service read it; that needs a Blueprint conversion. Do the
boot-time assertion regardless — it is the part that actually protects you.

### S1 🔴 — One stranger can't freeze the table (~1–2 days)

**Goal.** The public Main Hall cannot be used to stall a private game.

**Changes.** A per-IP token bucket checked before any `verify()`. Switch `scryptSync` to async
`scrypt`. Set `maxPayload` on the `WebSocketServer` (ws defaults to 100 MiB; the inbound guard
today is a 1 MB application-level check, not a socket limit). Sample or env-gate the broadcast
metrics logger so real errors are not buried.

**Done when.** A loop of wrong passwords from one host leaves broadcast latency in another room
unchanged.

**Traps.** The HTTP path cannot see a remote address as written — `index.ts:52-86` synthesizes the
Hono `Request` from headers and URL only, so `req.socket.remoteAddress` never reaches the handler;
you must propagate it (and behind Render, trust `x-forwarded-for`). Making scrypt async ripples
through `AuthService.verify`, `verifyDMPassword` and `compareSecret`, all currently synchronous —
that is most of the slice's cost, so size it at 1–2 days, not half. The WS path _does_ already
rate-limit before auth, just keyed on the client-supplied uid.

**Explicitly NOT.** Signed session tokens — `uid` stays client-asserted; that belongs to a later
identity arc.

### S2 🟡 — People can talk in the app (2–3 days)

`{ t: "chat"; text: string; to?: string }`, **with a registered validator** (see §4). The server
binds the author from the connection. Filter per recipient; bounded ring buffer beside the roll
log; render as a second tab in the existing roll-log panel so mobile gets it via the dock button it
already has.

**Tests.** A secrecy contract test: a whisper to A never appears in B's payload. Length caps and
sanitisation on the way in.

**Done when.** A player with a dead mic can still play a whole session.

**Traps.** There is **no outbound snapshot size limit** to respect — the only guard is a 1 MB
_inbound_ message check. Cap history because it is right, not because something enforces it.
`model.ts` is at 345 LOC and `RollLog.tsx` at 317; both are unprotected.

### S3 🟡 — Your own face, from your own disk (2–3 days)

One shared `<ImageField>` (file picker + URL fallback + the existing upload error codes) in player
settings, the NPC editor, the prop editor, and the map background control. `/assets` is
room-credential gated, not DM-gated, so a plain player already qualifies.

**Done when.** Nobody is told to go use Imgur.

**Now also in this slice** — folded in 2026-08-02, see §7.3. Self-hosting becomes the default, so
the two things that made that unsafe move from "note it" to "fix it":

- **Reclaim orphaned assets on re-publish.** Replacing an image leaves the old bytes claimed by
  the room forever. Room-clear already reclaims correctly (`releaseRoom` → `planRoomRelease`
  un-claims and deletes on the last claim); what is missing is the same treatment when a
  reference is _replaced_ rather than the room cleared. Four new upload surfaces make this leak
  four times faster, which is why it can no longer be deferred.
- **Raise the whole-store quota.** `domains/assets/service.ts` defaults `maxTotalBytes` to 200MB
  and says so in the comment: "the free-tier number". It is a fossil of the same ephemeral-disk
  era that produced the Imgur decision. Production runs a 1GB disk holding 196KB. Re-derive both
  it and `maxRoomBytes` (50MB) from the real disk, and make them env-overridable so the ceiling
  tracks the disk instead of a plan HeroByte no longer runs on.

**Traps.** **Progress reporting is not free** — `assetUpload.ts` uses `fetch` with an ArrayBuffer
body and `fetch` exposes no upload-progress event; either drop progress or switch to
`XMLHttpRequest`. `PlayerSettingsMenu.tsx` is 629 LOC and its image fields are _controlled_ props
owned by the parent, so this is not a drop-in. Keep the URL field **permanently**, not as a
transition: it is the escape valve when a room hits its quota and how a DM reuses art already
online. A direct `i.imgur.com/…` link never touches the Imgur API (`imageUrlHelpers.ts:24`), so
accepting Imgur URLs costs nothing — it is only the album/gallery API path that carries risk.

### S4 🟡 — Tokens have names and health (2–3 days)

A nameplate below each token and a thin HP bar. A per-room DM setting for monster HP display
(exact / bloodied / hidden), enforced server-side in the snapshot filter.

**Done when.** A screenshot of a five-goblin fight is legible and a player cannot read a hidden
monster's HP from the wire.

**Traps.** `hpByTokenId` carries **current HP only** — there is no maxHp in it, so no ratio bar can
be drawn without also editing `MapBoard.tsx` (~817 LOC) where the map is built. Players must see
only what the vision filter already gave them — do not add a new privacy path. Extract the label
and bar into their own module; `TokensLayer.tsx` is ~807 LOC and renaming it would make it a _new_
guard violator.

### S5 🟡 — Honest dice (3–4 days)

Move evaluation server-side: the client sends a formula, the server rolls, computes the total, and
stamps `playerUid`/`playerName` from the connection. Add `visibility: "public" | "dm" | "self"` and
filter in the snapshot. Advantage/disadvantage first-class; a few saved macros.

**Tests.** Golden-seed determinism; a **forgery test** (client sends `total: 999` and another
player's uid → the server's numbers and the server's author win); a private-roll secrecy test.

**Done when.** Devtools cannot change a roll, its total, or its author.

**Traps.** The dispatcher does not pass the sender uid into the handler — a signature change. The
test that pins the old shape is `apps/server/src/ws/__tests__/messageRouter.test.ts:847`
(`expect(mockDiceService.addRoll).toHaveBeenCalledWith(mockState, roll)`), **not** in the
characterization folder. The client half is larger than it looks: the client's roll model is a
structured token array and `formula` is only a display string built in `useDiceRolling.ts`, so
"send the formula" means designing a wire format first. Size accordingly.

### S6 🟡 — Distance and templates the table agrees on (2–3 days)

A per-room diagonal rule (5e every-square / PF alternating / Euclidean) in **one shared function**.
Broadcast the active measurement so the table sees the same line. Circle/cone/square/line templates
that snap to the grid and reuse the drawing render path.

**Done when.** "Is Grak in it?" is answered by looking.

### S7 🔴 — Darkness that is dark, and a dungeon you remember (4–5 days, largest)

Add an optional `radius` and clip the polygon **in the one shared visibility function**, so client
fog and server filtering stay identical by construction — that invariant is what makes fog
trustworthy. Per-token `visionRadius` defaulting to unlimited so nothing regresses. Explored fog as
a per-player accumulated union, dimmed rather than black.

**Tests.** A parity test that client and server compute the same polygon for a radius-limited
viewer; a regression test that unlimited radius reproduces today's polygons exactly.

**Traps.** **Vision polygons are CACHED on both sides and neither cache key includes a radius** —
the server caches under `visionSignature(state, uid)` in `messageRouter.ts:517`. Change the radius
without changing the signature and you will get stale vision that looks like your maths is wrong.
Fix the cache key first. If persisting a per-player visibility grid grows the snapshot, ship
explored fog **client-local** (accumulate in the browser, localStorage) and defer server-side
memory fog. Do not let this become a persistence arc.

### S8 🟢 — Staging an encounter, and finding the manual (2 days)

Duplicate-NPC and add-×N (one loop over `create-npc`, auto-numbered). A `?` in the header opening
an in-app help panel.

**Done when.** Adding five goblins takes five inputs.

**Trap.** `docs/user-guide/` is **outside** `apps/client`, which is what Cloudflare Pages builds,
and its `img/` is ~4.7 MB. "Link into the guide" has no asset path today — either link out to the
GitHub-hosted copy, or copy a subset into `apps/client/public` and accept the bundle cost. Decide
before starting.

## 6. Explicitly NOT in this arc

Character sheets, creature templates, the bestiary, the damage loop. Multi-scene `SceneState` and
map switching. The Atlas, generation recipes 2–5, `.htcart`, accounts, invite tokens, billing.
Mobile map authoring (`mobile-authoring-arc.md` M4–M8). A mobile DM menu. Redis-as-default or
Postgres. Signed session tokens. The 50×6 load test. Any new terrain family, prop kit or mood
palette.

## 7. Decisions — ANSWERED by the owner 2026-08-01

1. **Launch is a friends-scale soft launch.** Invite-shaped: the Main Hall stays a public demo,
   real play happens in forked private tables. The threat model is "people I invited", which the
   existing scrypt + per-room-secret design holds against. So S1 is sufficient for launch, and
   signed session tokens, report/ban tooling and per-IP hardening beyond S1 stay in a later
   identity arc rather than jumping the queue.

2. **Touch map painting is IN launch scope.** `VISION.md:46` wins;
   `live-map-toolbar-plan.md:44`'s "desktop-only — explicit decision" is struck through and
   annotated as overturned. The owner's framing: _"as featured as possible within the
   limitations."_ See §7a.

3. **Self-hosted images become the default; Imgur stays supported, never required.** (Decided
   2026-08-02, after S0+S1.) The original choice was made on the free tier, where the filesystem
   was ephemeral and an external host was the only way an image survived to the next session.
   The persistent disk now does that job better — and Imgur is no longer good at the one thing it
   was chosen for, having purged anonymously-uploaded images (announced April 2023, effective
   that May); "go upload it to Imgur" without an account _is_ an anonymous upload.

   Verified before deciding: **zero** Imgur URLs, `/assets` URLs or data-URIs in any of the four
   production state files or the fifteen local ones, so there is no content to migrate — this
   changes the default going forward, not the past. What exists is integration code
   (`imageUrlHelpers.ts`, `useImageUrlNormalization.ts`, the CSP allowlist in `_headers` and
   `index.html`, the README guidance), not a corpus.

   **Keep:** accepting any image URL, including direct `i.imgur.com` links, and the CSP entries
   that let them render. Costs nothing, and it is the escape valve above a quota.
   **Stop:** telling people to go use Imgur (README §troubleshooting, the user guides).
   **Do not build on:** the Imgur **API**. `imageUrlHelpers.ts:51` calls `api.imgur.com` with a
   hardcoded client ID shipped in client-side code — one shared key for every user of the app,
   subject to Imgur's per-client rate limits and revocable at any time, whose failure mode is a
   silent fall back to guessing `.jpg`. That path only serves album/gallery convenience links;
   direct links bypass it entirely.

   What Imgur still genuinely buys — free bandwidth, no moderation exposure — is real but is not
   the binding constraint at friends-scale, and `/assets` already serves
   `immutable, max-age=31536000` with content-addressed dedup, so a shared token costs one copy
   on disk and one fetch per client for its lifetime.

### 7a. What "as featured as possible within the limitations" means for this arc

Mobile is no longer a viewing client, so **every slice here ships its mobile surface in the same
slice — not as a follow-up.** Retrofitting a mobile path later is how the drawing toolbar ended up
with six of ten controls off-screen. Concretely:

- S2 chat renders as a second tab in the existing roll-log panel, so the mobile dock gets it free.
- S3 upload must accept a phone's camera roll, not just a desktop file picker.
- S4 nameplates must stay legible at 375px, not just on a 1440px canvas.
- S6 templates and S7 vision are canvas-side and work on touch already via the gesture router —
  but any new _control_ they add needs a mobile home.

The mobile authoring arc itself (`mobile-authoring-arc.md` M3–M8) is now a launch commitment and
runs **after** this arc, for one reason: it improves _authoring_ on a table that still cannot chat,
upload a face, or read a token's name. Fix the game, then finish the port. The touch event layer it
depends on is already built and iPhone-verified.

Interpretation to confirm if it matters: "within the limitations" reads as _support both form
factors, degrade gracefully_ — the full palette on a tablet, and on a phone the paint/room/wall
subset that actually fits, with the genuinely hostile surfaces (brush-deck search, the six-field
inspector, Generate's region aim) left tablet-and-up. That is a design stance, not a quote.

## 8. Method that works in this repo

- **Adversarial review before declaring done.** Fan out independent reviewers over the diff by lens
  (correctness / regression / security / test quality), then have a separate pass try to **refute**
  each finding and drop what does not survive. On the mobile arc this turned 20 raw findings into 7
  real ones — every one in code already called done. On the first draft of _this document_ it found
  12 errors.
- **Prove a test can fail.** Break the fix and watch it go red before trusting it. Two bugs in the
  mobile arc were found only this way; a third hid behind a test passing for the wrong reason.
- **Measure in the browser; do not compute.** Layout arithmetic was directionally right and
  specifically wrong more than once.
- **Synthetic DOM events are not enough** for canvas work — they proved a guard passed while hiding
  two real bugs that trusted CDP events caught. Use `Input.dispatchTouchEvent` via CDP; helpers
  exist in `apps/e2e/mobile/touch.helpers.ts`.
- **New touch specs go in `apps/e2e/mobile/`.** That project is scoped by `testDir`, deliberately
  not `testMatch` (a project-level `testMatch` would override the docs config's own).
- **Review agents are read-only.** A past run left a mutation probe in the tree. Audit
  `git status` after any errored workflow; verdicts from an errored run are void.
