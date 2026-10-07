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
http://localhost:4321/.

## What is where

| Path                | What it is                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `build.mjs`         | The build, plus `SITE`: the app link, the Main Hall passwords, and the links still to fill in.          |
| `pages/`            | Hand-written page bodies. The first line is `<!--meta {...}-->` (title, description, scripts, search). |
| `assets/`           | `site.css`, `help.js` (topic filter and search), `lesson.js` (chapter stills), the favicon.             |
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

## Deploying (not set up)

The app already lives at `herobyte.pages.dev`, so the website needs its own Cloudflare Pages
project (or its own domain). Settings for one: root directory `/` (the repo), build command
`node site/build.mjs`, output directory `site/dist`. No environment variables.

## Checks used while building it

- Every `href`/`src` in `site/dist` and every `#anchor` resolves (488 references, 0 broken),
  and every search entry points at a real anchor.
- No page scrolls sideways at 375 px or 1280 px wide; the guides' wide tables scroll inside their
  own box.
- Search, the Player/DM filter and the chapter buttons work in a browser.
