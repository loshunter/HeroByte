/**
 * The Cloudflare Pages layout: the website at /, the app at /play/ (scripts/assemble-pages.mjs).
 * The app's bundle and public files keep their root URLs, because saved tables and backups hold
 * them (/tokens/...). Old links to /?room=... are forwarded to /play/ by the landing page.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { SESSION_UID_OVERRIDE_PARAM } from "../utils/session";

const client = resolve(__dirname, "..", "..");
const repo = resolve(client, "..", "..");

// Plain .mjs build scripts: imported by URL so the typecheck does not need declarations for them.
const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(file).href);

const APP_PAGE =
  '<!doctype html><link rel="manifest" href="/manifest.json"><script type="module" src="/assets/index-abc.js"></script>';
// The real sources, so the tests see the build change what actually ships.
const MANIFEST = readFileSync(join(client, "public", "manifest.json"), "utf8");
const SW = readFileSync(join(client, "public", "sw.js"), "utf8");
const APP_FILES = { "index.html": APP_PAGE, "manifest.json": MANIFEST, "sw.js": SW };
const cacheList = (sw: string) =>
  JSON.parse(sw.match(/urlsToCache = (\[[^\]]*\])/)![1]) as string[];

let scratch: string | undefined;
function layout(app: Record<string, string>, site: Record<string, string>) {
  scratch = mkdtempSync(join(tmpdir(), "hb-pages-"));
  const write = (root: string, files: Record<string, string>) => {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
  };
  write(join(scratch, "app"), app);
  write(join(scratch, "site"), site);
  return { appDist: join(scratch, "app"), siteDist: join(scratch, "site") };
}
afterEach(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  scratch = undefined;
});

describe("assemblePages", () => {
  it("moves only the app page to /play/ and puts the website around it", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { ...APP_FILES, "assets/index-abc.js": "app", "tokens/goblin.png": "art" },
      { "index.html": "landing", "help/index.html": "help", "site-assets/site.css": "css" },
    );
    await assemblePages(dirs);
    const read = (rel: string) => readFileSync(join(dirs.appDist, rel), "utf8");
    expect(read("play/index.html")).toBe(APP_PAGE);
    expect(read("index.html")).toBe("landing");
    expect(read("help/index.html")).toBe("help");
    expect(read("assets/index-abc.js")).toBe("app");
    expect(read("tokens/goblin.png")).toBe("art");
  });

  it("moves the installed app's start page and the pre-cached page to /play/, nothing else", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(APP_FILES, { "index.html": "landing" });
    await assemblePages(dirs);
    const read = (rel: string) => readFileSync(join(dirs.appDist, rel), "utf8");
    // Without scope "/" the scope would shrink to /play/, and old /?room= links would leave the app.
    expect(JSON.parse(read("manifest.json"))).toEqual({
      ...JSON.parse(MANIFEST),
      start_url: "/play/",
    });
    const sw = read("sw.js");
    expect(cacheList(sw)).toEqual(cacheList(SW).map((u) => (u === "/" ? "/play/" : u)));
    expect(sw.replace(/urlsToCache = \[[^\]]*\]/, "")).toBe(
      SW.replace(/urlsToCache = \[[^\]]*\]/, ""),
    );
  });

  it("refuses a manifest or service worker it does not recognise, before writing anything", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const already = layout(
      { ...APP_FILES, "manifest.json": MANIFEST.replace('"start_url": "/"', '"start_url": "/x/"') },
      { "index.html": "landing" },
    );
    await expect(assemblePages(already)).rejects.toThrow(/start_url is \/x\//);
    rmSync(scratch!, { recursive: true, force: true });
    const noRoot = layout(
      { ...APP_FILES, "sw.js": SW.replace('urlsToCache = ["/",', 'urlsToCache = ["/play/",') },
      { "index.html": "landing" },
    );
    await expect(assemblePages(noRoot)).rejects.toThrow(/urlsToCache list holding "\/"/);
    expect(readFileSync(join(noRoot.appDist, "manifest.json"), "utf8")).toBe(MANIFEST);
    expect(existsSync(join(noRoot.appDist, "play"))).toBe(false);
  });

  it("refuses a file the site and the app both have, before moving anything", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { ...APP_FILES, "assets/index-abc.js": "app" },
      { "index.html": "landing", "assets/site.css": "css" },
    );
    await expect(assemblePages(dirs)).rejects.toThrow(/both have: assets/);
    expect(readFileSync(join(dirs.appDist, "index.html"), "utf8")).toBe(APP_PAGE);
    expect(existsSync(join(dirs.appDist, "play"))).toBe(false);
  });

  it("refuses a site entry named play, which would land inside the app's page folder", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(APP_FILES, { "index.html": "landing", "play/x.html": "x" });
    await expect(assemblePages(dirs)).rejects.toThrow(/both have: play/);
  });

  it("runs only on Cloudflare (CF_PAGES=1) or when forced", async () => {
    const { shouldAssemble } = await load(join(client, "scripts", "assemble-pages.mjs"));
    expect(shouldAssemble({ CF_PAGES: "1" }, [])).toBe(true);
    expect(shouldAssemble({}, ["--force"])).toBe(true);
    expect(shouldAssemble({}, [])).toBe(false);
    expect(shouldAssemble({ CF_PAGES: "0" }, [])).toBe(false);
  });

  it("refuses an app page with a relative URL, which would miss the bundle from /play/", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { "index.html": '<script type="module" src="assets/index-abc.js"></script>' },
      { "index.html": "landing" },
    );
    await expect(assemblePages(dirs)).rejects.toThrow(/relative URLs: assets\/index-abc.js/);
  });
});

describe("the landing page's forwarder (the script text that ships)", () => {
  /** Runs the shipped forwarder against a fake page; returns where it sent the visitor, or null. */
  async function visit(
    href: string,
    { standalone = false, iosStandalone = false, referrer = "" } = {},
  ) {
    const { forwarderScript } = await load(join(repo, "site", "build.mjs"));
    const url = new URL(href, "https://herobyte.pages.dev");
    let target: string | null = null;
    const style: { visibility?: string } = {};
    runInNewContext(forwarderScript, {
      URLSearchParams,
      URL,
      navigator: iosStandalone ? { standalone: true } : {},
      window: { matchMedia: true },
      matchMedia: (q: string) => ({ matches: standalone && q === "(display-mode: standalone)" }),
      document: { documentElement: { style }, referrer },
      location: {
        origin: url.origin,
        search: url.search,
        hash: url.hash,
        pathname: url.pathname,
        replace: (t: string) => (target = t),
      },
    });
    if (target) expect(style.visibility).toBe("hidden");
    return target;
  }

  it("sends an old link carrying any app parameter to /play/ with its query and hash", async () => {
    for (const name of ["room", "sessionUid", "mobile", "ws"]) {
      expect(await visit(`/?${name}=x`)).toBe(`/play/?${name}=x`);
    }
    expect(await visit("/?utm_source=a&room=fun#t")).toBe("/play/?utm_source=a&room=fun#t");
  });

  it("leaves a bare visit or a shared post's tracking query on the landing page", async () => {
    expect(await visit("/")).toBeNull();
    expect(await visit("/?fbclid=abc")).toBeNull();
  });

  it("sends an installed app arriving from outside the site to /play/", async () => {
    expect(await visit("/", { standalone: true })).toBe("/play/");
    expect(await visit("/", { iosStandalone: true })).toBe("/play/");
    expect(await visit("/", { standalone: true, referrer: "https://discord.com/" })).toBe("/play/");
  });

  it("lets an installed app read the landing page when it came from another site page", async () => {
    const fromHelp = "https://herobyte.pages.dev/help/index.html";
    expect(await visit("/", { standalone: true, referrer: fromHelp })).toBeNull();
    // An old invite still forwards, wherever it came from.
    expect(await visit("/?room=x", { standalone: true, referrer: fromHelp })).toBe("/play/?room=x");
  });

  it("never forwards from the app's own address, so it does not forward to itself", async () => {
    expect(await visit("/play/?room=x")).toBeNull();
    expect(await visit("/play/", { standalone: true })).toBeNull();
  });

  // Sees .get/.getAll/.has("name") with a double-quoted name in .ts/.tsx files that mention
  // URLSearchParams or searchParams. Not a name in a variable or constant, another quote style, or
  // iteration. Any such call in those files counts, so a header or Map .get("x") there would fail
  // it: none does today.
  it("knows every query parameter the app reads as a double-quoted literal", async () => {
    const { APP_PARAMS } = await load(join(repo, "site", "build.mjs"));
    expect(APP_PARAMS).toContain(SESSION_UID_OVERRIDE_PARAM);
    const read = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
          const text = readFileSync(full, "utf8");
          if (!/URLSearchParams|searchParams/.test(text)) continue;
          for (const m of text.matchAll(/\.(?:get|getAll|has)\(\s*"([^"]+)"\s*\)/g)) read.add(m[1]);
        }
      }
    };
    walk(join(client, "src"));
    // The scan finds what it is meant to find, including a literal read on a stored URLSearchParams
    // (config.ts: urlParams.get("ws")).
    for (const name of ["room", "mobile", "ws"]) expect(read.has(name)).toBe(true);
    for (const name of read) expect(APP_PARAMS).toContain(name);
  });
});

describe("the built website", () => {
  it("ships the forwarder on the landing page only, and a 404 page with no relative links", async () => {
    const htmlFiles = (dir: string, prefix = ""): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? htmlFiles(join(dir, e.name), `${prefix}${e.name}/`)
          : e.name.endsWith(".html")
            ? [`${prefix}${e.name}`]
            : [],
      );
    const { build, forwarderScript } = await load(join(repo, "site", "build.mjs"));
    scratch = mkdtempSync(join(tmpdir(), "hb-site-"));
    await build(scratch);
    const page = (rel: string) => readFileSync(join(scratch!, rel), "utf8");
    expect(page("index.html")).toContain(`<script>${forwarderScript}</script>`);
    const others = htmlFiles(scratch).filter((rel) => rel !== "index.html");
    expect(others).toContain("help/guide/player-guide.html"); // the walk reaches the guides
    for (const rel of others) expect(page(rel)).not.toContain("appForwardTarget");
    const relative = [...page("404.html").matchAll(/\s(?:src|href)="(?![a-z]+:|\/|#)([^"]+)"/g)];
    expect(relative.map((m) => m[1])).toEqual([]);
    expect(page("index.html")).toContain(
      '<meta property="og:image" content="https://herobyte.pages.dev/logo-wide.webp">',
    );
    expect(existsSync(join(scratch!, "site-assets", "site.css"))).toBe(true);
    expect(existsSync(join(scratch!, "assets"))).toBe(false);
  }, 30_000); // builds the whole site, guide images included
});

// The sources describe the app served at / (dev, e2e, a self-hosted dist/); the Cloudflare build
// moves both to /play/ (tested above).
describe("the installed app and its service worker", () => {
  it("declares / as the start page, keeps the app's id, and sets its scope to /", () => {
    const manifest = JSON.parse(MANIFEST);
    expect(manifest.start_url).toBe("/");
    expect(manifest.id).toBe("/");
    expect(manifest.scope).toBe("/");
  });

  it("pre-caches the app's page by its canonical URL only", () => {
    const list = cacheList(SW);
    expect(list).toContain("/");
    expect(list).not.toContain("/play/");
    expect(list).not.toContain("/index.html");
    // Not cached, so a manifest change reaches installed apps without a cache bump.
    expect(list).not.toContain("/manifest.json");
    // A new cache name makes activate delete v2; skipWaiting replaces v2 without waiting for tabs.
    expect(SW).toMatch(/const CACHE_NAME = "herobyte-cache-v3";/);
    expect(SW).toMatch(/self\.skipWaiting\(\)/);
    // cache.addAll fails the whole install on one missing file.
    for (const url of list.filter((u) => u !== "/")) {
      expect(existsSync(join(client, "public", url))).toBe(true);
    }
  });
});
