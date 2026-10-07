// Lays out the ONE Cloudflare Pages project: the website at /, the app at /play/.
//
// Runs after `vite build` (see package.json "build"). Only on Cloudflare (CF_PAGES=1, which Pages
// sets in every build) or with --force; everywhere else (dev, CI, e2e) the app stays at / and this
// does nothing.
//
// The app is built exactly as before (Vite base "/"), so its bundle stays at /assets/ and its
// public files at /tokens/, /tiles/, /sfx/, /manifest.json... Saved tables and backups hold those
// root URLs, so they must not move. Only the app's page moves: dist/index.html -> dist/play/index.html.
// Every URL in it is root-absolute, so it loads the same bundle from there. Then the website
// (site/build.mjs -> site/dist) is copied in around it. A file the site and the app both have
// stops the build: nothing is overwritten silently.
import { execFileSync } from "node:child_process";
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
    if (name !== "index.html" && (await exists(path.join(appDist, name)))) clashes.push(name);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.CF_PAGES !== "1" && !process.argv.includes("--force")) {
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
