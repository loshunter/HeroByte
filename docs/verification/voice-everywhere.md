# Voice everywhere — join, mute, leave on phone and PC

**Status: on `dev`, going to `main` on the owner's word (2026-10-07: "make phone voice live on main").** Started
2026-10-06 from [`PROMPT-voice-everywhere.md`](../planning/PROMPT-voice-everywhere.md) (untracked). It merges to `main`
together with `617e8fd6` (the command replay ledger), which landed on `dev` beneath it, and the pre-merge review's
fixes (see "Pre-merge review" and "Commits" below).

## The owner's decisions (2026-10-06)

1. Everyone can mute their own mic and keep listening, phone or PC.
2. No TURN server ("Don't want to pay for a feature nobody uses").
3. Fix iPhone audio. Built: playback relies on Safari allowing it while the mic is in use, with a visible
   "Tap to hear voice" fallback (and any tap or key on the page; whether a tap on the map counts is the browser's
   call). Untested on an iPhone.
4. Accepted: phone browsers cut the mic on screen lock / app switch.
5. Joining asks for the mic; muting after connecting is enough (no listen-only).
6. "It HAS to be as easy as joining a Discord call for it to be at all useful."

## What it does

- **Join voice / Mute / Unmute / Leave voice.** Desktop: in the header's *Panels & settings* row, always. Phone: a chip
  at the top of the map while a call runs (or you are in one, or it has a notice to show), and a control at the top of
  *Party*. The Party card's mic button is the Mute toggle once you are in. Mute disables the outgoing track only: every
  connection stays and you still hear everyone.
- **A call is visible before you join** ("2 in call"); in the call the phone Party lists who (with "(muted)"), the PC
  cards show 🎧 / 🔇 and the speaking glow.
- **Comes back by itself**: after a blip (however long) the hook re-sends its state and asks old callers to call again;
  after a reload it rejoins in the same muted/live state. The reload memory is read once and spent, and honoured only
  for a load of type `reload` that began no later than 2 s after the old page went away and within a minute of it, so
  a closed, reopened, restored or duplicated tab never switches the mic on by itself.
- **Says why** when it stops: the mic would not start (the existing failure wording), this browser cannot do WebRTC,
  the voice code could not load (stale tab after a deploy), the mic stopped (unplugged / taken), the table no longer
  lists you (DM clear-all). Shown beside every voice control on screen when no press caused it.

## How (files)

- Client: `apps/client/src/hooks/voice/` — `VoiceMesh.ts` (who connects to whom), `useVoice.ts` (the call),
  `remoteAudio.ts`, `micMeter.ts`, `voiceMemory.ts`; `apps/client/src/features/voice/` — `VoiceControl.tsx`,
  `VoiceContext.tsx`, `voice.css`. Replaced and deleted: `hooks/useMicrophone.ts`, `hooks/useVoiceChatManager.ts`,
  `ui/useVoiceChat.ts` (and their tests).
- Server: `Player.voice` presence via the `voice-state` message; cleared on disconnect, on any fresh authentication,
  on dead-socket replacement (broadcast), on leaving a room and at load; kept on backup restore. `rtc-signal` relayed
  only between two different players in the same room, the target authorized, both in the call, the signal an object
  of at most 16 KB. `mic-level` only while live; no broadcast for an unchanged state or level.
- The connection rule: of each pair only the lower uid places the call; a joining or re-authenticated player sends a
  `hello` to the lower uids (who call again unless a call placed in the last 2 s is on its way); a 5 s grace before
  hanging up on someone missing from the roster (longer than a socket reconnect); after a reconnect, half-made calls
  start over.

## Defects found and fixed on the way

| Defect (old code unless noted) | Proof |
| --- | --- |
| **Two people switching on at the same moment never heard each other** (both called; `ERR_SET_REMOTE_DESCRIPTION … wrong state: stable` on both; never retried). Late joining worked (Chromium's implicit rollback). | Reproduced with real simple-peer 9.11.1 in Chromium (library level). The one-caller rule is pinned in `VoiceMesh.test.ts` (a both-call mutant fails the relay tests). The e2e journey **cannot** tell one caller from two (a both-call mutant still connected through the real server: the redial heals it); the spec says so. |
| **The "Mute mic" button left voice entirely** (mic toggle = connection). | Replaced: mute is `track.enabled = false`; e2e checks the connection and a playing audio element hold while muted (sound itself is not measured). |
| **The speaking meter sent `mic-level` every animation frame** (60/s, 120/s on 120 Hz), each a full-table broadcast, ack-tracked and retried, using the 100 msg/s budget. | Now ≤ 10/s and only on a visible change; today's client sends it with no commandId, so it is not acked, tracked, retried or queued offline (a tab still open from before this work sends it with one, and the server acks those so they are not retried). |
| **`BroadcastService` starved**: a 16 ms trailing debounce reset by every call, no cap; calls < 16 ms apart postponed every table broadcast indefinitely. | Unit test: 8 ms stream for 500 ms → 0 broadcasts before, one at least every 50 ms after (max-wait). |
| **Phone voice chip was untappable** (the top stack is `pointer-events: none`; the map took the tap). Found by the live evaluation. | `mobile/mobile-voice.spec.ts` taps through real hit-testing; with the rule removed it times out at the tap. |
| Review round 1–3 findings (ghost presence after takeover / dead socket / room switch; stale voice-state replayed out of order; offline queue flooded by voice messages; signals from players not in the call; unmount during the mic prompt; no WebRTC crashing the table; a hello replacing a call in progress; the mic-stopped notice invisible; meter AudioContext leaked; render storm; a session-restored tab rejoining days later; hostile names faking presence; and docs overclaims). | Each fixed with a test that was seen to fail under a mutant (agents' harnesses restored bytes by sha256, never git). |

## Evidence

- **Gates, before the merge review** (history; it ran before `617e8fd6` landed beneath this work; the pre-merge
  ladder under "Pre-merge review" is the one that covers the merged tree): shared build, lint, format, structure guard, both typechecks green;
  units shared 452, server 2,877, client 8,124 (+4 skipped) green; dev boot clean; e2e 366 passed / 3 failed / 3
  skipped. The 3: the two character-file download specs, and `interface-marquee-cancel` (a chat barrier message
  seen twice; passed 4/4 alone; a retried command applied twice under load, pre-existing; `617e8fd6` in the same merge is
  that fix). Earlier full runs failed only the two character-file download specs (failing only on this machine since
  2026-10-02; CI #918 passed both) plus single load-related timeouts that passed on rerun
  (`interface-terrain-clarity` 6/6, `interface-player-navigation` 2/2).
- **e2e**: `voice-call.spec.ts` (two people pressing Join together; late join; mute keeps hearing; a third; leave),
  `mobile/mobile-voice.spec.ts` (Pixel 7 touch: idle map clear, one tap to join, mute, Party names, 44 px, leave),
  `interface-mic-notice.spec.ts` (moved to Join voice). "Hearing" = an unpaused `<audio>` per person fed by a live remote
  track, capped by the control's connection count; whether sound flows is not measured.
- **Live** (`live-two-client`, headless Chromium with a fake mic against the dev server, desktop 1280×720 + Pixel 7):
  idle, join, chip, rapid double tap (one join), mute (connection kept, 🔇 seen by the other), Party screen, reload
  (rejoined muted), 4 s network blip (call survived), leave, chip gone. Zero console errors. Run twice (before and after
  the round-2 fixes), both before the pre-merge review changed the reload rule; the pre-merge live run is recorded
  under "Pre-merge review". The built-in pane was not used (it would not draw).
- **Review (building it)**: three rounds, three independent read-only reviewers each (correctness/races, tests and docs, server/wire/
  privacy), fresh every round; tree fingerprint unchanged after each. Majors by round: 1st 4 (deduplicated), 2nd 6,
  3rd 3 (two fixed after round 3, unreviewed by a fourth round; one left to the owner, below). Round cap reached.

## Not done / limits (owner to decide)

1. **A silently dead connection stays "in the call" for up to ~5.5 minutes** (the server's 5-minute heartbeat timeout,
   swept every 30 s; it pings every 25 s but never checks for a pong). Pre-existing for presence in general; voice makes
   it visible. Fix proposed by the round-3 server reviewer: terminate a socket that misses a pong (~50 s). It changes
   connection handling for every player, so it is the owner's call.
2. **No TURN** (decision 2): a phone on mobile data behind carrier NAT may show "Can't reach …" forever. Documented.
3. **iPhone not tested** (CI and this machine run Chromium only). The audio fallback and the WebKit autoplay behaviour
   need the owner's phone.
4. The build's round-3 fixes were not reviewed again while building; the pre-merge review (below) reviewed them, found
   the closed-tab rejoin, and fixed it.
5. User-guide screenshots predate the voice control (`pnpm docs:screenshots` would refresh them).
6. The website design (claude.ai canvas) was updated on 2026-10-07 to say voice works on phones too.

## Pre-merge review (2026-10-07)

The merge carries `617e8fd6` (the command replay ledger: never reviewed or run live before) as well as this work, so
it got its own bounded review (review-convergence): fresh read-only reviewers every round on the whole
`origin/main..dev` diff, models pinned, tree fingerprint checked unchanged after each round, round cap 3.

| Round | Reviewers | Verdicts | Majors |
| --- | --- | --- | --- |
| 1 | ledger, wire/deploy/privacy, voice round-3 fixes, docs | 4 × FAIL | 4: an unbounded commandId held 5 min (one player could exhaust server memory); a closed tab reopened within a minute rejoined with the mic live; old tabs' unacked meter frames would storm the rate limit after the deploy; docs (card 🔇 meaning, a troubleshooting step naming a missing button, an iPhone claim) |
| 2 | ledger+wire, voice client, docs | PASS, FAIL, FAIL | 3: a reopened tab kept the memory, so a reload within the minute rejoined unasked; "Can't reach" blinked off every few seconds for an unreachable player; the IP sentence named the wrong people |
| 3 | voice client, server+wire, docs | PASS, PASS, FAIL | 3, all wording: the Join tooltip's "first time"; the IP sentence's lookup servers and timing; blip vs reload rules in the guide. Fixed as specified; one narrow fresh reviewer then checked that commit and found one overstatement it added (a phone e2e journey it does not have) plus two record wordings, all fixed |

Every fix has a test that was seen to fail under a mutant (sha256-restored). Fixes: `e03abd33`, `6f6ad944`,
`30185f6b`, `cf00b540` and the round-3 wording commit.

**Gates on `cf00b540`** (the full ladder, CI's step list plus `lint:structure:enforce`): all green; units shared 452,
server 2,901, client 8,166 (+4 skipped); dev boot clean; e2e 368 passed / 2 failed / 3 skipped, the 2 being the
character-file download specs that fail only on this machine. `interface-marquee-cancel` passed (the ledger's target),
and the new reload e2e passed in real Chromium. The round-3 wording commit changed one tooltip string, two comments
and docs; its touched files were re-checked (prettier, eslint, 86 tests).

**Live, pre-merge** (`live-two-client` on `7866170b`: headless Chromium with a fake mic against the dev server; DM on
a 1280×720 desktop elevated through the UI, a player on a Pixel 7 with touch): the phone sees "1 in call" before
joining; a rapid double tap joins once; both live, connected and hearing; the DM's card shows 🎤 live and a red 🔇
muted, and muting keeps the connection; the phone mutes, waits 3 s and reloads, and is back in the call muted, heard
by the DM; Back (`back_forward`) does not rejoin, nor does a reload straight after it; a 4 s network drop keeps the
call; a chat line lands exactly once on both clients; both leave and the phone's map is clear again. Zero console
errors. Score 8.6 (functionality 9, multiplayer 9, craft 8, reach 8: no iPhone).

**Left open from the review (minor, recorded rather than fixed):**

- The ledger's limit is per room (worst case about 15 MB a room), with no server-wide cap; and it switches off with
  `FEATURE_FLAG_ACKS=false`.
- A slow backup (`session-export`) can be built and sent 2 to 4 times on a slow link, as in production today: the
  client tracks and retries it although its real answer is the file. Fix: add it to the client's untracked/no-retry
  lists.
- A lock or remove refusal can be lost when the ledger answers a retry flushed after a reconnect (cosmetic).
- A fork whose reply is lost leaves an orphaned table; old tabs still retry forks until they reload.
- Old tabs (from before this deploy) cannot do voice with new ones until they reload.
- Voice presence written to disk survives a rollback to the old server (ghosts in the call there).
- `mic-level` still rides the whole-table snapshot (≤ 10/s per speaker); ICE candidate bursts during call setup can
  approach the 100 msg/s limit on machines with many network interfaces.
- The reload rule trusts `performance.timeOrigin` (some browsers have let it drift after sleep); a hello that replaces
  a working link shows "Can't reach" until it reconnects; signals carry no call id; after a blip, a hello replaces
  connected calls (a brief audio drop).
- Two tests are weaker than they look (remoteAudio "clear removes every listener"; useVoice "older than the window"),
  and the e2e reload can land within 2 s of the last mute toggle, so it does not prove the pagehide refresh.

## Commits (explicit paths; the PROMPT files stay untracked)

1. `617e8fd6` `fix(ws): a retried command is answered from a ledger, not applied twice` (its own session).
2. `0e91245f` `fix(server): a broadcast is never postponed more than 50 ms by a stream of changes`.
3. `a9ce86c2` `feat(voice): join, mute and leave on phone and PC, as easy as a Discord call` — client, server presence
   and relay, shared type, e2e, docs, this record.
4. `e03abd33` `fix(ws): bound what the replay ledger holds, and ack an old tab's meter frames` (review round 1).
5. `6f6ad944` `fix(voice): a closed tab never rejoins by itself; the card shows the mic's state` (round 1).
6. `30185f6b` `fix(rooms): a table fork is sent once, not retried with both passwords` (found in round 1, older).
7. `cf00b540` `fix(voice): the reload memory is spent on reading; "Can't reach" holds` (round 2).
8. The round-3 wording commit.
