// Puts the rendered lessons on the website: `node tools/site-lessons.mjs` (from site/video/, after
// rendering; needs ffmpeg on PATH).
//
// - Copies each lesson's phone-size render (out/<file>-small.mp4) to site/media/<file>.mp4, remuxed
//   with +faststart so the browser can start playing before the whole file has arrived, and the
//   trailer the same way.
// - Grabs a poster frame from each one (site/media/<file>.jpg).
// - Writes site/lessons.json: each lesson's chapter start times (worked out exactly as Lesson.tsx
//   lays the edit out, so a chapter button lands on the chapter's wipe) and its transcript (the
//   Say: blocks of docs/website/video-scripts.md, the words Wren reads).
//
// site/build.mjs turns lessons.json into the lesson pages. Re-run this after re-rendering a lesson.
// Cloudflare Pages refuses a file over 25 MiB, so a video that big stops this script.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const video = path.resolve(here, "..");
const repo = path.resolve(video, "..", "..");
const media = path.join(repo, "site", "media");
const MAX_BYTES = 25 * 1024 * 1024;

// Composition id -> the file name the render and the site use.
const FILES = {
  PlayerQuickStart: "player-quick-start",
  DmQuickStart: "dm-quick-start",
  PlayerPath1: "player-path-1",
  PlayerPath2: "player-path-2",
  PlayerPath3: "player-path-3",
  PlayerPath4: "player-path-4",
  PlayerPath5: "player-path-5",
  PlayerPath6: "player-path-6",
  DmPath1: "dm-path-1",
  DmPath2: "dm-path-2",
  DmPath3: "dm-path-3",
  DmPath4: "dm-path-4",
  DmPath5: "dm-path-5",
  DmPath6: "dm-path-6",
  DmPath7: "dm-path-7",
  DmPath8: "dm-path-8",
};

// Chapter starts, computed by the edit's own code (TypeScript, so bundle it first).
async function chapterPlans() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "site-lessons-"));
  const entry = `
import { readFileSync } from "node:fs";
import { LESSONS } from "./src/lessons";
import { chapterSeconds } from "./src/engine";
// The same numbers as src/Lesson.tsx plan().
const FPS = 30, INTRO = 4.2, OUTRO = 7;
export function plans(pub) {
  const out = {};
  for (const [id, script] of Object.entries(LESSONS)) {
    const recordings = JSON.parse(readFileSync(pub + "/footage/" + script.slug + "/recordings.json", "utf8"));
    const timing = JSON.parse(readFileSync(pub + "/audio/" + script.slug + "/timing.json", "utf8"));
    const data = { recordings, chapters: timing.chapters };
    let at = Math.round(INTRO * FPS);
    const chapters = script.chapters.map((ch, i) => {
      const from = at;
      at += Math.round(chapterSeconds(data, i + 1, ch) * FPS);
      return { title: ch.title, start: i === 0 ? 0 : Math.round((from / FPS) * 10) / 10 };
    });
    out[id] = { chapters, duration: Math.round(((at + OUTRO * FPS) / FPS) * 10) / 10 };
  }
  return out;
}`;
  const outfile = path.join(tmp, "plans.mjs");
  await build({
    stdin: { contents: entry, resolveDir: video, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    logLevel: "error",
    outfile,
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  try {
    const { plans } = await import(pathToFileURL(outfile).href);
    return plans(path.join(video, "public"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// "## Player path 3: Your character card" sections: the summary line and each chapter's Say: block.
function readScripts() {
  const md = readFileSync(path.join(repo, "docs", "website", "video-scripts.md"), "utf8").replace(/\r\n/g, "\n");
  const scripts = {};
  for (const sec of md.split(/\n(?=## )/)) {
    const head = sec.match(/^## (Player|DM) (quick start|path (\d)): (.+)/);
    if (!head) continue;
    const id = (head[1] === "DM" ? "Dm" : "Player") + (head[3] ? `Path${head[3]}` : "QuickStart");
    const end = sec.match(/^- \*\*By the end:\*\* the viewer (.+)$/m)?.[1] ?? "";
    const chapters = sec
      .split(/\n(?=### \d+\. )/)
      .slice(1)
      .map((ch) => {
        const title = ch.match(/^### \d+\. (.+?)(?: \(\d+:\d\d\)(?:,.*)?)?$/m)[1];
        const say = ch.match(/\*\*Say:\*\*\n((?:>.*\n?)+)/);
        const lines = say ? say[1].split("\n").map((l) => l.replace(/^>\s?/, "").trim()).filter(Boolean) : [];
        return { title, say: lines };
      });
    scripts[id] = { title: head[4].trim(), heading: `${head[1]} ${head[2]}`, end, chapters };
  }
  return scripts;
}

// "the viewer can join a table, find their character" -> "you can join a table, find your character".
// Only the viewer's own things: "what they see" (the players) and "their stance" (the NPCs') stay.
const secondPerson = (s) =>
  s
    ? `By the end, you ${s
        .replace(/\bknows\b/g, "know")
        .replace(/\bunderstands\b/g, "understand")
        .replace(/\btheir (?=character|token|way|card)/g, "your ")
        .replace(/\bthey want\b/g, "you want")}`
    : "";

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
}

function publish(file, posterAt) {
  const src = path.join(video, "out", `${file}-small.mp4`);
  const dest = path.join(media, `${file}.mp4`);
  ffmpeg(["-i", src, "-c", "copy", "-movflags", "+faststart", dest]);
  const bytes = statSync(dest).size;
  if (bytes > MAX_BYTES) throw new Error(`${dest} is ${(bytes / 2 ** 20).toFixed(1)} MiB; Cloudflare Pages takes 25 MiB at most`);
  ffmpeg(["-ss", String(posterAt), "-i", src, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", path.join(media, `${file}.jpg`)]);
  return bytes;
}

const plans = await chapterPlans();
const scripts = readScripts();
const lessons = [];
for (const [id, file] of Object.entries(FILES)) {
  const plan = plans[id];
  const script = scripts[id];
  if (!plan || !script) throw new Error(`${id}: no ${plan ? "script section" : "edit"}`);
  if (plan.chapters.length !== script.chapters.length) {
    throw new Error(`${id}: the edit has ${plan.chapters.length} chapters, video-scripts.md ${script.chapters.length}`);
  }
  // The poster: the intro card (title, subtitle) is fully drawn by 2.5 s.
  const bytes = publish(file, 2.5);
  lessons.push({
    id: file,
    aud: id.startsWith("Dm") ? "dm" : "player",
    heading: script.heading,
    title: script.title,
    lead: secondPerson(script.end),
    duration: plan.duration,
    bytes,
    chapters: plan.chapters.map((c, i) => ({ title: script.chapters[i].title, start: c.start, say: script.chapters[i].say })),
  });
}
// The trailer has no chapters; its poster is the whole showcase map, built.
publish("trailer", 56);

writeFileSync(path.join(repo, "site", "lessons.json"), `${JSON.stringify({ lessons }, null, 1)}\n`);
console.log(`site/lessons.json: ${lessons.length} lessons; videos and posters in site/media/`);
