# HeroByte website

The public website: a landing page, a help center with search, lesson pages, and the five user
guides from `docs/user-guide/` rendered as web pages. The design is the "HeroByte Website" canvas
(claude.ai artifact); this folder is the working version of it.

Plain HTML, CSS and a little JavaScript. No dependencies and no framework.

## Build and preview

```bash
node site/build.mjs
```

That writes `site/dist/` (git-ignored, like every `dist/`). To look at it, serve that folder,
for example with `python -m http.server 4321 --directory site/dist`, and open
http://localhost:4321/. Its **Open HeroByte** links go to `/play/`, where the app lives once
deployed; to try them locally, build the whole Cloudflare layout instead (below).

## What is where

| Path                | What it is                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `build.mjs`         | The build, plus `SITE`: the app link, the site's public address (`origin`, for link previews), the Main Hall passwords, and the links still to fill in. |
| `pages/`            | Hand-written page bodies. The first line is `<!--meta {...}-->` (title, description, scripts, search). |
| `assets/`           | `site.css`, `help.js` (topic filter and search), `lesson.js` (chapter stills), the favicon. Served at `/site-assets/`, because `/assets/` is the app's bundle, cached for a year. |
| `docs/user-guide/*` | Not copied by hand: the build renders the guides and copies `docs/user-guide/img/`.                     |
| `narration/`        | Lesson narration with ElevenLabs (see below). Audio output and the API key are git-ignored.             |

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
- Videos: every lesson says "Video coming soon". The scripts and shot lists are in
  `docs/website/video-scripts.md`.
- The voice copy describes the rebuilt voice chat (phones and PCs), live on `main` since
  2026-10-07 (`6decc06d`).

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
  the `/play/` move), and every search entry points at a real anchor. The `/play/` app links and
  `404.html`'s root-absolute links resolve only in the assembled layout; re-run the count there.
- No page scrolls sideways at 375 px or 1280 px wide; the guides' wide tables scroll inside their
  own box.
- Search, the Player/DM filter and the chapter buttons work in a browser.
