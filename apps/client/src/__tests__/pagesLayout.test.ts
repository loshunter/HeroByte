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
      { "index.html": APP_PAGE, "assets/index-abc.js": "app", "tokens/goblin.png": "art" },
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

  it("refuses a file the site and the app both have, before moving anything", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { "index.html": APP_PAGE, "assets/index-abc.js": "app" },
      { "index.html": "landing", "assets/site.css": "css" },
    );
    await expect(assemblePages(dirs)).rejects.toThrow(/both have: assets/);
    expect(readFileSync(join(dirs.appDist, "index.html"), "utf8")).toBe(APP_PAGE);
    expect(existsSync(join(dirs.appDist, "play"))).toBe(false);
  });

  it("refuses a site entry named play, which would land inside the app's page folder", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { "index.html": APP_PAGE },
      { "index.html": "landing", "play/x.html": "x" },
    );
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
  async function visit(href: string, standalone = false) {
    const { forwarderScript } = await load(join(repo, "site", "build.mjs"));
    const url = new URL(href, "https://herobyte.pages.dev");
    let target: string | null = null;
    const style: { visibility?: string } = {};
    runInNewContext(forwarderScript, {
      URLSearchParams,
      navigator: {},
      window: { matchMedia: true },
      matchMedia: (q: string) => ({ matches: standalone && q === "(display-mode: standalone)" }),
      document: { documentElement: { style } },
      location: {
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

  it("always sends an installed app to /play/, whatever address it opened", async () => {
    expect(await visit("/", true)).toBe("/play/");
  });

  it("never forwards from the app's own address, so it cannot loop", async () => {
    expect(await visit("/play/?room=x")).toBeNull();
    expect(await visit("/play/", true)).toBeNull();
  });

  it("knows every query parameter the app reads by name", async () => {
    const { APP_PARAMS } = await load(join(repo, "site", "build.mjs"));
    expect(APP_PARAMS).toContain(SESSION_UID_OVERRIDE_PARAM);
    const read = new Set<string>();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
          for (const line of readFileSync(full, "utf8").split("\n")) {
            if (!/URLSearchParams|searchParams/.test(line)) continue;
            for (const m of line.matchAll(/\.(?:get|has)\("([^"]+)"\)/g)) read.add(m[1]);
          }
        }
      }
    };
    walk(join(client, "src"));
    expect(read.has("room")).toBe(true); // the scan finds what it is meant to find
    for (const name of read) expect(APP_PARAMS).toContain(name);
  });
});

describe("the installed app and its service worker", () => {
  it("declares /play/ as the start page, keeps the app's id, and keeps its scope at /", () => {
    const manifest = JSON.parse(readFileSync(join(client, "public", "manifest.json"), "utf8"));
    expect(manifest.start_url).toBe("/play/");
    expect(manifest.id).toBe("/");
    // Without it the scope would shrink to /play/, and old /?room= links would leave the app.
    expect(manifest.scope).toBe("/");
  });

  it("pre-caches the app's page, not the landing page that now lives at /", () => {
    const sw = readFileSync(join(client, "public", "sw.js"), "utf8");
    const list = JSON.parse(sw.match(/urlsToCache = (\[[^\]]*\])/)![1]) as string[];
    expect(list).toContain("/play/");
    expect(list).not.toContain("/");
    expect(list).not.toContain("/index.html");
    // Not cached, so a manifest change reaches installed apps without a cache bump.
    expect(list).not.toContain("/manifest.json");
    // cache.addAll fails the whole install on one missing file.
    for (const url of list.filter((u) => u !== "/play/")) {
      expect(existsSync(join(client, "public", url))).toBe(true);
    }
  });
});
