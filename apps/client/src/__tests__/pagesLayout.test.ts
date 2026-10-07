/**
 * The Cloudflare Pages layout: the website at /, the app at /play/ (scripts/assemble-pages.mjs).
 * The app's bundle and public files keep their root URLs, because saved tables and backups hold
 * them (/tokens/...). Old links to /?room=... are forwarded to /play/ by the landing page.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { SESSION_UID_OVERRIDE_PARAM } from "../utils/session";

const client = resolve(__dirname, "..", "..");
const repo = resolve(client, "..", "..");

// Plain .mjs build scripts: imported by URL so the typecheck does not need declarations for them.
const load = (file: string) => import(/* @vite-ignore */ pathToFileURL(file).href);

const APP_PAGE =
  '<!doctype html><link rel="manifest" href="/manifest.json"><script type="module" src="/assets/index-abc.js"></script>';

let scratch: string;
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
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

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

  it("refuses an app page with a relative URL, which would miss the bundle from /play/", async () => {
    const { assemblePages } = await load(join(client, "scripts", "assemble-pages.mjs"));
    const dirs = layout(
      { "index.html": '<script type="module" src="assets/index-abc.js"></script>' },
      { "index.html": "landing" },
    );
    await expect(assemblePages(dirs)).rejects.toThrow(/relative URLs: assets\/index-abc.js/);
  });
});

describe("the landing page's forwarder", () => {
  it("sends a link carrying any app parameter to /play/ with its query and hash", async () => {
    const { appForwardTarget, APP_PARAMS, SITE } = await load(join(repo, "site", "build.mjs"));
    expect(SITE.appUrl).toBe("/play/");
    expect(APP_PARAMS).toContain(SESSION_UID_OVERRIDE_PARAM);
    for (const name of ["room", "sessionUid", "mobile", "ws"]) {
      expect(appForwardTarget(`?${name}=x`, "", "/play/", APP_PARAMS)).toBe(`/play/?${name}=x`);
    }
    expect(appForwardTarget("?utm_source=a&room=fun", "#t", "/play/", APP_PARAMS)).toBe(
      "/play/?utm_source=a&room=fun#t",
    );
  });

  it("leaves a bare visit or a shared post's tracking query on the landing page", async () => {
    const { appForwardTarget, APP_PARAMS } = await load(join(repo, "site", "build.mjs"));
    expect(appForwardTarget("", "", "/play/", APP_PARAMS)).toBeNull();
    expect(appForwardTarget("?fbclid=abc", "", "/play/", APP_PARAMS)).toBeNull();
  });
});

describe("the installed app and its service worker", () => {
  it("opens /play/ and stays the same installed app", () => {
    const manifest = JSON.parse(readFileSync(join(client, "public", "manifest.json"), "utf8"));
    expect(manifest.start_url).toBe("/play/");
    expect(manifest.id).toBe("/");
  });

  it("pre-caches the app's page, not the landing page that now lives at /", () => {
    const sw = readFileSync(join(client, "public", "sw.js"), "utf8");
    const list = JSON.parse(sw.match(/urlsToCache = (\[[^\]]*\])/)![1]) as string[];
    expect(list).toContain("/play/");
    expect(list).not.toContain("/");
    expect(list).not.toContain("/index.html");
  });
});
