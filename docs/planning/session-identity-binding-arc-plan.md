# Session identity binding — slice plan (SECURITY)

> **STATUS: BUILT on `dev` 2026-09-19 (S1–S4, five commits from `cc5cf6a0`), NOT merged to
> `main`.** See §12 for what actually shipped, where it deviates from this plan and why, and
> the owner confirm items. Original header follows.
>
> Written 2026-09-18 against `dev` = `main` = `40c1031b`.
> Every path/line below was read on that commit; treat line numbers as `≈` and re-verify
> the symbol before editing (files at the 350-LOC ceiling get re-wrapped by prettier and
> drift). This closes a **proven, live** privilege-escalation hole. Read
> `docs/planning/HANDOFF-NEXT.md` §2/§5/§7/§8 and the two review skills first — the gate,
> the traps and the owner's method all apply and are not repeated in full.
>
> **This arc merges to `main` as ONE `--no-ff` cutover, not slice-by-slice.** A half-applied
> auth change is worse than none: shipping S1 alone advertises a token the server does not
> yet require; shipping S2 without S3 leaves the connect-time hole wide open. All slices land
> on `dev`, pass the full ladder together, then merge once. See §0.

---

## 0. How to execute this plan (read first)

- **One person owns the whole arc.** The connection lifecycle, the auth handler and the
  client reconnect path are a single coupled system; splitting them across devs will
  reintroduce the connection-war bug ([[private-rooms-feature]]).
- **Each slice is its own commit(s) and goes through the full gate** (`/verify-gates` with
  `boot` and `e2e`). But **do not push `main`** until §8's ladder is green end to end.
- **`main` IS production** ([[herobyte-deploy-model]]): pushing `main` auto-deploys Render +
  Cloudflare, CI does not gate the push. So the cutover is deliberate and probe-verified.
- **HeroByte rule overrides the generic "don't fix nearby bugs":** any real bug found mid-arc
  is fixed in its own commit, sabotage-proven ([[fix-bugs-regardless-of-origin]]). But keep
  the *scope* of this arc to identity binding — the deferred items in §9 are recorded, not
  licensed.
- **Prove every new test can fail** before trusting it, and prove a strengthened assertion
  can still **pass** ([[verify-before-asserting]]). A security test that is vacuously green is
  worse than none here.
- **Do NOT run `prettier --write` on this file or any `docs/**`** — nothing under `docs/`
  is gated and prettier corrupts markdown here (`SECURITY_REQUIREMENTS` underscore trap,
  [[herobyte-build-conventions]]). Hand-edit; CAPS-with-underscores go in backticks.

---

## 1. The vulnerability

**Severity: HIGH (privilege escalation + session takeover + griefing DoS).** Not the usual
"AI-built app" nightmare — the server is otherwise well hardened — but one real, exploitable
class of hole.

**Root cause, one sentence:** a client's identity (`uid`) is read raw off the WebSocket
query string and bound to no secret, yet **authentication state and DM authority are keyed on
that `uid` alone**, so anyone who can reach a table can adopt another connected member's
identity — including the DM's — with **zero passwords**.

### 1.1 The proven exploit (live PoC, isolated server, real scrypt passwords)

A legit DM "dave" joins with the room password + DM password. Then an attacker:

1. Reads dave's `uid` off the wire — the snapshot roster ships every `{uid, isDM}` to every
   client.
2. Opens a WebSocket with `?uid=dave` and sends **nothing else**.
3. The server closes dave's socket (`WS_CLOSE_REPLACED`) and, because the replaced connection
   *was authenticated*, **preserves the auth flag** and registers the attacker's socket as
   `uid=dave`. The attacker is now authenticated as dave without a password.
4. The attacker fires a DM-gated action (e.g. `start-combat`). The router resolves
   `isDM = players.find(p => p.uid === "dave")?.isDM === true` → the action executes. **Full
   DM takeover.**

Control run (the reassurance): a brand-new unauthenticated `uid` firing the same DM action is
correctly dropped. The room-password gate itself holds; the break is purely the impersonation
path.

### 1.2 Three distinct sub-issues (the fix must close all three)

- **A — Online takeover (the worst).** Connect-time adoption confers the incumbent's auth
  (incl. `isDM`) to any socket claiming their `uid`. No message needed.
- **B — Passwordless re-auth short-circuit.** `AuthenticationHandler.authenticate` returns
  `auth-ok` for an already-authenticated `uid` with no password check
  (`AuthenticationHandler.ts:96`). Secondary to A (A already hands the attacker the socket),
  but must also be gated.
- **C — Offline DM re-inherit + whisper confidentiality.** `player.isDM` persists on the
  player record across disconnect and restart (`StatePersistence.ts:134`). Anyone with the
  room password who claims an **offline** DM's `uid` re-inherits their record *including* DM.
  The same uid-claim also receives that player's whispers/private rolls (the limitation
  already documented at `recipientFilter.ts:66`, but framed there as confidentiality only —
  the live PoC shows it is privilege escalation).
- **D — Griefing DoS (found while planning, not in the transcript).** Connecting as `?uid=X`
  *unconditionally closes X's live socket* with `WS_CLOSE_REPLACED`, which the client treats
  as **terminal** (no auto-reconnect). So an attacker can kick any player or the DM off the
  table at will, and the victim will not come back until they manually reload.

### 1.3 Threat model (weigh it honestly — from owner decision, arc §7)

- **Private custom tables** (the real-play surface): a malicious *invited* player — someone
  handed the room password — can today become DM without the DM password, read others'
  whispers, act as them, and kick them. A total stranger cannot (needs the room password
  first; default uids are `crypto.randomUUID()`, unguessable). **This is what the arc closes.**
- **Public Fun1 / Main Hall:** its room + DM passwords are public **by design**
  ([[public-test-table]]). It stays open; blast radius is the intentionally-ephemeral
  sandbox. **Out of scope to "fix" — do not re-flag it.**

### 1.4 In scope / out of scope

**In:** bind identity to a per-session secret so that adopting a `uid`'s authenticated
session (its socket, its auth flag, its `isDM`) requires proof only that session holds. Close
A, B, D outright; close C's *privilege* half (no DM without proof).

**Out (recorded in §9, not licensed here):** C's residual confidentiality floor (a room-
password holder claiming a fully-offline uid still receives that uid's future whispers as a
non-privileged impersonator — needs opaque per-session identities, a later arc); removing raw
`uid`s from the wire; password-rotation session invalidation; the public table.

---

## 2. Verified facts (recon — re-verify anchors before trusting line-level claims)

Server (`apps/server/src`):

- **`uid` is client-supplied.** `ws/lifecycle/ConnectionLifecycleManager.ts:129-130` —
  `const uid = params.get("uid") || "anon"` from the connect URL. Client picks it:
  `apps/client/src/utils/session.ts` (`getSessionUID`, with a `?sessionUid=` override).
- **Connect-time adoption/eviction** (sub-issue A + D): `ConnectionLifecycleManager.ts:134-158`
  — closes the incumbent (`WS_CLOSE_REPLACED`) then `if (!wasAuthenticated) { clear auth }`,
  i.e. an authenticated incumbent's auth is **kept** and the new socket takes the `uid` slot.
- **Re-auth short-circuit** (B): `ws/auth/AuthenticationHandler.ts:86-107` — if
  `authenticatedUids.has(uid)` it refreshes the session and sends `auth-ok`, no password.
- **DM authority is a pure function of `uid`:** `ws/messageRouter.ts:602`
  (`players.find(p => p.uid === uid)?.isDM`), and the same shape at
  `domains/room/service.ts:205-206,256-257` (snapshot DM view) and the `isRecipientDM`
  helper.
- **`isDM` persists** (C): `domains/room/persistence/StatePersistence.ts:134`
  (`isDM: player.isDM ?? false`) and the load map in the same module.
- **Auth state lives in three shared maps on `Container`** (`container.ts:113-114`):
  `authenticatedUids: Set<string>`, `authenticatedSessions: Map<uid,{roomId,authedAt}>`,
  `uidToWs: Map<uid, WebSocket>`. Threaded by constructor into `AuthenticationHandler`,
  `ConnectionLifecycleManager`, `DisconnectionCleanupManager` (see `connectionHandler.ts:41-68`).
- **Cleanup clears auth on disconnect/timeout:** `ws/lifecycle/DisconnectionCleanupManager.ts:170-174`
  (`authenticatedUids.delete`, `authenticatedSessions.delete`, `uidToWs.delete`). Heartbeat
  timeout (5 min) routes through the same cleanup (`HeartbeatTimeoutManager.ts:91-97`).
- **Pre-auth message gate:** `ws/auth/MessageAuthenticator.ts:100-125` — `authenticate` and
  `create-room` are allowed pre-auth; everything else requires `authenticatedUids.has(uid)`.
- **Per-IP scrypt budget** is spent BEFORE hashing and refunded on success; the re-auth
  short-circuit is deliberately budget-exempt (`AuthenticationHandler.ts:116-118`). Preserve
  this: the token path does no scrypt and must stay exempt.
- **Room-password verify** is per-room with a default fallback and a constant-work timing
  guard (`domains/auth/service.ts`, `authCrypto.ts`). DM elevation is scrypt-verified +
  per-uid throttled (`ws/auth/dmElevation.ts`).
- **WSS origin allow-list** (`index.ts:153-158`, `verifyClient`) is a browser-only CSRF
  defense — a scripted client sets `Origin` freely. **Not authz.** Do not lean on it.

Client (`apps/client/src`):

- **Connect URL:** `services/websocket/ConnectionLifecycleManager.ts:197` —
  `` `${url}?uid=${uid}` ``. (This is where a URL token would go — we are NOT doing that, §3.4.)
- **Reconnect replays the password:** `services/websocket.ts` `reauthenticateIfPossible`
  (≈560-577) re-sends `lastAuthSecret`; `authenticate` (≈406-410) stores it;
  `handleAuthResponse` (≈515-535) clears it on `auth-failed`.
- **Auth message built at:** `services/websocket/AuthenticationManager.ts:121-131`
  (`ws.send(JSON.stringify({ t: "authenticate", secret, roomId }))`).
- **Auth-ok/failed handled at:** `AuthenticationManager.handleAuthResponse` +
  `websocket.ts handleAuthResponse`. Auth-ok is where the client must **capture** the token.
- **Terminal REPLACED handling:** `services/websocket/ConnectionLifecycleManager.ts:310`
  (`WS_CLOSE_REPLACED` → state REPLACED, no reconnect). A new 4003 code needs its own branch.
- **Per-table secret stash pattern to mirror for the token:**
  `features/rooms/roomDirectory.ts` (`ROOM_SECRET_STORAGE_KEY`, `roomSecretKey(roomId)`,
  `stashRoomSecret`/`readRoomSecret`/`clearRoomSecret`). The token is per-table for the same
  reason the secret is (§ trap 4).

Shared (`packages/shared/src`):

- Wire types: `authenticate` at `index.ts:1232`; `auth-ok`/`auth-failed` at
  `index.ts:1268-1269`; `dm-status` at `index.ts:1325`. `Player.isDM?` at `index.ts:365`.
- Close codes live in a **sub-module** `wsCloseCodes.ts`, value-re-exported from the barrel —
  **never `export const` in `index.ts`** ([[shared-barrel-no-runtime-const]]). A new code goes
  in `wsCloseCodes.ts`.
- Validators are server-side: `apps/server/src/middleware/validators/roomValidators.ts`
  (`validateAuthenticateMessage` ≈72-90), dispatched from `middleware/validation.ts:327`.

---

## 3. The design — decisions locked

### 3.1 The invariant we are establishing

> **An authenticated identity (a `uid`, its live socket, its auth flag, and above all its
> `isDM`) may be held only by a connection that proves possession of that session's secret
> token. A connection presenting a `uid` it cannot prove is treated as unauthenticated: it may
> not act with that uid's privileges, may not read that uid's private data, and may not evict
> that uid's live session.**

### 3.2 The mechanism: a per-session bearer token

- On a **successful password** `authenticate`, the server mints a 256-bit token
  (`crypto.randomBytes(32).toString("base64url")`), stores its **SHA-256 hash** (not the raw
  token) in a new `Map<uid, SessionTokenRecord>` where
  `SessionTokenRecord = { tokenHash: Buffer; roomId: string; issuedAt: number }`, and returns
  the **raw** token to the client in `auth-ok`.
- The client stores the raw token in `sessionStorage`, **keyed per table** (mirror
  `roomSecretKey`), and includes it on **every** `authenticate` (initial has none; every
  reconnect/re-auth includes it). Cleared on `auth-failed`.
- The server compares presented-token-hash against the stored hash with `timingSafeEqual`
  (equal-length buffers), and also checks the record's `roomId` matches the requested room
  (a token minted for table A must not authorize table B).

Why a token and not "re-verify the room password every time": the room password is **shared**
(every invitee has it; the public table publishes it). It cannot distinguish dave from an
attacker who also holds it. Only a per-session secret can. This is the whole point.

### 3.3 The three enforcement points

1. **Connect (`ConnectionLifecycleManager.handleConnection`)** — a newcomer must NOT adopt a
   `uid` that has a **live authenticated incumbent** (`authenticatedUids.has(uid)` &&
   `uidToWs.get(uid)?.readyState === OPEN`) until it proves the token via a message. It must
   NOT close the incumbent at connect. A **dead or absent** incumbent
   (`readyState !== OPEN`, or none) is replaced freely — this is the normal reconnect-after-
   blip path and MUST stay fast (see §3.4 why we cannot reject-on-incumbent).
2. **`authenticate` re-auth branch** — accept the passwordless short-circuit ONLY when a
   presented token matches the stored record; on mismatch/absence, do not confer auth and do
   not evict. This is also where a legit second tab / reconnect performs the **swap** (close
   the incumbent with `WS_CLOSE_REPLACED`, move the `uid` slot to the newcomer, keep auth).
3. **`authenticate` new-auth branch (password verified, reusing an existing player record)** —
   restore `player.isDM` from the persisted record ONLY if a matching token was presented;
   otherwise **reset `isDM = false`** (a tokenless reclaim gets the player's name/character
   but must re-elevate with the DM password) and mint a fresh token. Closes C's privilege half.

### 3.4 Settled by this plan — attacked in review, do NOT relitigate after

- **The token travels in the `authenticate` MESSAGE, never the connect URL.** A bearer token
  in a WS query string leaks to proxy/access logs, and it grants *more* than the room password
  (session takeover). This is a hard operating constraint ("never put sensitive data in URL
  params"). The cost is the small connect-time restructure in §5 S3 — accept it.
- **We do NOT "reject any second connection while a live incumbent exists."** That looks
  simpler but **regresses reconnect-after-blip**: the server can take up to the 5-minute
  heartbeat window to notice a dropped socket, during which the incumbent reads as "live", so
  a legit user's reconnect would be locked out for minutes. The current REPLACE machinery
  exists precisely to let a genuine reconnect evict a stale-but-not-yet-reaped incumbent
  *immediately*. We keep that — gated on the token.
- **Multi-tab semantics stay "last authenticated wins."** A legit second tab (same browser,
  same `sessionStorage` → has the token) authenticates, proves the token, and takes over; the
  old tab goes terminal-REPLACED exactly as today. An attacker (no token) cannot.
- **The cutover is naturally clean.** Deploy = server restart = in-memory
  `authenticatedUids`/`uidToWs`/`sessionTokens` all empty. Every client's reconnect replays
  its password (client already retains `lastAuthSecret`), hits the password path, and is
  minted a token. Players with a tab open must reload — the standing post-deploy note.
  **Correction (shipped, S3+round-2):** a live incumbent CAN exist without a token — every
  socket between connect and a completed `authenticate`, most visibly the post-deploy reload
  window when every token is gone. The original claim here was wrong. What holds instead is
  that §3.3's guard refuses to evict or impersonate ANY live incumbent — authenticated or not
  — without its token (`AuthenticationHandler` `liveIncumbent`), so the tokenless window is a
  UX bump (a reconnect whose own zombie is still live is turned away and self-heals on retry),
  not an exploitable hole.
- **`?sessionUid=` stays.** It is a dev/e2e seam and is no longer a privilege path once the
  token gates adoption.

### 3.5 Data-structure placement (do what the neighbors do)

Add `sessionTokens: Map<string, SessionTokenRecord>` to `Container` beside the existing three
maps (`container.ts:113-114`), and thread it by constructor into `AuthenticationHandler`,
`ConnectionLifecycleManager`, and `DisconnectionCleanupManager` — mirroring how
`authenticatedUids` is threaded (`connectionHandler.ts:41-68`). Put the mint/verify/delete
logic in a small `ws/auth/SessionTokenService.ts` (keeps `AuthenticationHandler`, already at
the 350-LOC edge, from growing — same split rationale as `dmElevation.ts`).

---

## 4. Invariants (every slice cites the ones it proves)

- **I1.** A socket may act with `uid`'s privileges only if `authenticatedUids.has(uid)` AND
  that socket is the one in `uidToWs.get(uid)`. (True today; do not weaken.)
- **I2.** A `uid` enters `authenticatedUids` only via (a) a verified room password, or (b) a
  verified session token. Never via connect alone.
- **I3.** A connection may evict/replace a live authenticated incumbent for `uid` only after
  presenting that session's token. A wrong/absent token neither evicts nor adopts.
- **I4.** `player.isDM` is restored on reconnect only under a valid token; a tokenless reclaim
  of an existing record yields `isDM = false`.
- **I5.** The token is never logged, never persisted to disk, never placed in a URL, and only
  its hash is held in memory.
- **I6.** Token lifecycle: minted on password auth; deleted whenever the uid leaves
  `authenticatedUids` (disconnect, heartbeat timeout, connection replace of the *old* record).
- **I7.** All existing multi-room isolation and whisper/roll secrecy contracts still pass
  unchanged (the token model is additive to them).

---

## 5. Slices

Each slice: build → `/verify-gates` (`boot` always — shared exports change; `e2e` from S3) →
commit to `dev`. Do **not** touch `main` until §8.

### S1 — Mint, carry, store the token (additive; enforcement DORMANT)

**Goal:** the token exists end to end and nothing yet depends on it, so this slice cannot
break a live client. Proves nothing on its own — it is scaffolding for S2/S3.

**Shared:**
- `wsCloseCodes.ts`: add `export const WS_CLOSE_SESSION_CONFLICT = 4003;` with a comment
  (non-terminal; "your token did not match, you did not take over"), re-export from the barrel
  via the existing `export { ... } from "./wsCloseCodes.js"` line. **Boot the dev server after**
  ([[shared-barrel-no-runtime-const]]).
- `index.ts`: `auth-ok` becomes `{ t: "auth-ok"; sessionToken?: string }`; `authenticate`
  becomes `{ t: "authenticate"; secret: string; roomId?: string; token?: string }`. Both
  fields **optional** → no required-field fixture ripple, but see §6 for the exact-match
  assertions that DO break.

**Server:**
- `middleware/validators/roomValidators.ts` `validateAuthenticateMessage`: accept optional
  `token` — reject non-string or `length > 512`. (A `ClientMessage` union member and its
  validator ship together — but here the member already exists, we only widen it, so no
  mapped-type break like the vision-default slice hit.)
- New `ws/auth/SessionTokenService.ts`: `mint(uid, roomId): string`, `verify(uid, roomId,
  token): boolean` (timingSafeEqual on SHA-256 hashes + roomId match), `revoke(uid)`.
- `container.ts`: construct `sessionTokens` map, expose it, pass to the handlers that need it.
- `AuthenticationHandler.authenticate`, on the **password-verified success path only**
  (after line ≈229): `const token = tokens.mint(uid, requestedRoomId)` and include it in the
  `sendAuthOk(ws, token)` payload. Do NOT gate anything yet. The re-auth short-circuit still
  fires as today (still a hole — closed in S2/S3).
- `DisconnectionCleanupManager.cleanupPlayer`: `sessionTokens.delete(uid)` beside the existing
  auth-map deletes (line ≈170-174). (I6.)

**Client:**
- `features/rooms/roomDirectory.ts`: add `SESSION_TOKEN_STORAGE_KEY` + `sessionTokenKey(roomId)`
  + `stashSessionToken/readSessionToken/clearSessionToken`, byte-for-byte mirroring the
  room-secret helpers (per-table scoping, try/catch on `sessionStorage`).
- `services/websocket/AuthenticationManager.ts`: `authenticate(ws, secret, roomId, token?)`
  includes `token` in the message when present.
- `services/websocket.ts`: keep `lastSessionToken` beside `lastAuthSecret`; pass it into
  `authManager.authenticate` from both `authenticate()` and `reauthenticateIfPossible()`.
  In `handleAuthResponse`, on `auth-ok` capture `message.sessionToken` → `lastSessionToken` +
  `stashSessionToken`; on `auth-failed` clear both.
- Read the stored token on first `authenticate` from `App`/`AuthenticationGate` (via
  `readSessionToken(getRequestedRoomId())`), so a page reload that still has the token in
  sessionStorage presents it. (This is what makes a reload a *token-proved* reconnect, not a
  fresh login — important for S3's UX.)

**Tests (must fail before the code):**
- shared: `authenticate` with a 513-char token rejected; 512 accepted.
- server unit: `SessionTokenService` mint→verify round-trips; wrong token, wrong roomId, and
  wrong uid all fail; verify uses constant-time compare (assert behavior, not timing).
- server: a password auth now emits `auth-ok` carrying a non-empty `sessionToken`; cleanup
  deletes the record.
- client: `authenticate` includes a stored token; `auth-ok` capture stashes it per-table;
  `auth-failed` clears it; switching `roomId` reads a different key.

**Gate:** `/verify-gates boot` (no e2e needed — no behavior change).

### S2 — Enforce on the `authenticate` path (close B and C's privilege half)

**Cites I2, I4.** Proves: a tokenless re-auth confers no privilege; a tokenless reclaim of an
offline DM's uid yields a non-DM player.

- `AuthenticationHandler.authenticate` **re-auth branch** (`:96`): only take the passwordless
  short-circuit when `tokens.verify(uid, sessionRoomId, message.token)` passes. On failure,
  fall through to the password branch (do NOT `auth-ok`). This branch still does no scrypt →
  stays budget-exempt.
- `AuthenticationHandler.authenticate` **new-auth branch**, reconnect sub-path (`:196-218`,
  where an existing character is found): before trusting the persisted record, compute
  `proved = tokens.verify(uid, requestedRoomId, message.token)`. If `!proved`, set
  `player.isDM = false` (a fresh mint follows regardless). Add a one-line log
  (`console.log("[Auth] tokenless reclaim of ${uid}; DM reset")`).
- Mint a fresh token at the end of both success paths (re-auth-with-valid-token also rotates —
  cheap, and shortens a leaked token's life).

**Tests (contract-style, real `Container` + fake sockets — copy `multiRoom.contract.test.ts`):**
- dave authed+DM; a **second** socket for `uid=dave` sends `authenticate` with **no token** →
  gets no `auth-ok`, and cannot run a DM action (assert `combatActive` unchanged on the wire).
- Same, with a **wrong** token → same result.
- Same, with the **correct** token → `auth-ok`, and the swap happens (S3 completes this; in
  S2 assert at least that auth is conferred).
- dave (DM) disconnects (cleanup runs); a socket claims `uid=dave` with the room password and
  **no token** → authenticates as a **non-DM** dave (assert the snapshot roster shows
  `isDM:false` for dave).

**Gate:** `/verify-gates boot e2e`.

### S3 — Enforce at connect (close A and D — the keystone)

**Cites I1, I2, I3.** This is the highest-risk slice (connection-war territory). Give it the
most care and the exact PoC test.

**The restructure.** Today `handleConnection` immediately evicts the incumbent and slots the
newcomer into `uidToWs[uid]`. Change so the newcomer for a **live authenticated incumbent** is
held un-adopted until it proves the token in a message:

1. In `ConnectionLifecycleManager.handleConnection`, compute
   `liveAuthedIncumbent = authenticatedUids.has(uid) && this.uidToWs.get(uid)?.readyState === OPEN
   && existingWs !== ws`.
2. If **not** `liveAuthedIncumbent` (fresh, or incumbent dead/absent): behave as today —
   replace a dead incumbent if present, `uidToWs.set(uid, ws)`, keepalive. Auth is still not
   conferred here (I2); the client will `authenticate`.
3. If `liveAuthedIncumbent`: do **not** close the incumbent, do **not** overwrite
   `uidToWs[uid]`. Instead mark this connection **pending** and thread its socket to the auth
   handler so `authenticate` can reply on it and, on a valid token, perform the swap. The
   pending socket is reachable via the `ws` already in the `connectionHandler.handleConnection`
   closure — thread `ws` through `handleMessage → pipeline.onValidMessage → handleValidatedMessage
   → MessageAuthenticator.checkAuthentication → AuthenticationHandler.authenticate(ws, uid, ...)`
   so the handler no longer reply-looks-up via `uidToWs.get(uid)` for this path. (This also
   cleans up a latent fragility: replying by uid-lookup is why two sockets for one uid is
   ambiguous.)
4. In `authenticate`, for a pending newcomer: verify the **token** against the incumbent's
   record. Match → **now** do the swap: `existingWs.close(WS_CLOSE_REPLACED, ...)`, stop its
   keepalive, `uidToWs.set(uid, ws)`, keep auth, `auth-ok` (rotate token). Mismatch/absent →
   `ws.close(WS_CLOSE_SESSION_CONFLICT, "Session held by another connection")` and leave the
   incumbent **fully intact** (I3).

**Client:**
- `services/websocket/ConnectionLifecycleManager.ts`: add a `WS_CLOSE_SESSION_CONFLICT` branch
  next to `WS_CLOSE_REPLACED` (`:310`). It is NOT terminal like REPLACED, but must NOT
  auto-retry-as-same-uid in a tight loop (that recreates the war). Surface a clear state
  (e.g. new `ConnectionState.CONFLICT` or reuse FAILED with a distinct reason) that the auth
  gate renders as "This table session is held by another window. Reload to take over." For a
  legit user this should be unreachable (they hold the token); it fires for an attacker or a
  genuinely-conflicting second browser without the token.

**Tests:**
- **The transcript PoC, as a contract test** (`ws/__tests__/sessionHijack.contract.test.ts`):
  dave authed+DM on socket A; socket B connects `?uid=dave` and sends a DM action with no
  authenticate → **dropped** (unauthenticated), socket A still open, `combatActive` unchanged.
  Then B sends `authenticate` with no/wrong token → `WS_CLOSE_SESSION_CONFLICT`, A untouched.
  Then B with the correct token → swap: A gets `WS_CLOSE_REPLACED`, B is authed, is DM.
- **DoS (D):** socket B connecting `?uid=dave` (no token) never closes socket A.
- **Whisper (C):** while B is unproven, a whisper to dave reaches only socket A's bytes
  (extend `chatSecrecy.contract.test.ts`).
- Regression: the legit second-tab takeover (with token) still works; the connection-war does
  not resurrect (two token-holding sockets for one uid settle to one, no ping-pong).

**Gate:** `/verify-gates boot e2e`.

### S4 — Invalidation completeness, docs, residual notes

**Cites I5, I6, I7.**

- Confirm I6 holds on every exit: normal disconnect, heartbeat timeout, and the S3 swap all
  delete/replace the token record. Add a test if any path is uncovered.
- Rewrite the accepted-limitation comment block at `recipientFilter.ts:66-83` (and the
  parallel note at `:114`) to describe the **new, narrower** residual: whispers are now
  private from a table member who is *not* the addressed player, except that a room-password
  holder can still claim a **fully-offline** uid and receive that uid's future whispers as a
  non-privileged impersonator — closed only by opaque per-session identity (deferred).
- `SECURITY_REQUIREMENTS.md` §2: it is now actually satisfied — note the token as the bound
  secret. `ROOM_AUTH_FLOW.md`: add the token handshake to the message contract + flow.
- No `prettier` on docs (§0).

**Gate:** `/verify-gates boot e2e`.

---

## 6. The fixture ripple — small, enumerated, mechanical

Adding `sessionToken?` to `auth-ok` is optional so nothing *type*-breaks, but these
**exact-match** assertions compare the whole object and WILL fail — update them to
`expect.objectContaining({ t: "auth-ok" })` or add the field:

- `apps/server/src/ws/__tests__/connectionHandler.test.ts:340` and `:369`
  (`toHaveBeenCalledWith(JSON.stringify({ t: "auth-ok" }))`) and `:506`
  (`toContainEqual({ t: "auth-ok" })`).
- `apps/client/src/services/websocket/__tests__/MessageRouter.transcript.test.ts:26`
  (`toHaveBeenCalledWith({ t: "auth-ok" })`).
- `apps/client/src/services/websocket/__tests__/fixtures/canonicalServerTranscript.ts:38`
  (`JSON.stringify({ t: "auth-ok" as const })`) — decide whether the canonical transcript
  should now carry a token; if so, check it is not a **frozen** fixture first
  (`scripts/frozen-tests.lock.json`); a frozen file needs the owner's `--update`.

`useWebSocket.test.ts` and `useServerEventHandlers.test.ts` simulate `{ t: "auth-ok" }`
without a token — fine (optional field), leave them unless they assert the token is absent.

No `RoomState` required-field ripple (unlike the vision-default slice), so **`fix-fixture-ripple`
is not needed here.** The `player()` harness in `routerHarness.ts` is unaffected.

---

## 7. Traps — ranked by what they cost

1. **The connection-war ([[private-rooms-feature]]).** The whole REPLACE/terminal machinery
   exists to stop two same-uid contexts 4001/4002-thrashing. S3 adds a *third* outcome (4003).
   Get the client branch wrong and you either resurrect the war or lock legit users out. The
   S3 regression test ("no ping-pong") is the guard — prove it fails if you make 4003
   auto-retry.
2. **Barrel const trap ([[shared-barrel-no-runtime-const]]).** `WS_CLOSE_SESSION_CONFLICT`
   MUST go in `wsCloseCodes.ts` and be value-re-exported; an `export const` in `index.ts`
   leaves every gate green while `pnpm dev` cannot boot. **Boot after S1.**
3. **Stale shared dist ([[herobyte-build-conventions]]).** After any `packages/shared` edit,
   `pnpm --filter "@herobyte/shared" build` or server/client resolve the old `dist`.
4. **Per-table token scoping.** Store the token under a per-`roomId` key exactly like
   `roomSecretKey`. A single flat key auto-presents table A's token to table B on a same-tab
   navigation — the identical bug the per-table secret key already fixed.
5. **Budget exemption.** The token re-auth path does no scrypt; keep it out of
   `takeAuthWork`/`refundAuthWork` so a party reconnecting together does not drain the per-IP
   budget (`AuthenticationHandler.ts:116-118` is the precedent).
6. **`readyState` numeric literal.** The server checks `ws.readyState === 1` (OPEN) in a few
   places; use the same literal (or `WebSocket.OPEN`) consistently — the incumbent-liveness
   check in S3 hinges on it, and a dead incumbent that reads "live" reintroduces the
   reconnect lockout §3.4 warns about.
7. **e2e shares the secret file** (`herobyte-room-secret.json`) with the dev server; the token
   is in-memory so it is not persisted, but if you add any on-disk token cache, isolate it
   like the state/map files ([[public-test-table]]).
8. **Threading `ws` through the pipeline (S3).** Do it surgically — signature changes only on
   the auth path, not a rewrite of `MessagePipelineManager`. Prettier re-wraps calls that
   cross 100 cols; re-run `pnpm lint:structure:enforce` (350-LOC, separate from `pnpm lint`)
   after the burst — `AuthenticationHandler` and `messageRouter` sit near the ceiling.
9. **Sabotaging review agents collide with edits** ([[ux-audit-repair-slice-2]]) — commit
   promptly so a mutating agent cannot clobber uncommitted work; audit `git diff` after any
   errored review run.

---

## 8. Verification beyond the gate (this is a security change — do not skip)

Run the full ladder, in order, and treat a review that does not FINISH as having no verdict.

1. **`/verify-gates boot e2e`** — CI's exact ladder on the cheap runner. Every `SKIPPED` is
   "not verified." Do not run `pnpm test` while a review workflow is live (contention flakes).
2. **`evaluate-live`, mode `live-two-client`** (the rule: two clients or it did not happen):
   - `preview_start {name:"dev"}`; second tab pinned with `?sessionUid=` per tab
     (`navigate` strips query strings — set once).
   - DM tab = `FunDM`, player tab = `Fun1`, same table.
   - **Prove the fix, not a happy path:** open a THIRD tab as `?sessionUid=<the DM's uid>`
     (read it from the roster) with no token and confirm it cannot take DM, cannot read the
     player's whisper, and does NOT kick the real DM. Then reload the real DM tab and confirm
     it silently resumes as DM (token-proved reconnect). Then reconnect mid-session
     (`isDM` has read FALSE on reconnect before — assert it stays TRUE with the token).
   - Score ≥ 7.0 to pass; report the mode you actually achieved.
3. **`review-convergence`** — 4–8 fresh reviewers, ≤3 rounds, plateau-stop, **both/all must
   PASS**, union of findings. Pin `model` on every agent. Named lenses this arc REQUIRES:
   - **Security/auth** — can any socket reach `authenticatedUids` or `isDM` without token or
     password? Re-derive the PoC against the diff.
   - **Connection-lifecycle/regression** — the war, the 4003 branch, reconnect-after-blip,
     multi-tab.
   - **Test-validity** — does each new test fail when the guard is removed? A hijack test that
     passes with the token check deleted is vacuous.
   - **Doc-vs-code honesty** — re-read the rewritten `recipientFilter.ts` block and
     `SECURITY_REQUIREMENTS.md` against what the code now does (the one a defect lens cannot
     see).
4. **Merge to `main`** as one `--no-ff` merge of `dev`. Then **deploy probe**
   ([[deploy-probe-discriminating-string]]): a string new to this arc (e.g. the 4003 reason
   copy) 0→1 across every served chunk + a control that holds steady; server 200 after the
   ~30-50 s Render swap. **`watch-ci`** the main run (CI does not gate the push; Render +
   Cloudflare deploy regardless).
5. Announce: **players with a tab open must reload** (post-deploy standing note).

---

## 9. Owner decisions to confirm + deferred (recorded, not licensed)

**Confirm before/at merge (genuine calls, not blockers):**
- **Tokenless reclaim UX (C).** S2 resets `isDM=false` on a tokenless reclaim, so a DM who
  clears their browser storage (or joins from a new device) must re-enter the DM password.
  That is the correct security posture; confirm the UX is acceptable, or we add a "re-elevate"
  prompt. Recommended: ship as designed.
- **Second-browser conflict copy.** The 4003 message ("session held by another window —
  reload to take over") — confirm wording fits the JRPG voice / help copy (a second home for
  user-facing copy is `helpTopics.ts`).

**Deferred to a later identity arc (do NOT build here):**
- C's residual: a room-password holder claiming a fully-offline uid still receives that uid's
  future whispers as a non-privileged impersonator. Real close = opaque per-session identity
  (server-assigned, never the raw uid on the wire). Consistent with arc §7 decision 1.
- Removing/opaquing raw `uid`s in the snapshot roster + DM server logs (the attacker's recon
  input). Big refactor (client keys on `uid` everywhere).
- Password-rotation session invalidation (rotating the room/DM password should optionally end
  live sessions for that room). Reasonable, but a UX + scope call of its own.
- The public Fun1 table stays open **by design** — not a bug ([[public-test-table]]).

---

## 10. Command crib

```bash
# after ANY shared edit
pnpm --filter "@herobyte/shared" build

# single server test file
pnpm --filter vtt-server test -- apps/server/src/ws/__tests__/sessionHijack.contract.test.ts

# single client test file
pnpm --filter herobyte-client test -- src/services/websocket/__tests__/AuthenticationManager.test.ts

# the full ladder (delegate; do not hand-pick)
#   /verify-gates boot e2e     (gates-runner agent)
#   evaluate-live              (two-client browser eval)
#   review-convergence         (bounded adversarial review)

# structure guard is SEPARATE from pnpm lint
pnpm lint:structure:enforce

# re-seed the secret file if a live password test dirtied it
rm apps/server/herobyte-room-secret.json
```

---

## 11. Prompting Claude Fable 5.1 — carry into the executor's handoff

Per the owner's standing reminder ([[fable-5-1-prompting]]), the executor works by the §7
patterns in `docs/planning/PROMPT-kicked-in-door-arc.md` (the curated full text). In short:
start effort `high`; say what you're about to do in a line, brief updates while working, a
standalone recap at the end; batch independent tool calls ("first privately list what you
need next, then request everything that doesn't depend on another result in one response");
keep history append-only; plain dense prose, formatting only when it aids clarity; finish the
whole task (a decided step is something to run, not announce); surgical edits over whole-file
rewrites; let subagents run without polling. **HeroByte override:** fix bugs found mid-arc in
their own commits and prove every new test can fail — the repo rule beats the generic
"don't fix nearby bugs."

---

## 12. Execution notes (2026-09-19) — what shipped, and where it left the plan

Built on `dev` in five commits: `cc5cf6a0` (this plan), `1632b2e3` (S1), `694a8bb8` (S2),
`fc6849eb` (S3), `56c018fd` (S4). Every slice passed typecheck, lint, `format:check`, the
structure guard and its suites before its commit; the S1 shared-export change was boot-checked
(exit 124, both ready lines, no `does not provide an export named`). The plan's PoC is
`apps/server/src/ws/__tests__/sessionHijack.contract.test.ts` (18 cases at HEAD over the REAL
`ConnectionHandler` + `Container`; the two review rounds each added one). Sabotage tally: **S1
8/8 red, S2 4 negative red / 2 positive green as intended, S3 12/12 red** (one client guard
proved unreachable — see below); the review-round fixes are each sabotage-proven too (see §13).

### 12.1 Deviations from the plan as written — read before relitigating

1. **The token is DETACHED on disconnect, not deleted (I6 amended).** I6 said "deleted whenever
   the uid leaves `authenticatedUids`", but §8.2's own acceptance test ("reload the real DM tab
   and confirm it silently resumes as DM") is impossible under that rule: a reload closes the
   socket, cleanup runs at once, and the reconnect would arrive tokenless — S2 would then demote
   every DM on every blip. Records now carry `detachedAt`, stay valid for
   `SESSION_TOKEN_GRACE_MS` (**6 h**, one constant in `SessionTokenService.ts`), rotate on every
   auth (which re-attaches), and are swept lazily on the mint path. Detach happens on disconnect,
   heartbeat timeout, AND connect-time adoption of a dead incumbent (S4 found that one).
2. **localStorage, not sessionStorage, keyed per table AND per uid, with a per-uid "newest"
   fallback.** §3.4's "a legit second tab has the same sessionStorage" is false — sessionStorage
   is per TAB. With it, a second tab (and a browser reopened after a crash) could never reclaim
   its own session. The uid in the key keeps two same-browser tabs with different
   `?sessionUid=` from overwriting each other's proof; the `:*` fallback lets a second tab opened
   on a DIFFERENT table still present the token that proves its live session (the server's
   takeover check is `matches` — same session — while DM continuity is `verify` — same table).
3. **The password is verified on every path except the holder's own re-auth.** The plan's
   "token-gated passwordless short-circuit" became: the socket that already HOLDS the session
   re-authenticates passwordless (nothing new is granted — sub-issue B was only ever exploitable
   through A); any OTHER socket takes the full password path and then needs the token to swap.
   Defence in depth, and the validator requires `secret` anyway.
4. **Adoption at connect never confers auth (I2, strengthened).** Only a DEAD incumbent is
   replaced at connect (reconnect-after-blip stays fast); a LIVE incumbent — authenticated or
   not — is held instead (round 1, `93e05beb`: holding a live-unauthenticated incumbent is what
   stops a bare connect from kicking a victim mid-handshake). On the replace path the newcomer
   always starts unauthenticated and its room's roster entry is dropped. Before, a dead
   authenticated incumbent's flag was inherited — the A hole for the CLOSING window.
5. **The token is NOT cleared on `auth-failed`.** A mistyped password is not a bad token;
   clearing it turned one typo into a DM demotion on the corrected retry.
6. **Keepalives are per SOCKET** (`stopKeepalive(ws)`), so a held newcomer has its own and a
   swap hands nothing over. A room switch in one live session leaves the old roster
   (`leaveRoomRoster`), or the heartbeat sweep later cleans up the NEW room by mistake.
7. **Two extractions for the 350-line guard**, both behaviour-neutral: `joinProvisioning.ts`
   (player/character/token provisioning + `leaveRoomRoster`) and `roomMinting.ts` (the
   create-room / fork-table budget wrappers). `container.ts` collapsed its two client collectors
   into one loop to fit `sessionTokens`. `AuthenticationGate.tsx` lost an empty banner block.
8. **Both "characterization" suites for the lifecycle manager and the message authenticator
   drive inline COPIES of the old logic, not the classes.** They could not see any of this. Each
   gained a block that drives the real class; three copies asserting the old "adoption keeps
   auth" rule were removed. Two ConnectionHandler tests that modelled a reconnect with a still-
   OPEN old socket now mark it dead first — a live one is, correctly, a held newcomer.
9. **One client guard is unreachable and documented as such:** `handleVisibilityChange`'s
   CONFLICT (and the pre-existing REPLACED) check never runs because `cleanup()` removes the
   listener before the state is set. The "no revive on focus" guarantee holds via the removal;
   the test pins the guarantee and says so.

### 12.2 Consequences the owner should confirm (from §9, now concrete)

- A DM re-enters the DM password after: a **server restart (every deploy)** — records are in
  memory; a **new device or browser**; **more than 6 h away**. Reloads, blips, second tabs of the
  same browser, and breaks under 6 h keep DM silently. `SESSION_TOKEN_GRACE_MS` is the one dial.
- A second **device** (not tab) opened while the first is still connected sees
  **"Held in another window"** with a **TRY AGAIN** button, and cannot take the seat until the
  first device's socket is gone — up to the 5-minute heartbeat window if that device died
  silently — **and then, if that device had ever authenticated, for the rest of its token's
  grace window**: the heartbeat reap frees the socket, not the record (`detach`, never `revoke`),
  and `sessionTokens.has()` holds the seat against a tokenless claim for `SESSION_TOKEN_GRACE_MS`
  (6 h). A sub-6 h free-up happens only for a live incumbent that never authenticated. Before this
  arc it took over at once (and so could anyone with the room password). Shrinking the reap
  window means detecting dead sockets by missing pongs — a follow-up, not built.
- Copy to confirm against the JRPG voice: status label "Held in another window"; hint (rewritten
  2026-09-20 by the connection-closing slice, after two reviews caught "wait a moment" promising a
  wait the server does not honour, then a third review caught "will not release it" denying the
  same-browser self-heal) "This table is still connected as you elsewhere — another window or
  device, or a session that has not fully closed — and this one could not be proven the same
  session. Try Again is worth one click: from the same browser as that session it usually takes
  the seat back. Otherwise the seat stays reserved while that session is connected, and for up to
  six hours after it disconnects — more retries will not shorten that. If the other window is
  yours, play from there."; button "Try Again" (the REPLACED state has its own, "Reclaim This
  Tab", which reconnects in place). `AuthenticationGate.test.tsx` pins "up to six hours" against
  `SESSION_TOKEN_GRACE_MS` read from its source, and "more retries will not shorten". The
  `helpTopics.ts` help copy has no entry for this yet. **Open for the owner:** a tab in this state
  has no way out but waiting — a "start a fresh session" action (a new uid) is a product decision.

### 12.3 Still to run before `main` (the §8 ladder)

`/verify-gates boot e2e` → `evaluate-live` (two clients, plus a THIRD tab as the DM's uid with no
token: cannot take DM, cannot read the player's whisper, does not kick the DM; then reload the DM
tab → still DM) → `review-convergence` (security/auth, connection-lifecycle, test-validity,
doc-vs-code lenses) → one `--no-ff` merge → deploy probe on a string new to this arc (e.g.
`Session held by another connection` in the server, `Held in another window` in a client chunk)
→ `watch-ci` → announce "players with a tab open must reload; DMs re-enter the DM password once".

### 12.4 evaluate-live record (2026-09-19, mode `live-two-client` + raw-socket attacker)

Dev server on 5174/8787; DM tab `?sessionUid=eval-dm` (Fun1, elevated with FunDM), player tab
`?sessionUid=eval-player`, both on the Main Hall. Attacker = `apps/server/.tmp/attacker.mjs`, a
raw `ws` client with no token (the transcript's PoC). Screenshots could not be captured (the pane
was not drawing); every claim below is a DOM/seam/console/server-log measurement.

| step | result |
|---|---|
| attacker connects as `eval-dm`, sends `start-combat`, no authenticate | DM tab untouched (connected, `isDM` true, no notice); `combatActive` stays false; server: `Unauthenticated message from eval-dm, dropping` |
| attacker `authenticate` Fun1, no token | closed **4003 Session held by another connection**, 0 frames; DM untouched |
| attacker `authenticate` Fun1, wrong token | same 4003, 0 frames |
| eavesdropper on `eval-player` (20 s) while the DM whispers | player tab shows the whisper; eavesdropper received **0 frames** |
| offline persisted DM record `dmeval` reclaimed with Fun1, no token | `auth-ok` received (in as "Player 3"), roster `isDM: false`; server: `tokenless reclaim of dmeval: DM reset` |
| reload the DM tab | back as `eval-dm`, no gate, no DM-password prompt, `isDM` true (token-proved) |
| second tab of the SAME browser as `eval-dm`, Fun1 | held at connect (both tabs "Connected"), then takes over: tab 2 is DM without the DM password; tab 1 gets 4002 |
| RECLAIM THIS TAB from tab 1 | tab 1 back as DM; tab 2 REPLACED, shows the gate, **no reconnect attempt** (no ping-pong) |
| tab 2 with its stored token removed, reloaded (a stranger) | auto-login with the password alone → 4003 → gate: "Held in another window", the hint, **Try Again**; DM untouched |
| Try Again | one more connect → 4003 → conflict; no loop |
| 375×812 | no horizontal overflow; Try Again is 44 px tall; it sits 48 px below the fold (the gate scrolls — pre-existing gate length) |

**Found and fixed during the evaluation** (`dcea35b4`): a logged-in tab that gets REPLACED
rendered the app with an OFFLINE chip and a "Reconnecting…" banner forever — the reclaim
affordance lived in the gate, which only showed before a first login. Pre-existing at `40c1031b`;
the getting-started guide had promised the reclaim notice for exactly this case.

**Score:** functionality 9 (0.35), multiplayer integrity 9 (0.30), craft 8 (0.20), reach 7 (0.15)
→ **8.5 / 10, PASS.** Minor: the conflict button below the fold at phone height; no help-topic
entry for "Held in another window"; a crashed device's replacement without its token waits up to
the 5-minute heartbeat window (design consequence, §12.2).

---

## 13. Review-convergence log (2026-09-19/20)

The bounded adversarial review (four lenses: security/auth, connection-lifecycle/regression,
test-validity, doc-vs-code honesty), gated per `review-convergence`. Every fix below is in its
own commit with a test that reproduces the issue and a sabotage that goes red without the fix.

**Round 1 — three CONFIRMED defects, all in this arc's own code, all fixed (`93e05beb`):**
- **HIGH, session lockout (a regression S3 introduced).** A room-password holder who claimed a
  uid seconds after its socket dropped fell into the "no live occupant" branch and re-minted
  over the owner's token record, 4003-locking the owner out for as long as the impostor held the
  seat. Fixed: while a uid's session is still provable (live, or detached in grace), only its
  token claims it.
- **MEDIUM, sub-issue D reshaped.** The connect hold keyed on `wasAuthenticated`, so a bare
  connect still kicked a mid-handshake victim and the held socket's dropped frames spent the
  victim's per-uid rate bucket. Fixed: hold on liveness alone; rate-limit per socket.
- **MEDIUM, cross-table DM demotion.** One token record per uid meant visiting a second table
  demoted the DM on return. Fixed: records per uid AND table; a mint rotates only its table and
  re-attaches the whole session. Plus: no-uid connections refused 1008; tokens revoked on the
  Main Hall wipe; credentials redacted from the error sink; keepalive started last.

**Round 2 — connection-lifecycle, security, test-validity all PASS; doc FAIL. Findings fixed:**
- **LOW, silent hang (`a768ae88`).** The in-flight auth guard keyed on uid, so a reload mid-hash
  (two live sockets, one uid) was dropped with no reply. Keyed on the socket now.
- **LOW, live-unauthenticated kick (`3a351c7d`).** The claim guard protected a live *authenticated*
  incumbent but not a live *unauthenticated* one — an invited player could kick a mid-handshake
  holder (widest post-deploy, when tokens are gone). The guard now refuses a password-only claim
  against ANY live incumbent; a reconnect proves itself with its token, else self-heals on retry.
- **LOW, DM-elevation budget leak (`001f4627`).** The elevate path spent a budget token on an
  in-flight double-submit without refunding, unlike authenticate. Refunds now.
- **MEDIUM ×4, doc staleness (`ff1efb3d` + this §13/§12 sweep).** The code had outrun its own
  documentation: the server `ConnectionLifecycleManager` class comment, the `wsCloseCodes` 4003
  comment, `ROOM_AUTH_FLOW.md` points 1/3, plan §3.4 and §12.1, and the CONFLICT copy still
  described the pre-fix "live AND authenticated" rule. All corrected to what shipped.

**Round 3 — doc re-review** confirmed the round-2 fixes and swept the last three §12 stragglers
(this section, the test count, the copy quote). No code defect surfaced in rounds 2 or 3; the
verdict count fell 3 → 2 → 0-code across the rounds. Every code lens PASSED; the doc corrections
are complete. Verified beyond the gate: `/verify-gates boot e2e` green on the final tree, and the
live two-client evaluation (§12.4) re-confirmed against the fixed code.

---

## 14. Deploy record — IN PRODUCTION 2026-09-20

`main` = **`2b7fe39e`** (a `--no-ff` merge of `dev` at `3852f819`, 17 commits). **CI run #886 green**
on main; remember CI does NOT gate the push — Render and Cloudflare deploy regardless.

**Probe (discriminating string, every served chunk).** Markers absent at the outgoing `50472bca`
and present at the incoming commit: `Held in another window` and `This table is still connected
as you elsewhere` each went **0 → 1** in `assets/index-28Dsfjsc.js`, across **11 chunks fetched
(1.42 MB)** walked from the served HTML. Controls present either way held: `Enter Table` 1,
`Table password` 6 — so the method was sound rather than silently matching nothing. Server
`/healthz` returned **200 after ~30 s of 502s** (the expected Render restart window).

**Functional check on the LIVE server** (throwaway uid on the public Main Hall, nobody else
touched): socket A authenticated and elevated to DM (43-char token minted, so the new code is
the code running). Socket B, same uid, room password, **no token → 0 `auth-ok`**. Same with a
**wrong token → 0 `auth-ok`**. Socket C with the **real token → `auth-ok`**, takeover worked.
**The impersonation hole is closed in production.**

### 14.1 Production-only defect found while verifying — READ THIS BEFORE TRUSTING A CLOSE CODE

**Render's proxy strips server-originated WebSocket close codes to 1005** ("no status received").
Confirmed twice: a Node `ws` client and a REAL BROWSER on `herobyte.pages.dev`, whose own console
reads `[WebSocket] Disconnected 1005` where the server sent **4002**. Client-originated closes
(the browser's own `close(1000)`) are unaffected — it is only the server→client direction.

Consequences, in order of importance:

1. **`WS_CLOSE_REPLACED` (4002) has been inert in production since it shipped (`db329419`, July).**
   The terminal REPLACED state never triggers; the client falls to `handleDisconnect()` and
   auto-reconnects. **This is PRE-EXISTING, not this arc** — the same `existingWs.close(
   WS_CLOSE_REPLACED, …)` is at the outgoing commit `50472bca`.
2. **The new `WS_CLOSE_SESSION_CONFLICT` (4003) gate inherits it**, so a second device sees a
   reconnect cycle instead of "Held in another window".
3. **Two tabs of one browser therefore war endlessly** — each takeover's victim reconnects and
   takes over in turn, because nothing goes terminal. Reproduced: **157 console entries cycling
   every 2 s**, tab stuck OFFLINE. Exactly the war 4002 was written to end.

**What it does NOT affect:** the guard itself is server-side and verified working above. Single-tab
play never triggers a takeover, so normal use is unaffected.

**The fix — IN PRODUCTION 2026-09-20 (dev `62154152`, main `9745a26f`, CI #890; `check:live-session`
9/9 through the real proxy, codes 1005, frame first; browser-confirmed on herobyte.pages.dev):** stop depending on the close code. The server sends
`{ t: "connection-closing", reason: "replaced" | "conflict" }` immediately BEFORE `ws.close(...)`
on both live-socket close sites (`closeAnnounced` in `apps/server/src/ws/announceClosing.ts`,
called from `AuthenticationHandler.ts`); the client goes terminal on that frame
(`ConnectionLifecycleManager.handleServerClosing`, fed by `MessageRouter` → `WebSocketService`),
firing the same `onClose` teardown the close event drives, and treats a reason it does not know as
a conflict rather than reconnecting. The close codes stay as defence in depth for direct
connections (local dev, e2e), where they do arrive. Pinned by: the sessionHijack contract suite
(frame before close, at both sites, never to the other party) and the server lifecycle unit tests
(nothing written to a dead occupant); `announceClosing.wire.test.ts` (real loopback sockets, with
and without permessage-deflate, with 4 MiB queued ahead); a source scan that forbids a bare
`close(WS_CLOSE_REPLACED | WS_CLOSE_SESSION_CONFLICT | 4002 | 4003)` outside the dead-occupant
replace; and `websocketConnectionClosing.test.ts`, which feeds the real service exactly what
production sends — the frame, then a close whose code is 1005. Expected to survive the proxy;
**confirmed only by `pnpm check:live-session` against the deployed host**
(`scripts/live-session-check.mjs`: three sockets as one uid, asserts the frame precedes each close,
reports the codes seen — 1005 means the proxy is still stripping them; each run leaves a
`live-check-*` seat in the table it joins, see its header). Run against production 2026-09-20 after the
merge: 9/9 PASS, B=1005 A=1005, frame before close both times. Verified on `dev` by a live two-client browser pass: the replaced tab went terminal on
the frame with zero reconnects over 10 s, a tokenless reclaim landed on "Held in another window",
one frame per manual retry, the live tab and a player tab untouched.

**LESSON for the next deploy:** e2e and local dev both connect DIRECTLY to the server, so no test
in this repo can see a proxy rewriting a close frame. A post-deploy functional check against the
real host is the only thing that catches it — the bundle probe alone would have reported a clean
deploy.

**Post-deploy note for players:** reload any open tab. DMs re-enter the DM password once (session
tokens live in memory and do not survive the restart).
