// Builds the HeroByte website into site/dist/. No dependencies: `node site/build.mjs`.
//
// - Pages in site/pages/ are page bodies; each starts with a <!--meta {...}--> line and is
//   wrapped in the shared layout below.
// - The user guides in docs/user-guide/*.md are rendered to site/dist/help/guide/*.html, so
//   the help center links to the same text the app's docs maintain. Headings get GitHub-style
//   ids, so the guides' own cross-links (getting-started.md#becoming-the-dm) keep working.
// - site/dist/help/search-index.json holds every guide section for the help search.
import { realpathSync } from "node:fs";
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
  // For link previews (Discord, Slack): their crawlers want an absolute image URL.
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
// ws; pagesLayout.test.ts fails if the app reads a literal one not listed). A link to / that
// carries one is an invite or bookmark from before the app moved to /play/, so the landing page
// forwards it there. Other queries (?fbclid= on a shared post, ?utm_*) stay. A bare / stays too:
// the owner chose the landing page for it, and that includes the default table's old invite link.
export const APP_PARAMS = ["room", "sessionUid", "mobile", "ws"];

/**
 * Where the landing page sends a visitor: the app with the same query and hash, or null to stay.
 * An installed app always goes to the app: iOS home-screen icons keep the address they were added
 * with (often /), and other installs open / until they re-read the manifest. Never forwards from
 * the app's own address, so a landing page served there by mistake cannot loop.
 */
export function appForwardTarget(search, hash, pathname, standalone, appUrl, params) {
  if (pathname.indexOf(appUrl) === 0) return null;
  const query = new URLSearchParams(search);
  return standalone || params.some((name) => query.has(name)) ? appUrl + search + hash : null;
}

// The landing page's first script. It hides the page while it forwards, so an old invite does not
// flash the website while /play/ loads. Exported for the test, which runs this exact text.
export const forwarderScript = `(function(){var s=navigator.standalone===true||!!(window.matchMedia&&matchMedia("(display-mode: standalone)").matches);var t=(${appForwardTarget})(location.search,location.hash,location.pathname,s,${JSON.stringify(
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
const fill = (s, root) =>
  s
    .replace(/\{\{app\}\}/g, SITE.appUrl)
    .replace(/\{\{root\}\}/g, root)
    .replace(/\{\{mainHallLine\}\}/g, mainHallLine);

// ---------- build ----------

async function build() {
  // Empty dist rather than removing it: on Windows a server serving from it holds the folder.
  await mkdir(out, { recursive: true });
  for (const e of await readdir(out)) await rm(path.join(out, e), { recursive: true, force: true });
  await mkdir(path.join(out, "help", "guide"), { recursive: true });
  // Not "assets/": that is the app's content-hashed bundle folder, cached for a year (_headers).
  await cp(path.join(here, "assets"), path.join(out, "site-assets"), { recursive: true });
  await cp(path.join(guideDir, "img"), path.join(out, "img"), { recursive: true });

  const guideFiles = new Set(GUIDES.map((g) => g.file));
  const index = [];

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
      path.join(out, "help", "guide", href),
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
    const body = fill(src.slice(m[0].length), root);
    await mkdir(path.dirname(path.join(out, rel)), { recursive: true });
    const head = rel === "index.html" ? `${forwarder}\n` : "";
    await writeFile(path.join(out, rel), layout({ ...meta, body, root, head }));
    if (meta.search) {
      const words = body
        .replace(/<(script|style|nav|aside)[\s\S]*?<\/>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      index.push({ t: meta.search, g: "Lessons", a: meta.aud ?? "everyone", u: rel.replace(/^help\//, ""), x: `${meta.description} ${words}`.slice(0, 2000) });
    }
  }

  await writeFile(path.join(out, "help", "search-index.json"), JSON.stringify(index));
  console.log(`built ${out}: ${index.length} search entries`);
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
