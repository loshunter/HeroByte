// HeroByte narration with ElevenLabs (Eleven v4). No dependencies: `node site/narration/narrate.mjs <command>`.
//
// The API key is read from ELEVENLABS_API_KEY, or from site/narration/.env.local (git-ignored) as
//   ELEVENLABS_API_KEY=your-key
// It is sent only in the xi-api-key header to api.elevenlabs.io and never printed.
//
// Commands
//   voices <search words>          Find a voice: your own voices, then the public Voice Library.
//   add <public_user_id> <voice_id> <name>
//                                  Add a Voice Library voice to your voices (some must be added before use).
//   audition --voice <id>[:stability] [--voice ...] [--takes N] [--only tagged,plain,...] [--model eleven_v4|eleven_v3]
//            [--dry-run]
//                                  Generate every passage of docs/website/narration-audition.md for each voice.
//                                  Stability defaults to 0.5. --dry-run prints what would be sent and its size
//                                  without calling the API (no credits used).
//   credits                        Show the characters used and left this billing period.
//
// Audio lands in site/narration/out/<voice>/<passage>-take<n>.mp3 (git-ignored), with a manifest.json that
// records the exact text, settings, character cost and request id of every file.
//
// PLAN CREDITS ONLY (the owner's rule): audition never spends past the subscription's included credits,
// even on an account that allows overage. It refuses a run that does not fit what is left, and re-checks the
// plan before every file at the model's published rate (or the rate actually charged, if higher).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const API = "https://api.elevenlabs.io";
let MODEL = "eleven_v4";
const OUTPUT_FORMAT = "mp3_44100_128";

const PASSAGES = {
  tagged: "## 1. The tagged passage",
  plain: "## 2. The plain passage",
  pronunciation: "## 3. Pronunciation check",
  character: "## 4. In character",
  stealth: "## 5. Whisper, performance and sarcasm",
};

async function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  try {
    const env = await readFile(path.join(here, ".env.local"), "utf8");
    const line = env.split(/\r?\n/).find((l) => l.startsWith("ELEVENLABS_API_KEY="));
    if (line) return line.slice("ELEVENLABS_API_KEY=".length).trim();
  } catch {
    // no file
  }
  throw new Error(
    "No API key. Put ELEVENLABS_API_KEY=... in site/narration/.env.local, or set the environment variable.",
  );
}

async function call(method, route, { body, query } = {}) {
  const url = new URL(route, API);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { "xi-api-key": await apiKey(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url.pathname} → ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

/** The fenced ```text block under each audition heading, verbatim. */
async function passages() {
  const md = await readFile(path.join(repo, "docs", "website", "narration-audition.md"), "utf8");
  const out = {};
  for (const [key, heading] of Object.entries(PASSAGES)) {
    const at = md.indexOf(heading);
    if (at < 0) throw new Error(`Heading not found in narration-audition.md: ${heading}`);
    const block = md.slice(at).match(/```text\n([\s\S]*?)\n```/);
    if (!block) throw new Error(`No text block under: ${heading}`);
    out[key] = block[1].trim();
  }
  return out;
}

function parseArgs(argv) {
  const args = { voices: [], takes: 1, only: null, dryRun: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--voice") {
      const [id, stab] = argv[++i].split(":");
      args.voices.push({ id, stability: stab === undefined ? 0.5 : Number(stab) });
    } else if (a === "--takes") args.takes = Number(argv[++i]);
    else if (a === "--only") args.only = argv[++i].split(",");
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--model") MODEL = argv[++i];
    else if (a === "--video") args.videoFilter = argv[++i];
    else args.rest.push(a);
  }
  return args;
}

async function voices(words) {
  const search = words.join(" ");
  const mine = await (await call("GET", "/v2/voices", { query: { search, page_size: 20 } })).json();
  console.log(`Your voices matching "${search}":`);
  for (const v of mine.voices ?? []) {
    console.log(`  ${v.voice_id}  ${v.name}  [${v.category}]  ${(v.description ?? "").slice(0, 100)}`);
  }
  const shared = await (await call("GET", "/v1/shared-voices", { query: { search, page_size: 20 } })).json();
  console.log(`Voice Library matching "${search}":`);
  for (const v of shared.voices ?? []) {
    console.log(
      `  ${v.voice_id}  ${v.name}  [${v.category}, ${v.accent ?? "?"}, ${v.gender ?? "?"}]  owner ${v.public_owner_id}`,
    );
    if (v.description) console.log(`      ${v.description.replace(/\s+/g, " ").slice(0, 160)}`);
  }
}

async function add([publicUserId, voiceId, ...name]) {
  const res = await call("POST", `/v1/voices/add/${publicUserId}/${voiceId}`, {
    body: { new_name: name.join(" ") || voiceId },
  });
  console.log("Added:", JSON.stringify(await res.json()));
}

/** What the plan includes and has left. Overage is never used: the owner's rule is plan credits only. */
async function plan() {
  const s = await (await call("GET", "/v1/user/subscription")).json();
  return {
    tier: s.tier,
    used: s.character_count,
    limit: s.character_limit,
    left: Math.max(0, s.character_limit - s.character_count),
    resets: s.next_character_count_reset_unix
      ? new Date(s.next_character_count_reset_unix * 1000).toISOString().slice(0, 10)
      : "unknown",
    overageAllowed: Boolean(s.can_extend_character_limit),
  };
}

/** Credits per character for the model, from /v1/models (3 if it is not published: assume the worst). */
async function modelRate() {
  try {
    const models = await (await call("GET", "/v1/models")).json();
    const m = models.find((x) => x.model_id === MODEL);
    const rate = m?.model_rates?.character_cost_multiplier;
    return typeof rate === "number" && rate > 0 ? rate : 3;
  } catch {
    return 3;
  }
}

async function credits() {
  const p = await plan();
  console.log(
    `Tier ${p.tier}: ${p.used} of ${p.limit} included credits used, ${p.left} left; resets ${p.resets}.` +
      (p.overageAllowed ? " (This account can bill overage; this script never goes past the included credits.)" : ""),
  );
}

async function audition(args) {
  if (!args.voices.length) throw new Error("Give at least one --voice <id>[:stability].");
  const all = await passages();
  const chosen = Object.entries(all).filter(([k]) => !args.only || args.only.includes(k));
  const chars = chosen.reduce((n, [, t]) => n + t.length, 0) * args.voices.length * args.takes;
  console.log(
    `${chosen.length} passages × ${args.voices.length} voices × ${args.takes} takes = ${chars} characters ` +
      `(the API's character-cost header gives the exact figure per file).`,
  );
  if (args.dryRun) {
    for (const [k, t] of chosen) console.log(`\n--- ${k} (${t.length} chars) ---\n${t}`);
    return;
  }
  // Plan credits only, never overage: refuse up front if the run does not fit what is left, and check
  // again before every file, sizing each estimate by the model's published rate, raised to the cost per
  // character actually charged so far. An unknown rate is assumed to be 3 credits a character.
  let perChar = await modelRate();
  const start = await plan();
  const needed = Math.ceil(chars * perChar);
  console.log(
    `Plan: ${start.left} included credits left (resets ${start.resets}). ` +
      `This run: about ${needed} credits at ${perChar} per character.`,
  );
  if (needed > start.left) {
    throw new Error(
      `Refused: this run needs about ${needed} credits and the plan has ${start.left} left. ` +
        `Use fewer takes, fewer voices or --only, or wait for the reset on ${start.resets}.`,
    );
  }
  // Appended to across runs, so a second model or voice keeps the first run's record.
  const manifestPath = path.join(here, "out", "manifest.json");
  const manifest = await readFile(manifestPath, "utf8").then(JSON.parse, () => []);
  const before = manifest.length;
  let spent = 0;
  for (const voice of args.voices) {
    const dir = path.join(here, "out", voice.id);
    await mkdir(dir, { recursive: true });
    for (const [key, text] of chosen) {
      for (let take = 1; take <= args.takes; take++) {
        const estimate = Math.ceil(text.length * perChar);
        const now = await plan();
        if (estimate > now.left) {
          console.log(
            `Stopped before ${key} take ${take}: it needs about ${estimate} credits and the plan has ${now.left} left.`,
          );
          await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
          console.log(`Done early: ${manifest.length - before} files, ${spent} credits charged.`);
          return;
        }
        const res = await call("POST", `/v1/text-to-speech/${voice.id}`, {
          query: { output_format: OUTPUT_FORMAT },
          body: {
            text,
            model_id: MODEL,
            voice_settings: { stability: voice.stability, similarity_boost: 0.75 },
          },
        });
        const file = path.join(dir, `${key}-${MODEL}-s${voice.stability}-take${take}.mp3`);
        await writeFile(file, Buffer.from(await res.arrayBuffer()));
        const cost = Number(res.headers.get("character-cost") ?? text.length);
        spent += cost;
        perChar = Math.max(perChar, cost / text.length);
        manifest.push({
          file: path.relative(here, file),
          voice: voice.id,
          stability: voice.stability,
          passage: key,
          take,
          model: MODEL,
          characterCost: cost,
          requestId: res.headers.get("request-id"),
          text,
        });
        console.log(`  ${path.relative(here, file)}  (${cost} credits)`);
      }
    }
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Done: ${manifest.length - before} files, ${spent} credits charged.`);
}

/** Voice Design: three previews per variant of a voice spec (site/narration/voices/<name>.json). */
async function design([specPath, ...rest]) {
  const spec = JSON.parse(await readFile(path.resolve(specPath), "utf8"));
  const only = rest.includes("--only") ? rest[rest.indexOf("--only") + 1].split(",") : null;
  const variants = spec.variants.filter((v) => !only || only.includes(v.key));
  const dir = path.join(here, "out", "design", spec.name.toLowerCase());
  await mkdir(dir, { recursive: true });
  const record = [];
  for (const variant of variants) {
    // Charged for the preview text once per call (three previews). Rate unpublished here: assume 3.
    const estimate = spec.text.length * 3;
    const now = await plan();
    if (estimate > now.left) {
      console.log(`Stopped before ${variant.key}: up to ${estimate} credits needed, ${now.left} left.`);
      break;
    }
    const res = await call("POST", "/v1/text-to-voice/design", {
      query: { output_format: OUTPUT_FORMAT },
      body: { voice_description: variant.voice_description, text: spec.text, model_id: spec.model_id },
    });
    const body = await res.json();
    for (const [i, p] of body.previews.entries()) {
      const file = path.join(dir, `${variant.key}-${i + 1}.mp3`);
      await writeFile(file, Buffer.from(p.audio_base_64, "base64"));
      record.push({
        variant: variant.key,
        preview: i + 1,
        file: path.relative(here, file),
        generated_voice_id: p.generated_voice_id,
        duration: p.duration_secs,
      });
    }
    console.log(`  ${variant.key}: ${body.previews.length} previews (${res.headers.get("character-cost") ?? "?"} credits)`);
  }
  await writeFile(path.join(dir, "previews.json"), JSON.stringify(record, null, 2));
  for (const r of record) console.log(`  ${r.file}  ${r.generated_voice_id}`);
}

/** Save one designed preview as a voice in the account (takes a voice slot). */
async function save([generatedVoiceId, specPath, variantKey]) {
  const spec = JSON.parse(await readFile(path.resolve(specPath), "utf8"));
  const variant = spec.variants.find((v) => v.key === variantKey);
  if (!variant) throw new Error(`No variant "${variantKey}" in ${specPath}`);
  const res = await call("POST", "/v1/text-to-voice", {
    body: { voice_name: spec.name, voice_description: variant.voice_description, generated_voice_id: generatedVoiceId },
  });
  const v = await res.json();
  console.log(`Saved "${v.name}" as voice ${v.voice_id}.`);
}

/** Voice one text file: speak <text-file> <voice_id> <out.mp3> [--model m] [--stability s]. Plan credits only. */
async function speak(args) {
  const [textFile, voiceId, outFile] = args.rest;
  const stability = args.voices[0]?.stability ?? 0.5;
  const text = (await readFile(path.resolve(textFile), "utf8")).trim();
  const estimate = Math.ceil(text.length * (await modelRate()));
  const now = await plan();
  console.log(`${text.length} characters on ${MODEL}: about ${estimate} credits; plan has ${now.left} left.`);
  if (estimate > now.left) throw new Error("Refused: not enough included credits left.");
  const res = await call("POST", `/v1/text-to-speech/${voiceId}`, {
    query: { output_format: OUTPUT_FORMAT },
    body: { text, model_id: MODEL, voice_settings: { stability, similarity_boost: 0.75 } },
  });
  await mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
  await writeFile(path.resolve(outFile), Buffer.from(await res.arrayBuffer()));
  console.log(`Wrote ${outFile} (${res.headers.get("character-cost") ?? "?"} credits).`);
}

/** Instant Voice Clone: clone <name> <description> <audio files...>. Takes a voice slot; no credits. */
async function clone([name, description, ...files]) {
  const form = new FormData();
  form.set("name", name);
  form.set("description", description);
  form.set("remove_background_noise", "false");
  for (const f of files) {
    form.append("files", new Blob([await readFile(path.resolve(f))], { type: "audio/mpeg" }), path.basename(f));
  }
  const res = await fetch(new URL("/v1/voices/add", API), {
    method: "POST",
    headers: { "xi-api-key": await apiKey() },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`POST /v1/voices/add → ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  console.log(`Cloned "${name}" as voice ${body.voice_id}${body.requires_verification ? " (needs verification)" : ""}.`);
}

/**
 * Lesson narration from docs/website/narration-wren.md: every "### chapter" heading under a "## video" heading has
 * one ```text block. lesson --voice <id>[:stability] [--video <words>] [--takes N] [--dry-run]. Plan credits only.
 */
async function lesson(args) {
  const md = await readFile(path.join(repo, "docs", "website", "narration-wren.md"), "utf8");
  const chapters = [];
  let video = null;
  for (const part of md.split(/\n(?=##+ )/)) {
    const h2 = part.match(/^## (.+)/);
    if (h2) video = h2[1].trim();
    const h3 = part.match(/^### (.+)/);
    const block = part.match(/```text\n([\s\S]*?)\n```/);
    if (h3 && block && video) chapters.push({ video, chapter: h3[1].trim(), text: block[1].trim() });
  }
  const filter = args.videoFilter?.toLowerCase();
  const chosen = chapters.filter((c) => !filter || c.video.toLowerCase().includes(filter));
  if (!chosen.length) throw new Error(`No chapters${filter ? ` for "${filter}"` : ""} in narration-wren.md.`);
  const voice = args.voices[0];
  if (!voice) throw new Error("Give --voice <id>[:stability].");
  const chars = chosen.reduce((n, c) => n + c.text.length, 0) * args.takes;
  const rate = await modelRate();
  console.log(`${chosen.length} chapters × ${args.takes} takes = ${chars} characters (about ${Math.ceil(chars * rate)} credits at the listed rate).`);
  if (args.dryRun) {
    for (const c of chosen) console.log(`  ${c.video} / ${c.chapter} (${c.text.length})`);
    return;
  }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  let perChar = rate;
  let spent = 0;
  for (const c of chosen) {
    const dir = path.join(here, "out", "lessons", slug(c.video));
    await mkdir(dir, { recursive: true });
    for (let take = 1; take <= args.takes; take++) {
      const estimate = Math.ceil(c.text.length * perChar);
      const now = await plan();
      if (estimate > now.left) {
        console.log(`Stopped before ${c.video} / ${c.chapter}: about ${estimate} credits needed, ${now.left} left.`);
        console.log(`Spent ${spent} credits.`);
        return;
      }
      const res = await call("POST", `/v1/text-to-speech/${voice.id}`, {
        query: { output_format: OUTPUT_FORMAT },
        body: { text: c.text, model_id: MODEL, voice_settings: { stability: voice.stability, similarity_boost: 0.75 } },
      });
      const file = path.join(dir, `${slug(c.chapter)}-take${take}.mp3`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      const cost = Number(res.headers.get("character-cost") ?? c.text.length);
      spent += cost;
      perChar = Math.max(perChar, cost / c.text.length);
      console.log(`  ${path.relative(here, file)}  (${cost} credits)`);
    }
  }
  console.log(`Done: ${spent} credits charged.`);
}

const [command, ...argv] = process.argv.slice(2);
const commands = {
  lesson: () => lesson(parseArgs(argv)),
  speak: () => speak(parseArgs(argv)),
  clone: () => clone(argv),
  voices: () => voices(argv),
  add: () => add(argv),
  design: () => design(argv),
  save: () => save(argv),
  credits,
  audition: () => audition(parseArgs(argv)),
};
if (!commands[command]) {
  console.log("Usage: node site/narration/narrate.mjs voices|add|audition|credits  (see the comment at the top)");
  process.exit(1);
}
commands[command]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
