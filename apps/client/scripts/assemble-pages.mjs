// Lays out the ONE Cloudflare Pages project: the website at /, the app at /play/.
//
// Runs after `vite build` (see package.json "build"). Only on Cloudflare (Pages sets CF_PAGES=1 in
// its build environment, production and preview builds alike) or with --force. In CI and Lighthouse
// `pnpm build` runs it and it only logs that it skipped; dev and e2e never run it. Either way the
// app stays at /.
//
// The app is built exactly as before (Vite base "/"), so its bundle stays at /assets/ and its
// public files at /tokens/, /tiles/, /sfx/, /manifest.json... Saved tables and backups hold those
// root URLs, so they must not move. Only the app's page moves: dist/index.html -> dist/play/index.html.
// Every src and href in it is root-absolute (checked below), so it loads the same bundle from there.
// Then the website (site/build.mjs -> site/dist) is copied in around it. A top-level name the site
// and the app both have (other than index.html), or a site entry named "play", stops the build
// before anything moves.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, stat } from "node:fs/promises";
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

export async function assemblePages({ appDist, siteDist }) {
  const appPage = path.join(appDist, "index.html");
  if (!(await exists(appPage))) throw new Error(`assemble-pages: no app page at ${appPage}`);
  const html = await readFile(appPage, "utf8");
  // A relative src/href would resolve under /play/ after the move and miss the bundle.
  const relative = [...html.matchAll(/\s(?:src|href)="(?![a-z]+:|\/|#)([^"]+)"/gi)].map((m) => m[1]);
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

  await mkdir(path.join(appDist, "play"));
  await rename(appPage, path.join(appDist, "play", "index.html"));
  for (const name of siteEntries) {
    await cp(path.join(siteDist, name), path.join(appDist, name), { recursive: true });
  }
}

// realpath both sides: Node resolves symlinks in import.meta.url but not in argv[1], and a silent
// mismatch here would deploy the app at / with no website and no log line.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
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
