# HeroByte lesson videos

The help center's lesson videos: the real app, recorded by script in step with Wren's narration,
then edited with [Remotion](https://www.remotion.dev/) into popups, zooms, pointers, key caps and
karaoke captions in the site's JRPG style. Remotion is free for individuals and companies of up to
three people; a larger company needs its licence.

This folder is its own npm project (not part of the pnpm workspace), so nothing here touches the
app's dependencies, gates or CI.

## Making a lesson video

1. **Narration.** Generate the lesson's chapters with `site/narration/narrate.mjs lesson ...`
   (see `site/README.md`; it never spends past the plan's included credits). The MP3s land in
   `site/narration/out/lessons/<slug>/`.
2. **Word timings** (local Whisper, no credits):
   `python site/video/tools/align.py <slug>` → `narration-timing/<slug>.json`.
3. **Capture.** Write `capture/<lesson>.capture.ts` (copy `dm-quick-start.capture.ts`). Every
   action takes `at: cue("phrase Wren says")`, the moment it belongs to. Run, from the repo root,
   in PowerShell (`node scripts/run-e2e.mjs` from Git Bash cannot spawn pnpm):

   ```
   pnpm test:e2e -- --config site/video/playwright.capture.config.ts
   ```

   It uses the e2e stack (ports 5175/8788, a fresh table, the real dev table untouched), so never
   run it alongside `pnpm test:e2e`. Frames are Chrome's own screencast at 2× (sharp under zooms);
   `footage/` is git-ignored.
4. **Convert:** `node site/video/tools/frames-to-mp4.mjs <slug>` → `public/footage/<slug>/`.
   It retimes the footage so each action lands exactly on its `at` (slack plays faster, with a ⏩
   badge in the edit when it is more than 2×; an early action holds its first frame) and copies the
   narration and timings to `public/audio/<slug>/`.
5. **Edit.** Write `src/lessons/<lesson>.ts` (copy `dmQuickStart.ts`) and add it to
   `src/lessons/index.ts`. Beats are pinned to phrases (`say("Press New Table")`) or captured
   actions (`mark("CREATE PRIVATE TABLE")`), never to raw frames, so a re-capture or a new take
   keeps everything in place. Popups and stickers only restate what the narration says.
6. **Preview and render** (from `site/video/`, after `npm install`):

   ```
   npm run studio
   npx remotion render src/index.ts DmQuickStart out/dm-quick-start.mp4
   ```

## What is where

| Path | What |
| --- | --- |
| `capture/rec.ts` | Screencast recorder, visible cursor with click ripples, eased mouse glides, action marks. |
| `capture/cues.ts` | A phrase in the narration → seconds into the chapter. |
| `tools/align.py` | Word timings from the narration with Whisper (`large-v3-turbo`, CPU is fine). |
| `tools/frames-to-mp4.mjs` | Frames → retimed constant-rate MP4 + `recordings.json` for the edit. |
| `src/engine.tsx` | A chapter: camera zooms, DM/player split screen, shake, banner, captions, sound. |
| `src/overlays.tsx` | Popups, rings, arrows, key caps, chips, big titles, stickers, the chat-spam gag. |
| `src/bookends.tsx` | Intro card and the outro checklist. |
| `src/lessons/` | One edit script per lesson. |

Sound effects are the app's own (`apps/client/public/sfx`); step 4 copies them into `public/sfx/` with the
logo (`public/brand/`); both copies, the footage and the renders are git-ignored.
