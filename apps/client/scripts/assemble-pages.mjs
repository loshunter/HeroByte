// Lays out the ONE Cloudflare Pages project: the website at /, the app at /play/.
//
// Runs after `vite build` (see package.json "build"). Only on Cloudflare (Pages sets CF_PAGES=1 in
// its build environment, production and preview builds alike) or with --force. In CI and Lighthouse
// `pnpm build` runs it and it only logs that it skipped; dev and e2e never run it. Either way the
// app stays at /.
//
// The app is built exactly as before (Vite base "/"), so its bundle stays at /assets/ and its
// public files at /tokens/, /tiles/, /sfx/, /manifest.json... The code refers to them by those root
// URLs, and saved tables and backups hold /tokens/ URLs, so they must not move. Only the app's page
// moves: dist/index.html -> dist/play/index.html. Every double-quoted src and href in it must be
// absolute or root-absolute (checked below; other forms are not checked), so it loads the same
// bundle from there.
// Then the website (site/build.mjs -> site/dist) is copied in around it. A top-level name the site
// and the app both have (other than index.html), or a site entry named "play", stops the build
// before anything moves.
// The app's sources describe the plain layout (the app at /), which is what dev, e2e and anyone
// serving dist/ themselves get. So only here do the installed app's start page (manifest.json) and
// the page the service worker pre-caches (sw.js) move from / to /play/.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..", "..");

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );

/** Cloudflare builds, or `--force` (the `build:pages` script). */
export function shouldAssemble(env, argv) {
  return env.CF_PAGES === "1" || argv.includes("--force");
}

/** The manifest with its start page moved to /play/. Its id and scope stay "/". */
export function manifestForPlay(text) {
  const manifest = JSON.parse(text);
  if (manifest.start_url !== "/") {
    throw new Error(`assemble-pages: manifest start_url is ${manifest.start_url}, expected "/"`);
  }
  return `${JSON.stringify({ ...manifest, start_url: "/play/" }, null, 2)}\n`;
}

/** The service worker with "/" in its pre-cache list replaced by "/play/". */
export function serviceWorkerForPlay(text) {
  const found = [...text.matchAll(/const urlsToCache = (\[[^\]]*\]);/g)];
  const list = found.length === 1 ? JSON.parse(found[0][1]) : [];
  if (!list.includes("/")) {
    throw new Error('assemble-pages: sw.js has no single urlsToCache list holding "/"');
  }
  const moved = JSON.stringify(list.map((u) => (u === "/" ? "/play/" : u))).replaceAll(",", ", ");
  return text.replace(found[0][0], `const urlsToCache = ${moved};`);
}

export async function assemblePages({ appDist, siteDist }) {
  const appPage = path.join(appDist, "index.html");
  if (!(await exists(appPage))) throw new Error(`assemble-pages: no app page at ${appPage}`);
  const html = await readFile(appPage, "utf8");
  // A relative src/href would resolve under /play/ after the move and miss the bundle.
  const relative = [...html.matchAll(/\s(?:src|href)="(?![a-z]+:|\/|#)([^"]+)"/gi)].map(
    (m) => m[1],
  );
  if (relative.length) {
    throw new Error(`assemble-pages: the app page has relative URLs: ${relative.join(", ")}`);
  }
  if (await exists(path.join(appDist, "play"))) {
    throw new Error("assemble-pages: dist/play already exists (run vite build first)");
  }

  const siteEntries = await readdir(siteDist);
  const clashes = [];
  for (const name of siteEntries) {
    // "play" is checked by name: the app's play/ is only created below, after this check.
    if (name === "play" || (name !== "index.html" && (await exists(path.join(appDist, name))))) {
      clashes.push(name);
    }
  }
  if (clashes.length) {
    throw new Error(`assemble-pages: the site and the app both have: ${clashes.join(", ")}`);
  }

  // Both are worked out before anything is written, so a source that has changed shape stops the
  // build with dist/ untouched.
  const manifestPath = path.join(appDist, "manifest.json");
  const swPath = path.join(appDist, "sw.js");
  const manifest = manifestForPlay(await readFile(manifestPath, "utf8"));
  const sw = serviceWorkerForPlay(await readFile(swPath, "utf8"));

  await writeFile(manifestPath, manifest);
  await writeFile(swPath, sw);
  await mkdir(path.join(appDist, "play"));
  await rename(appPage, path.join(appDist, "play", "index.html"));
  for (const name of siteEntries) {
    await cp(path.join(siteDist, name), path.join(appDist, name), { recursive: true });
  }
}

// realpath both sides: Node resolves symlinks in import.meta.url but not in argv[1], and a silent
// mismatch here would deploy the app at / with no website and no log line.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  if (!shouldAssemble(process.env, process.argv)) {
    console.log("assemble-pages: not a Cloudflare Pages build, the app stays at /");
  } else {
    execFileSync(process.execPath, [path.join(repo, "site", "build.mjs")], { stdio: "inherit" });
    await assemblePages({
      appDist: path.join(here, "..", "dist"),
      siteDist: path.join(repo, "site", "dist"),
    });
    console.log("assemble-pages: website at /, app at /play/");
  }
}
