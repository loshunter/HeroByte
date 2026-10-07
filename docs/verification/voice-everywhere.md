# Voice everywhere — join, mute, leave on phone and PC

**Status: BUILT on `dev`, uncommitted, awaiting the owner.** Started 2026-10-06 from
[`PROMPT-voice-everywhere.md`](../planning/PROMPT-voice-everywhere.md) (untracked). `main` is `3d3c2aa9` and holds none
of this. Merging to `main` and pushing `dev` are the owner's word.

## The owner's decisions (2026-10-06)

1. Everyone can mute their own mic and keep listening, phone or PC.
2. No TURN server ("Don't want to pay for a feature nobody uses").
3. Fix iPhone audio (unlock in the tap; a visible "tap to hear voice" fallback).
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
- **Comes back by itself**: after a blip the hook re-sends its state and asks old callers to call again; after a reload
  (within a minute of the page going away) it rejoins in the same muted/live state.
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
| **The "Mute mic" button left voice entirely** (mic toggle = connection). | Replaced: mute is `track.enabled = false`; e2e checks hearing holds while muted. |
| **The speaking meter sent `mic-level` every animation frame** (60/s, 120/s on 120 Hz), each a full-table broadcast, ack-tracked and retried, using the 100 msg/s budget. | Now ≤ 10/s and only on a visible change; not acked, tracked, retried or queued offline. |
| **`BroadcastService` starved**: a 16 ms trailing debounce reset by every call, no cap; calls < 16 ms apart postponed every table broadcast indefinitely. | Unit test: 8 ms stream for 500 ms → 0 broadcasts before, one at least every 50 ms after (max-wait). |
| **Phone voice chip was untappable** (the top stack is `pointer-events: none`; the map took the tap). Found by the live evaluation. | `mobile/mobile-voice.spec.ts` taps through real hit-testing; with the rule removed it times out at the tap. |
| Review round 1–3 findings (ghost presence after takeover / dead socket / room switch; stale voice-state replayed out of order; offline queue flooded by voice messages; signals from players not in the call; unmount during the mic prompt; no WebRTC crashing the table; a hello replacing a call in progress; the mic-stopped notice invisible; meter AudioContext leaked; render storm; a session-restored tab rejoining days later; hostile names faking presence; and docs overclaims). | Each fixed with a test that was seen to fail under a mutant (agents' harnesses restored bytes by sha256, never git). |

## Evidence

- **Gates** (last full ladder, on the final tree): shared build, lint, format, structure guard, both typechecks green;
  units shared 452, server 2,877, client 8,124 (+4 skipped) green; dev boot clean; e2e 366 passed / 3 failed / 3
  skipped. The 3: the two character-file download specs, and `interface-marquee-cancel` (a chat barrier message
  seen twice; passed 4/4 alone; likely a retried command applied twice under load, pre-existing, filed as a
  follow-up). e2e failures were only the two
  character-file download specs (failing only on this machine since 2026-10-02; CI #918 passed both) plus single load-related timeouts that passed on rerun
  (`interface-terrain-clarity` 6/6, `interface-player-navigation` 2/2).
- **e2e**: `voice-call.spec.ts` (two people pressing Join together; late join; mute keeps hearing; a third; leave),
  `mobile/mobile-voice.spec.ts` (Pixel 7 touch: idle map clear, one tap to join, mute, Party names, 44 px, leave),
  `interface-mic-notice.spec.ts` (moved to Join voice). "Hearing" = an unpaused `<audio>` per person fed by a live remote
  track, capped by the control's connection count; whether sound flows is not measured.
- **Live** (`live-two-client`, headless Chromium with a fake mic against the dev server, desktop 1280×720 + Pixel 7):
  idle, join, chip, rapid double tap (one join), mute (connection kept, 🔇 seen by the other), Party screen, reload
  (rejoined muted), 4 s network blip (call survived), leave, chip gone. Zero console errors. Run twice (before and after
  the round-2 fixes). The built-in pane was not used (it would not draw).
- **Review**: three rounds, three independent read-only reviewers each (correctness/races, tests and docs, server/wire/
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
4. The round-3 fixes (reload window, leave-hangs-up test, blip roster, hello freshness, JSON roster key, meter
   non-fatal, guarded broadcast) were not reviewed by a fourth round (the cap); each has mutant-proven tests.
5. User-guide screenshots predate the voice control (`pnpm docs:screenshots` would refresh them).
6. The website design (claude.ai canvas) still says "Voice chat needs a desktop browser": flip it when this ships.

## Proposed commits (explicit paths; the PROMPT files stay untracked)

1. `fix(server): a broadcast is never postponed more than 50 ms by a stream of changes` — `BroadcastService.ts` and its test.
2. `feat(voice): join, mute and leave on phone and PC, as easy as a Discord call` — everything else (client, server
   presence and relay, shared type, e2e, docs, this record).
