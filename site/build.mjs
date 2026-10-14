// Builds the HeroByte website into site/dist/. No dependencies: `node site/build.mjs`.
//
// - Pages in site/pages/ are page bodies; each starts with a <!--meta {...}--> line and is
//   wrapped in the shared layout below.
// - The user guides in docs/user-guide/*.md are rendered to site/dist/help/guide/*.html, so
//   the help center links to the same text the app's docs maintain. Headings get GitHub-style
//   ids, so the guides' own cross-links (getting-started.md#becoming-the-dm) keep working.
// - site/dist/help/search-index.json holds every guide section for the help search.
import { realpathSync, statSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const out = path.join(here, "dist");
const guideDir = path.join(repo, "docs", "user-guide");

// Links to fill in before going public. A null link is left out of the page entirely.
export const SITE = {
  // The app is served from the same Cloudflare Pages project, under /play/ (the site is at /).
  appUrl: "/play/",
  // For link previews (Discord, Slack): their crawlers want an absolute image URL. Change it if the
  // Pages project is served at another address.
  origin: "https://herobyte.pages.dev",
  sourceUrl: null,
  bugUrl: null,
  contactUrl: null,
  // The Main Hall is the public test table on purpose (its passwords are the published
  // defaults). Set both to null to stop printing them; the card then says to ask the host.
  mainHall: { password: "Fun1", dmPassword: "FunDM" },
  year: 2026,
};

// The query parameters the app reads (apps/client/src: room, SESSION_UID_OVERRIDE_PARAM, mobile,
// ws). Add a new one here yourself: pagesLayout.test.ts only sees .get/.getAll/.has("name") with a
// double-quoted name, in .ts/.tsx files that mention URLSearchParams or searchParams. A link
// to / that carries one is an invite or bookmark from before the app moved to /play/, so the
// landing page forwards it there. Other queries (?fbclid= on a shared post, ?utm_*) stay. A bare /
// stays too: the owner chose the landing page for it, and that includes the default table's old
// invite link.
export const APP_PARAMS = ["room", "sessionUid", "mobile", "ws"];

/**
 * Where the landing page sends a visitor: the app with the same query and hash, or null to stay.
 * An installed app (standalone display) that arrives from outside the site goes to the app: iOS
 * home-screen icons can keep the address they were added with (often /), and browsers re-read the
 * manifest on their own schedule. Arriving from a same-origin page (fromSite: the site's own Home,
 * Features and FAQ links) means the person is reading the site, so it stays; a link carrying an
 * app parameter still forwards. Never forwards from the app's own address, so a landing
 * page served there by mistake does not forward to itself.
 */
export function appForwardTarget(search, hash, pathname, standalone, fromSite, appUrl, params) {
  if (pathname.indexOf(appUrl) === 0) return null;
  const query = new URLSearchParams(search);
  const forward = (standalone && !fromSite) || params.some((name) => query.has(name));
  return forward ? appUrl + search + hash : null;
}

// The landing page's first script (it needs JavaScript). It hides the page while it forwards, so
// an old invite does not flash the website while /play/ loads. Exported for the test, which runs
// this exact text.
export const forwarderScript = `(function(){var s=navigator.standalone===true||!!(window.matchMedia&&matchMedia("(display-mode: standalone)").matches);var f=false;try{f=!!document.referrer&&new URL(document.referrer).origin===location.origin}catch(e){}var t=(${appForwardTarget})(location.search,location.hash,location.pathname,s,f,${JSON.stringify(
  SITE.appUrl,
)},${JSON.stringify(APP_PARAMS)});if(t){document.documentElement.style.visibility="hidden";location.replace(t);}})();`;
const forwarder = `<script>${forwarderScript}</script>`;

const GUIDES = [
  { file: "getting-started.md", title: "Getting started", aud: "everyone" },
  { file: "player-guide.md", title: "Player guide", aud: "player" },
  { file: "dm-guide.md", title: "DM guide", aud: "dm" },
  { file: "running-a-game.md", title: "Running a game", aud: "dm" },
  { file: "map-editor-guide.md", title: "Map editor guide", aud: "dm" },
];

// ---------- lessons ----------

// The lesson videos: site/lessons.json (chapters and the written version) and site/media/ (the
// videos and their posters) come from site/video/tools/site-lessons.mjs after a render. Here is
// what only the website decides: each lesson's page, the guide section that covers it in full, and
// its YouTube video once it is uploaded. A `youtube` id swaps the page's own video for the YouTube
// player; before setting the first one, allow it in the CSP (apps/client/public/_headers:
// `frame-src https://www.youtube-nocookie.com`), or the browser shows an empty box.
// A `hand` page is written in pages/help/ and places the video with {{video:<id>}}; the others
// are built from lessons.json. `notes` (by chapter number) add a line under what the narrator says
// where the video says less than the app does, until the video is re-recorded.
export const LESSON_PAGES = {
  "player-quick-start": { page: "player-quick-start.html", hand: true, youtube: null },
  "dm-quick-start": { page: "dm-quick-start.html", hand: true, youtube: null },
  "player-path-1": {
    page: "join-a-table.html",
    guide: ["guide/getting-started.html#joining-a-table", "Getting started: Joining a table"],
    youtube: null,
    notes: {
      3: "Six hours is the longest your seat is held. A server restart for an update ends the hold sooner. Once it ends, anyone with the table password can take the seat, and a DM needs the DM password again.",
    },
  },
  "player-path-2": {
    page: "the-table-at-a-glance.html",
    guide: ["guide/player-guide.html#the-table-at-a-glance", "Player guide: The table at a glance"],
    youtube: null,
    notes: {
      4: "A whisper is kept for the seats of its sender and its recipient. If a seat has been empty for more than six hours, or the server has restarted for an update, anyone with the table password can claim it and read the whispers stored for it.",
    },
  },
  "player-path-3": { page: "your-character-card.html", guide: ["guide/player-guide.html#your-character-card", "Player guide: Your character card"], youtube: null },
  "player-path-4": {
    page: "roll-dice.html",
    guide: ["guide/player-guide.html#dice", "Player guide: Dice"],
    youtube: null,
    notes: {
      2: "A hidden roll is kept for its seat. If a seat has been empty for more than six hours, or the server has restarted for an update, anyone with the table password can claim it and read the hidden rolls stored for it.",
    },
  },
  "player-path-5": { page: "draw-measure-and-ping.html", guide: ["guide/player-guide.html#drawing-measuring-pointing", "Player guide: Drawing, measuring, pointing"], youtube: null },
  "player-path-6": { page: "fog-doors-and-sight.html", guide: ["guide/player-guide.html#doors-fog-and-what-you-can-see", "Player guide: Doors, fog and what you can see"], youtube: null },
  "dm-path-1": { page: "create-a-private-table.html", guide: ["guide/getting-started.html#creating-a-private-table", "Getting started: Creating a private table"], youtube: null },
  "dm-path-2": { page: "become-the-dm.html", guide: ["guide/getting-started.html#becoming-the-dm", "Getting started: Becoming the DM"], youtube: null },
  "dm-path-3": { page: "three-ways-to-get-a-map.html", guide: ["guide/running-a-game.html", "Running a game"], youtube: null },
  "dm-path-4": { page: "build-your-first-room.html", hand: true, youtube: null },
  "dm-path-5": {
    page: "walls-doors-and-fog.html",
    guide: ["guide/map-editor-guide.html#-wall-and--door", "Map editor guide: Wall and Door"],
    youtube: null,
    notes: {
      4: "Fog keeps tokens, NPCs, props and pings out of a player's browser until their characters can see them. The map is different: its floor plan, walls, ordinary doors, lights and any drawings are sent to every player's browser, and fog only darkens them on screen. A secret door is sent as plain wall, but the floor around it still goes.",
    },
  },
  "dm-path-6": { page: "npcs-and-the-token-library.html", guide: ["guide/dm-guide.html#npcs--monsters", "DM guide: NPCs and monsters"], youtube: null },
  "dm-path-7": { page: "run-your-first-combat.html", guide: ["guide/dm-guide.html#encounter", "DM guide: Encounter"], youtube: null },
  "dm-path-8": { page: "backups-and-keeping-your-work.html", guide: ["guide/dm-guide.html#backups", "DM guide: Backups"], youtube: null },
};
const PATHS = {
  player: ["player-path-1", "player-path-2", "player-path-3", "player-path-4", "player-path-5", "player-path-6"],
  dm: ["dm-path-1", "dm-path-2", "dm-path-3", "dm-path-4", "dm-path-5", "dm-path-6", "dm-path-7", "dm-path-8"],
};
const QUICK_START = { player: "player-quick-start", dm: "dm-quick-start" };
const COLOR = { player: "blue", dm: "gold" };

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const PLAY_ICON = `<svg width="22" height="22" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="#14100a"></path></svg>`;

// A video from site/media/. Cloudflare Pages answers a Range request with the whole file, so a
// video streamed from it cannot seek (no scrubbing, no chapter buttons) and Safari may refuse it
// outright. So the page shows the poster and a play button, and lesson.js downloads the whole file
// on the first press and plays it from memory (a blob: URL, allowed by media-src in
// apps/client/public/_headers), where seeking always works.
function mp4Screen(id, label, root) {
  return `<div class="screen"><video preload="none" playsinline poster="${root}media/${id}.jpg" data-src="${root}media/${id}.mp4" aria-label="${esc(label)}"></video><button type="button" class="video-start" aria-label="Play: ${esc(label)}"><span class="play-box">${PLAY_ICON}</span></button><span class="video-status" role="status"></span></div>`;
}
function mp4Download(id, root) {
  const mb = statSync(path.join(here, "media", `${id}.mp4`)).size / 1e6;
  return `<a href="${root}media/${id}.mp4" download>Download the video (${mb.toFixed(mb < 10 ? 1 : 0)} MB)</a>`;
}

/** The video and its chapter buttons, at the top of a lesson page. */
function videoBlock(lesson, root) {
  const { youtube } = LESSON_PAGES[lesson.id];
  const label = `${lesson.heading}: ${lesson.title}`;
  const player = youtube
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${youtube}" data-base="https://www.youtube-nocookie.com/embed/${youtube}" title="${esc(label)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
    : null;
  const chapters = lesson.chapters
    .map(
      (c, i) =>
        `<li><button type="button" aria-current="${i === 0}" data-t="${c.start}"><span>${i + 1}</span><span>${esc(c.title)}</span><span class="at">${clock(c.start)}</span></button></li>`,
    )
    .join("\n");
  return `<section class="player" aria-label="Video lesson">
${player ? `<div class="screen">${player}</div>` : mp4Screen(lesson.id, label, root)}
<div class="chapters">
<div class="chapters-head"><h2>Chapters · ${clock(lesson.duration)}</h2>${player ? "" : mp4Download(lesson.id, root)}</div>
<ol>
${chapters}
</ol>
</div>
</section>`;
}

/** A path's lessons in order, for the help center and the lesson pages' asides. */
function pathList(aud, current, root, lessons) {
  return `<ol>\n${PATHS[aud]
    .map((id, i) => {
      const l = lessons.get(id);
      const here = id === current ? ' aria-current="page"' : "";
      return `<li><a href="${root}help/${LESSON_PAGES[id].page}"${here}><span class="n ${COLOR[aud]}">${i + 1}</span><span class="t">${esc(l.title)}</span><span class="kind ${COLOR[aud]}">${clock(l.duration)}</span></a></li>`;
    })
    .join("\n")}\n</ol>`;
}

/** One card per lesson video, grouped by path, for the help center. */
function lessonCards(root, lessons) {
  const card = (id, tag) => {
    const l = lessons.get(id);
    return `<a class="video-card" href="${root}help/${LESSON_PAGES[id].page}"><div class="thumb"><img src="${root}media/${id}.jpg" alt="" loading="lazy"><div class="play"><div class="play-box">${PLAY_ICON}</div></div><span class="badge">${clock(l.duration)}</span></div><span class="tag ${COLOR[l.aud]}">${tag}</span><span class="title">${esc(l.title)}</span></a>`;
  };
  const group = (title, cards) =>
    `<h3 class="h3 lesson-group">${title}</h3>\n<div class="grid" style="--min: 250px; --gap: 24px">\n${cards.join("\n")}\n</div>`;
  return [
    group("QUICK STARTS", [card(QUICK_START.player, "Player quick start"), card(QUICK_START.dm, "DM quick start")]),
    group("PLAYER PATH", PATHS.player.map((id, i) => card(id, `Player ${i + 1} of ${PATHS.player.length}`))),
    group("DM PATH", PATHS.dm.map((id, i) => card(id, `DM ${i + 1} of ${PATHS.dm.length}`))),
  ].join("\n");
}

/** A lesson page built from lessons.json: the video, its chapters written out, the path around it. */
function lessonPage(lesson, lessons) {
  const root = "../";
  const color = COLOR[lesson.aud];
  const path = PATHS[lesson.aud];
  const at = path.indexOf(lesson.id);
  const pathName = lesson.aud === "dm" ? "DM path" : "Player path";
  const [guideHref, guideLabel] = LESSON_PAGES[lesson.id].guide;
  const notes = LESSON_PAGES[lesson.id].notes ?? {};
  const prevId = at > 0 ? path[at - 1] : QUICK_START[lesson.aud];
  const prev = lessons.get(prevId);
  const nextId = path[at + 1];
  const next = nextId && lessons.get(nextId);
  const steps = lesson.chapters
    .map(
      (c, i) => `<article class="step" id="chapter-${i + 1}">
<div class="step-head"><span class="num ${color}">${i + 1}</span><h3>${esc(c.title)}</h3><button type="button" class="seek" data-seek="${c.start}" aria-label="Play chapter ${i + 1} from ${clock(c.start)}">▶ ${clock(c.start)}</button></div>
${c.say.map((s) => `<p>${esc(s)}</p>`).join("\n")}${notes[i + 1] ? `\n<p class="note"><b>NOTE</b> ${esc(notes[i + 1])}</p>` : ""}
</article>`,
    )
    .join("\n\n");
  const body = `<main id="main" class="wrap page">
<nav aria-label="Breadcrumb" class="crumbs"><a href="index.html">Help</a><span aria-hidden="true">/</span><a href="index.html#paths">${pathName}</a><span aria-hidden="true">/</span><span>${esc(lesson.title)}</span></nav>

<div class="intro">
<div class="tags"><span class="tag-box ${lesson.aud}">${lesson.aud === "dm" ? "DM" : "PLAYER"}</span><span class="tag-box">${pathName.toUpperCase()} · ${at + 1} OF ${path.length}</span><span class="tag-box">VIDEO · ${clock(lesson.duration)}</span></div>
<h1>${esc(lesson.title)}</h1>
<p class="lead">${esc(lesson.lead)}</p>
</div>

<div class="with-aside">
<div>

${videoBlock(lesson, root)}

<section aria-labelledby="written" style="display: flex; flex-direction: column; gap: 36px">
<div class="written-head">
<h2 id="written">Step by step</h2>
<p>What the narrator says in the video, chapter by chapter. A NOTE marks a place where the video says less than the app does. Press a time to play that part.</p>
</div>

${steps}

<div class="callout ${color}"><b>IN THE GUIDE</b><p>The guide goes deeper, starting at <a href="${guideHref}">${esc(guideLabel)}</a>.</p></div>
</section>

<nav class="lesson-nav" aria-label="Lesson navigation">
<a href="${LESSON_PAGES[prevId].page}"><span>BACK</span><span>${esc(prev.title)}</span></a>
${
  next
    ? `<a class="next ${lesson.aud}" href="${LESSON_PAGES[nextId].page}"><span>NEXT · ${pathName.toUpperCase()}</span><span>${esc(next.title)}</span></a>`
    : `<a class="next ${lesson.aud}" href="index.html#videos"><span>PATH COMPLETE</span><span>Every lesson</span></a>`
}
</nav>
</div>

<aside class="aside">
<div class="panel ${color} path">
<h2 class="panel-title ${color}">${pathName.toUpperCase()}</h2>
${pathList(lesson.aud, lesson.id, root, lessons)}
</div>
<div class="panel">
<h2 class="panel-title">IN THE GUIDE</h2>
<a href="${guideHref}" class="small">${esc(guideLabel)}</a>
<a href="${LESSON_PAGES[QUICK_START[lesson.aud]].page}" class="small">${lesson.aud === "dm" ? "DM" : "Player"} quick start</a>
</div>
</aside>
</div>
</main>`;
  return body;
}

// ---------- markdown ----------

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-");
}

function plain(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "");
}

function rewriteHref(href, ctx) {
  if (/^https?:/.test(href)) return href;
  if (href.startsWith("#")) return href;
  const [file, hash] = href.split("#");
  if (/^[a-z-]+\.md$/.test(file) && ctx.guideFiles.has(file)) {
    return file.replace(/\.md$/, ".html") + (hash ? `#${hash}` : "");
  }
  return null; // a file outside the guides: keep the text, drop the link
}

function inline(src, ctx) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src2) => {
    const file = src2.replace(/^img\//, "");
    return `<img src="${ctx.imgBase}${esc(file)}" alt="${alt}" loading="lazy">`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const h = rewriteHref(href.replace(/&amp;/g, "&"), ctx);
    return h === null ? text : `<a href="${esc(h)}">${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(“"'—–-])_([^_\s][^_]*?)_(?=[\s).,;:!?”"'—–-]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => codes[Number(n)]);
  return s;
}

const itemRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const indentOf = (l) => l.match(/^ */)[0].length;
const isBlank = (l) => l.trim() === "";

function parseList(lines, start, ctx) {
  const first = lines[start].match(itemRe);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(itemRe);
    if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
    const contentIndent = base + m[2].length + 1;
    const body = [m[3]];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (isBlank(l)) {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) >= contentIndent) {
          body.push("");
          i = j;
          continue;
        }
        break;
      }
      const im = l.match(itemRe);
      if (indentOf(l) >= contentIndent || (im && im[1].length > base)) {
        body.push(l.slice(Math.min(indentOf(l), contentIndent)));
        i++;
        continue;
      }
      if (!im && !isBlank(body[body.length - 1])) {
        body.push(l.trim()); // lazy continuation of the item's paragraph
        i++;
        continue;
      }
      break;
    }
    let html = blocks(body, ctx);
    if (!body.includes("")) html = html.replace(/^<p>([\s\S]*?)<\/p>/, "$1");
    items.push(`<li>${html}</li>`);
    // a blank line between items of the same list keeps the list going
    if (i < lines.length && isBlank(lines[i])) {
      let j = i;
      while (j < lines.length && isBlank(lines[j])) j++;
      const nm = j < lines.length && lines[j].match(itemRe);
      if (nm && nm[1].length === base && /\d/.test(nm[2]) === ordered) i = j;
    }
  }
  const tag = ordered ? "ol" : "ul";
  return { html: `<${tag}>${items.join("")}</${tag}>`, next: i };
}

function splitRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function blocks(lines, ctx) {
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      let id = slugify(plain(text));
      const n = ctx.ids.get(id) ?? 0;
      ctx.ids.set(id, n + 1);
      if (n) id = `${id}-${n}`;
      ctx.headings.push({ level, text: plain(text), id });
      html.push(`<h${level} id="${id}">${inline(text, ctx)}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      html.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      const th = head.map((c) => `<th scope="col">${inline(c, ctx)}</th>`).join("");
      const tb = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join("")}</tr>`).join("");
      html.push(`<div class="table-box"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*> ?/, ""));
      html.push(`<blockquote>${blocks(buf, ctx)}</blockquote>`);
      continue;
    }
    if (itemRe.test(line)) {
      const { html: list, next } = parseList(lines, i, ctx);
      html.push(list);
      i = next;
      continue;
    }
    const para = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !itemRe.test(lines[i]) &&
      !/^\s*[>|]/.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    const text = para.join(" ");
    const img = text.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (img) {
      html.push(`<figure>${inline(text, ctx)}<figcaption>${inline(img[1], ctx)}</figcaption></figure>`);
    } else {
      html.push(`<p>${inline(text, ctx)}</p>`);
    }
  }
  return html.join("\n");
}

export function renderMarkdown(md, opts = {}) {
  const ctx = {
    ids: new Map(),
    headings: [],
    imgBase: opts.imgBase ?? "img/",
    guideFiles: opts.guideFiles ?? new Set(),
  };
  const html = blocks(md.replace(/\r\n/g, "\n").split("\n"), ctx);
  return { html, headings: ctx.headings };
}

// ---------- layout ----------

function header(root, current) {
  const link = (href, label, key) =>
    `<a href="${root}${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="site-header">
<nav class="wrap nav" aria-label="Main">
<a class="brand" href="${root}index.html"><span class="brand-name">HEROBYTE</span><span class="brand-tag">virtual tabletop</span></a>
<div class="nav-links">
${link("index.html#features", "Features", "features")}
${link("index.html#faq", "FAQ", "faq")}
${link("help/index.html", "Help &amp; tutorials", "help")}
<a class="btn btn-gold btn-sm" href="${SITE.appUrl}">OPEN HEROBYTE</a>
</div>
</nav>
</header>`;
}

function footer(root) {
  const project = [
    SITE.sourceUrl && `<a href="${SITE.sourceUrl}">Source code</a>`,
    SITE.bugUrl && `<a href="${SITE.bugUrl}">Report a bug</a>`,
    SITE.contactUrl && `<a href="${SITE.contactUrl}">Contact</a>`,
  ].filter(Boolean);
  return `<footer class="site-footer">
<div class="wrap footer-cols">
<div class="footer-brand"><span class="brand-name">HEROBYTE</span><span>A retro virtual tabletop that runs in the browser.</span></div>
<div class="footer-col"><span class="eyebrow muted">Learn</span>
<a href="${root}help/index.html">Help center</a>
<a href="${root}help/guide/player-guide.html">Player guide</a>
<a href="${root}help/guide/dm-guide.html">DM guide</a>
<a href="${root}help/guide/map-editor-guide.html">Map editor guide</a>
</div>
${project.length ? `<div class="footer-col"><span class="eyebrow muted">Project</span>\n${project.join("\n")}\n</div>` : ""}
</div>
<div class="wrap footer-legal">© ${SITE.year} HeroByte</div>
</footer>`;
}

function layout({ title, description, body, root, current, scripts = [], head = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${head}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE.origin}/logo-wide.webp">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}site-assets/site.css">
<link rel="icon" href="${root}site-assets/favicon.svg" type="image/svg+xml">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(root, current)}
${body}
${footer(root)}
${scripts.map((s) => `<script src="${root}site-assets/${s}" defer></script>`).join("\n")}
</body>
</html>
`;
}

// Fill {{app}} and {{root}} in hand-written pages.
const mainHallLine = SITE.mainHall.password
  ? `Table password <code>${SITE.mainHall.password}</code>` +
    (SITE.mainHall.dmPassword ? `, and <code>${SITE.mainHall.dmPassword}</code> to try the DM tools.` : ".")
  : "Ask the host for the Main Hall password.";
// The lesson placeholders: {{video:<id>}}, {{pathList:<player|dm>}} (or {{pathList:dm:<id>}} to mark one) and
// {{lessonCards}}; for any other video in media/, {{screen:<id>:<label>}} and {{download:<id>}}.
const lessonOf = (lessons, id) => {
  const l = lessons.get(id);
  if (!l) throw new Error(`no lesson "${id}" in site/lessons.json`);
  return l;
};
const fill = (s, root, lessons) =>
  s
    .replace(/\{\{app\}\}/g, SITE.appUrl)
    .replace(/\{\{root\}\}/g, root)
    .replace(/\{\{mainHallLine\}\}/g, mainHallLine)
    .replace(/\{\{video:([a-z0-9-]+)\}\}/g, (_, id) => videoBlock(lessonOf(lessons, id), root))
    .replace(/\{\{pathList:(player|dm)(?::([a-z0-9-]+))?\}\}/g, (_, aud, cur) => pathList(aud, cur, root, lessons))
    .replace(/\{\{lessonCards\}\}/g, () => lessonCards(root, lessons))
    .replace(/\{\{screen:([a-z0-9-]+):([^}]+)\}\}/g, (_, id, label) => mp4Screen(id, label, root))
    .replace(/\{\{download:([a-z0-9-]+)\}\}/g, (_, id) => mp4Download(id, root));

// ---------- build ----------

export async function build(dest = out) {
  // Empty dist rather than removing it: on Windows a server serving from it holds the folder.
  await mkdir(dest, { recursive: true });
  for (const e of await readdir(dest)) await rm(path.join(dest, e), { recursive: true, force: true });
  await mkdir(path.join(dest, "help", "guide"), { recursive: true });
  // Not "assets/": that is the app's content-hashed bundle folder, cached for a year (_headers).
  await cp(path.join(here, "assets"), path.join(dest, "site-assets"), { recursive: true });
  await cp(path.join(guideDir, "img"), path.join(dest, "img"), { recursive: true });
  await cp(path.join(here, "media"), path.join(dest, "media"), { recursive: true });

  const guideFiles = new Set(GUIDES.map((g) => g.file));
  const index = [];
  const lessons = new Map(
    JSON.parse(await readFile(path.join(here, "lessons.json"), "utf8")).lessons.map((l) => [l.id, l]),
  );
  for (const id of Object.keys(LESSON_PAGES)) lessonOf(lessons, id);

  for (const l of lessons.values()) {
    const p = LESSON_PAGES[l.id];
    if (!p || p.hand) continue;
    const body = lessonPage(l, lessons);
    await writeFile(
      path.join(dest, "help", p.page),
      layout({ title: `${l.title} · HeroByte help`, description: l.lead, body, root: "../", current: "help", scripts: ["lesson.js"] }),
    );
    const words = l.chapters.map((c) => `${c.title}. ${c.say.join(" ")}`).join(" ");
    index.push({ t: `${l.heading}: ${l.title}`, g: "Lessons", a: l.aud, u: p.page, x: `${l.lead} ${words}`.slice(0, 2000) });
  }

  for (const g of GUIDES) {
    const md = await readFile(path.join(guideDir, g.file), "utf8");
    const { html, headings } = renderMarkdown(md, { imgBase: "../../img/", guideFiles });
    const href = g.file.replace(/\.md$/, ".html");
    const toc = headings
      .filter((h) => h.level === 2)
      .map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`)
      .join("");
    const others = GUIDES.filter((o) => o !== g)
      .map((o) => `<li><a href="${o.file.replace(/\.md$/, ".html")}">${o.title}</a></li>`)
      .join("");
    const body = `<main id="main" class="wrap page">
<nav aria-label="Breadcrumb" class="crumbs"><a href="../index.html">Help</a><span aria-hidden="true">/</span><span>${g.title}</span></nav>
<div class="with-aside">
<article class="prose">${html}</article>
<aside class="aside">
<nav class="panel" aria-label="On this page"><h2 class="panel-title">ON THIS PAGE</h2><ol class="toc">${toc}</ol></nav>
<nav class="panel" aria-label="Other guides"><h2 class="panel-title">OTHER GUIDES</h2><ul class="toc">${others}</ul></nav>
</aside>
</div>
</main>`;
    await writeFile(
      path.join(dest, "help", "guide", href),
      layout({ title: `${g.title} · HeroByte help`, description: `The HeroByte ${g.title.toLowerCase()}.`, body, root: "../../", current: "help" }),
    );
    // one search entry per section, text up to the next heading of the same or higher level
    const sections = md.replace(/\r\n/g, "\n").split(/\n(?=#{2,4} )/);
    let hi = 0;
    for (const sec of sections) {
      const m = sec.match(/^(#{1,4}) (.*)/);
      if (!m) continue;
      const h = headings.find((x, k) => k >= hi && x.text === plain(m[2].trim()));
      if (!h) continue;
      hi = headings.indexOf(h) + 1;
      const text = plain(sec.split("\n").slice(1).join(" ")).replace(/\s+/g, " ").trim();
      index.push({ t: h.text, g: g.title, a: g.aud, u: `guide/${href}#${h.id}`, x: text.slice(0, 2000) });
    }
  }

  const pagesDir = path.join(here, "pages");
  for (const rel of await listHtml(pagesDir)) {
    const src = await readFile(path.join(pagesDir, rel), "utf8");
    const m = src.match(/^<!--meta (\{[\s\S]*?\})-->\n/);
    if (!m) throw new Error(`${rel}: missing <!--meta {...}--> line`);
    const meta = JSON.parse(m[1]);
    const depth = rel.split("/").length - 1;
    // 404.html is served at whatever address was not found, so its links must not be relative.
    const root = rel === "404.html" ? "/" : "../".repeat(depth);
    const body = fill(src.slice(m[0].length), root, lessons);
    await mkdir(path.dirname(path.join(dest, rel)), { recursive: true });
    const head = rel === "index.html" ? `${forwarder}\n` : "";
    await writeFile(path.join(dest, rel), layout({ ...meta, body, root, head }));
    if (meta.search) {
      const words = body
        .replace(/<(script|style|nav|aside)\b[\s\S]*?<\/\1>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      index.push({ t: meta.search, g: "Lessons", a: meta.aud ?? "everyone", u: rel.replace(/^help\//, ""), x: `${meta.description} ${words}`.slice(0, 2000) });
    }
  }

  await writeFile(path.join(dest, "help", "search-index.json"), JSON.stringify(index));
  console.log(`built ${dest}: ${index.length} search entries`);
}

async function listHtml(dir, prefix = "") {
  const found = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) found.push(...(await listHtml(path.join(dir, e.name), `${prefix}${e.name}/`)));
    else if (e.name.endsWith(".html")) found.push(`${prefix}${e.name}`);
  }
  return found;
}

// realpath both sides: Node resolves symlinks in import.meta.url but not in argv[1].
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await build();
}
