// Turn captured screencast frames into constant-frame-rate MP4s for the edit, and copy the
// lesson's narration next to them.
//
//   node site/video/tools/frames-to-mp4.mjs <lesson-slug>
//
// footage/<slug>/ch<N>/<who>/{frames/*.jpg,recording.json} -> public/footage/<slug>/ch<N>-<who>.mp4
// plus public/footage/<slug>/recordings.json (marks, durations) for the composition.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repo = path.resolve(root, "..", "..");
const slug = process.argv[2];
if (!slug) throw new Error("usage: frames-to-mp4.mjs <lesson-slug>");

const src = path.join(root, "footage", slug);
const dest = path.join(root, "public", "footage", slug);
const audioDest = path.join(root, "public", "audio", slug);
fs.mkdirSync(dest, { recursive: true });
fs.mkdirSync(audioDest, { recursive: true });

/**
 * Retiming: every mark with `at` says where in the narration it belongs. Between two such
 * anchors the footage is squeezed (played faster) when it ran long, and held on its first frame
 * when it ran short, so the action at the next anchor lands exactly on its word. After the last
 * anchor it plays at normal speed. One mapping per chapter, shared by all its recordings.
 */
function retimer(marks) {
  const anchors = [{ t: 0, at: 0 }];
  for (const m of [...marks].filter((m) => m.at !== undefined && m.at !== null).sort((a, b) => a.t - b.t)) {
    const last = anchors.at(-1);
    if (m.t > last.t + 0.02 && m.at > last.at + 0.05) anchors.push({ t: m.t, at: m.at });
  }
  const segments = anchors.slice(1).map((b, i) => {
    const a = anchors[i];
    return { t0: a.t, t1: b.t, at0: a.at, at1: b.at, speed: (b.t - a.t) / (b.at - a.at) };
  });
  const map = (t) => {
    for (const s of segments) {
      if (t > s.t1) continue;
      const F = s.t1 - s.t0;
      const N = s.at1 - s.at0;
      return F >= N ? s.at0 + ((t - s.t0) * N) / F : s.at0 + (N - F) + (t - s.t0);
    }
    const last = anchors.at(-1);
    return last.at + (t - last.t);
  };
  return { map, segments };
}

const index = {};
for (const ch of fs.readdirSync(src).filter((d) => /^ch\d+$/.test(d)).sort()) {
  const whos = fs.readdirSync(path.join(src, ch));
  const recs = Object.fromEntries(
    whos.map((who) => [who, JSON.parse(fs.readFileSync(path.join(src, ch, who, "recording.json"), "utf8"))]),
  );
  const { map, segments } = retimer(Object.values(recs).flatMap((r) => r.marks));
  for (const who of whos) {
    const dir = path.join(src, ch, who);
    const rec = recs[who];
    const frames = rec.frames.filter((f) => fs.existsSync(path.join(dir, "frames", f.file)));
    const end = map(rec.end);
    // concat list: each frame lasts until the next one (in retimed time); the first starts at 0,
    // the last holds to the end
    const lines = [];
    frames.forEach((f, i) => {
      const start = i === 0 ? 0 : map(f.t);
      const stop = i + 1 < frames.length ? map(frames[i + 1].t) : end;
      if (stop - start < 0.0005 && i + 1 < frames.length) return; // squeezed out entirely
      lines.push(`file '${path.join(dir, "frames", f.file).replace(/\\/g, "/")}'`);
      lines.push(`duration ${Math.max(0.0005, stop - start).toFixed(5)}`);
    });
    lines.push(`file '${path.join(dir, "frames", frames.at(-1).file).replace(/\\/g, "/")}'`);
    const list = path.join(dir, "concat.txt");
    fs.writeFileSync(list, lines.join("\n"));
    const out = path.join(dest, `${ch}-${who}.mp4`);
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", out],
      { stdio: "inherit" },
    );
    index[`${ch}-${who}`] = {
      src: `footage/${slug}/${ch}-${who}.mp4`,
      end,
      view: rec.view,
      dsf: rec.dsf,
      marks: rec.marks.map((m) => ({ ...m, nt: +map(m.t).toFixed(3) })),
      fastForward: segments.filter((s) => s.speed > 2.2).map((s) => ({ from: s.at0, to: s.at1, speed: +s.speed.toFixed(1) })),
    };
    console.log(`${ch}-${who}: ${frames.length} frames, ${rec.end.toFixed(1)} s recorded -> ${end.toFixed(1)} s`);
  }
}
fs.writeFileSync(path.join(dest, "recordings.json"), JSON.stringify(index, null, 1));

const audioSrc = path.join(repo, "site", "narration", "out", "lessons", slug);
for (const f of fs.readdirSync(audioSrc).filter((f) => f.endsWith(".mp3"))) {
  fs.copyFileSync(path.join(audioSrc, f), path.join(audioDest, f));
}
fs.copyFileSync(
  path.join(root, "narration-timing", `${slug}.json`),
  path.join(audioDest, "timing.json"),
);
console.log(`wrote ${dest}`);

// The app's own sound effects and logo, for the edit (git-ignored copies).
const appPublic = path.join(repo, "apps", "client", "public");
fs.mkdirSync(path.join(root, "public", "sfx"), { recursive: true });
fs.mkdirSync(path.join(root, "public", "brand"), { recursive: true });
for (const f of fs.readdirSync(path.join(appPublic, "sfx")).filter((f) => f.endsWith(".wav"))) {
  fs.copyFileSync(path.join(appPublic, "sfx", f), path.join(root, "public", "sfx", f));
}
fs.copyFileSync(path.join(appPublic, "logo-wide.webp"), path.join(root, "public", "brand", "logo-wide.webp"));
