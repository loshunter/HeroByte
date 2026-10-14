# HeroByte website

The public website: a landing page, a help center with search, lesson pages, and the five user
guides from `docs/user-guide/` rendered as web pages. The design is the "HeroByte Website" canvas
(claude.ai artifact); this folder is the working version of it.

Plain HTML, CSS and a little JavaScript. No dependencies and no framework.

## Build and preview

```bash
node site/build.mjs
```

That writes `site/dist/` (git-ignored, like every `dist/`). To look at it, run
`node site/serve.mjs` and open
http://localhost:4321/. It sends the right types and the 404 page, and answers Range requests
like an ordinary static host (Cloudflare Pages does not: see "Lesson videos"). Its **Open HeroByte** links go to `/play/`, where the app lives once
deployed; to try them locally, build the whole Cloudflare layout instead (below).

## What is where

| Path                | What it is                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `build.mjs`         | The build, plus `SITE`: the app link, the site's public address (`origin`, for link previews), the Main Hall passwords, and the links still to fill in. |
| `pages/`            | Hand-written page bodies. The first line is `<!--meta {...}-->` (title, description, scripts, search). |
| `assets/`           | `site.css`, `help.js` (topic filter and search), `lesson.js` (chapter buttons play the video from there), the favicon. Served at `/site-assets/`, because `/assets/` is the app's bundle, cached for a year. |
| `docs/user-guide/*` | Not copied by hand: the build renders the guides and copies `docs/user-guide/img/`.                     |
| `narration/`        | Lesson narration with ElevenLabs (see below). Audio output and the API key are git-ignored.             |
| `lessons.json`      | Each lesson video's chapters (start times) and its steps written out. Made by `video/tools/site-lessons.mjs`, not by hand. |
| `media/`            | The lesson videos and the trailer (MP4) with their posters, served at `/media/`. Copied there by the same tool. |
| `serve.mjs`         | A local preview server for `dist/` (see above).                                                         |
| `video/`            | The lesson videos' own project: capture, narration timing and the Remotion edit (`video/README.md`).    |

Editing a user guide updates the website on the next build. Guide headings become anchors the
same way GitHub makes them, so the guides' own links (`getting-started.md#becoming-the-dm`)
and the help center's topic links keep working. If a heading is renamed, re-run the link check
below, because a topic link to its old anchor would stop pointing anywhere.

## Before it goes public

- Fill in `SITE.sourceUrl`, `SITE.bugUrl` and `SITE.contactUrl` in `build.mjs`. While they are
  `null` those links are simply left out.
- `SITE.mainHall` prints the Main Hall's published passwords (`Fun1` / `FunDM`) on the landing
  page, because a visitor cannot try the public table without them. Set it to
  `{ password: null, dmPassword: null }` to stop printing them.
- Videos: every lesson has its video (see "Lesson videos" below). The 14 path videos are on the
  free temp narration (VibeVoice); the two quick starts are on Wren's real ElevenLabs takes.
- The voice copy describes the rebuilt voice chat (phones and PCs), live on `main` since
  2026-10-07 (`6decc06d`).

## Lesson videos

Every lesson in the help center is a video with its steps written out underneath: the two quick
starts and the hand-written "Build your first room live" place theirs with `{{video:<id>}}`, and
the other 13 path pages are built from `lessons.json`. `LESSON_PAGES` in `build.mjs` gives each
lesson its page and the guide section where its topic starts; `{{pathList:<player|dm>}}` and
`{{lessonCards}}` print the paths and the video cards from the same data.

After rendering a lesson (`video/README.md`), make its phone-size copy, from `site/video/`. The
14 paths are 720p at CRF 28:

```bash
ffmpeg -i out/dm-path-1.mp4 -vf scale=-2:720 -c:v libx264 -crf 28 -c:a aac -b:a 128k out/dm-path-1-small.mp4
```

The two quick starts stayed 1080p, at CRF 25 (their audio bitrate was not recorded):

```bash
ffmpeg -i out/dm-quick-start.mp4 -c:v libx264 -crf 25 -c:a aac out/dm-quick-start-small.mp4
```

Then put it on the site, from `site/video/` (needs ffmpeg on PATH; `esbuild` comes with Remotion's
packages):

```bash
node tools/site-lessons.mjs
```

It copies the small renders and `out/trailer-small.mp4` to `media/` (remuxed with the MP4 index
first), takes a poster frame from each, and rewrites `lessons.json`: the chapter start times
worked out the way the edit lays the video out, each lesson's summary from the "By the end" line of
`docs/website/video-scripts.md`, and what Wren says in each chapter from the text blocks of
`docs/website/narration-wren.md` (the script the narration was read from), with the delivery tags
dropped and the spoken spellings ("d twenty", "H P") written back. Cloudflare Pages refuses a file
over 25 MiB, so it stops on a video that big. Commit `media/` and `lessons.json` with the change.
`node tools/site-lessons.mjs --json-only` rewrites only `lessons.json`, from the videos already in
`media/`: a fresh copy that is not byte-identical would add every video to git history again.

**Why a video downloads whole first:** Cloudflare Pages answers a Range request with the whole
file (checked 2026-10-14 on production and previews), so a video streamed from it cannot seek, and
Safari may refuse to play it at all. So a video shows its poster and a play button; the first press
(or a chapter button) makes `assets/lesson.js` download the whole file with a progress count and
play it from memory, a `blob:` URL that the CSP's `media-src 'self' blob:` allows. Each page also
links the MP4 to download.

**Notes:** `notes` in `LESSON_PAGES` (by chapter number) put a NOTE under a chapter where the
video says less than the app does, such as what fog really keeps out of a browser. Delete a note
once the re-recorded video says it.

**Moving a video to YouTube:** set its `youtube` id in `LESSON_PAGES`. The page then embeds
YouTube's player (youtube-nocookie.com) instead of the MP4, and the chapter buttons reload it at
that second. First add `frame-src https://www.youtube-nocookie.com` to the CSP in
`apps/client/public/_headers`, which covers the website too, or the player is an empty box. The
MP4 can then leave `media/` (keep its `.jpg`: the lesson cards use it), though it stays in git
history; the page's download link goes with it. After that, `--json-only` stops on that lesson,
because it reads the MP4's size, and the download link in `build.mjs` needs the file too.

## Narration (ElevenLabs)

The lesson videos are narrated by **Wren**, an Instant Voice Clone (`2yHLZxi5w5jF0qNJKXai`) of the "Female narrator"
voice, on Eleven v4. The scripts are `docs/website/narration-wren.md` (one chapter per block, with IPA for words the
voice could misread); the audition that picked her is `docs/website/narration-audition.md`.

`node site/narration/narrate.mjs` (no dependencies) has `credits`, `voices`, `design`, `save`, `speak`, `clone`,
`audition` and `lesson` (for example `lesson --voice 2yHLZxi5w5jF0qNJKXai --video "DM quick start" --dry-run`). It
reads the key from `site/narration/.env.local` (git-ignored) and never spends past the plan's included credits: it
refuses a run that does not fit and re-checks before every file. Audio goes to `site/narration/out/` (git-ignored).

## Deploying

From the first `main` deploy that includes `apps/client/scripts/assemble-pages.mjs`, the website
and the app are ONE Cloudflare Pages project (`herobyte.pages.dev`): the website at `/`, the app
at `/play/`. Nothing is set up separately: on Cloudflare the app's own build runs
`apps/client/scripts/assemble-pages.mjs`, which runs this build and copies `site/dist/` around
the app. `CLOUDFLARE_PAGES_DEPLOYMENT.md` explains the layout and how to build it locally
(`pnpm --filter herobyte-client build:pages`).

The landing page forwards old links that carry one of the app's query parameters
(`APP_PARAMS` in `build.mjs`: `room`, `sessionUid`, `mobile`, `ws`) to `/play/`, so invites sent
as `herobyte.pages.dev/?room=...` still reach the table (when JavaScript is on). If the app starts
reading a new query parameter, add it there yourself: the test in
`apps/client/src/__tests__/pagesLayout.test.ts` only sees `.get("name")`, `.getAll("name")` or `.has("name")` with a double-quoted name, in `.ts`/`.tsx` files that mention `URLSearchParams` or `searchParams`; not a
name in a variable or constant, another quote style, or iteration. Any other query (`?fbclid=` on a shared post) stays on the landing
page, and so does a bare `/`, including the Main Hall's old invite link (the bare address). An
installed app (standalone display) that opens the landing page from outside the site is forwarded
to `/play/`; from a same-origin page (the site's own Home, Features and FAQ links) it stays, so the
site can still be read there. A link carrying an app parameter forwards either way.

`pages/404.html` is built with root-absolute links, because Pages serves it at whatever address
was not found.

## Checks used while building it

- Every `href`/`src` in `site/dist` and every `#anchor` resolved (488 references, 0 broken, before
  the `/play/` move; again with the lesson videos, 2026-10-14), and every search entry points at a
  real anchor. The `/play/` app links and
  `404.html`'s root-absolute links resolve only in the assembled layout; re-run the count there.
- No page scrolls sideways at 375 px or 1280 px wide; the guides' wide tables scroll inside their
  own box.
- Search and the Player/DM filter work in a browser. The lesson videos (2026-10-14): the first
  press loads the whole file and the chapter buttons land on their chapters on the Cloudflare
  preview, in the app pane's Chrome (from memory) and Playwright's WebKit (its fallback, the
  file's own address). Not checked on a real iPhone.
