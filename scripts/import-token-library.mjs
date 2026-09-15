// Imports the Pixel15 token pack (the community library Codex built under
// temp/Library — monsters and civilians) into the client:
//
//   apps/client/public/tokens/<pack path>       every filtered PNG, byte-identical, at the
//                                              pack's own path minus its `Pixel15/` prefix
//   apps/client/src/features/dm/token-library/tokenCatalog.generated.ts   the typed catalog
//   apps/client/public/tokens/README.md         provenance for whoever finds the folder
//
// Dependency-free on purpose (node:crypto, node:fs, node:path only), like
// gen-tile-blob47.mjs. It never touches the pack itself: the manifest is read,
// every PNG is hash-checked against it, and the copies are verified after the
// write. Paths mirror the pack exactly so HeroByte and the pack's own gallery
// agree on every URL without a rename table.
//
// Usage:
//   node scripts/import-token-library.mjs                 import from the default pack path
//   node scripts/import-token-library.mjs --source <manifest.json>
//   node scripts/import-token-library.mjs --check         report drift, write nothing (exit 1 on drift)

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = join(REPO, "temp", "Library", "token-library-pixel15-manifest.json");
const PUBLIC_DIR = join(REPO, "apps", "client", "public", "tokens");
const CATALOG_FILE = join(
  REPO,
  "apps",
  "client",
  "src",
  "features",
  "dm",
  "token-library",
  "tokenCatalog.generated.ts",
);
const PACK_PREFIX = "Pixel15/";
const CANVAS = 1254;
const CATEGORIES = new Set(["monster", "civilian"]);
/** The create-npc name cap (STRING_LIMITS.PLAYER_NAME_MAX): a longer name is refused. */
const NAME_MAX = 50;
/** A byte-order mark: Python wrote the manifest as utf-8-sig, and JSON.parse refuses one. */
const BOM = 0xfeff;

// Monster titles are relative to their family ("Mage", "Club brute"), so the
// NPC name prefixes the singular family unless the title already names the
// creature ("Dire wolf", "Ghast champion", "Imp scout"). Families whose titles
// stand alone get no prefix. Civilians carry an ancestry instead, so theirs is
// "<race> <title>" ("Dwarf blacksmith"). Until the pack carries a `name` of
// its own, this is where a table-ready name comes from.
const FAMILY_NAMES = {
  Goblins: { singular: "Goblin" },
  Skeletons: { singular: "Skeleton" },
  Bandits: { singular: "Bandit" },
  Zombies: { singular: "Zombie" },
  Wolves: { singular: "Wolf" },
  Orcs: { singular: "Orc" },
  Kobolds: { singular: "Kobold" },
  Spiders: { singular: "Spider" },
  Cultists: { singular: "Cultist", stems: ["cult"] },
  Ghouls: { singular: "Ghoul", stems: ["ghast"] },
  Gnolls: { singular: "Gnoll" },
  Ogres: { singular: "Ogre" },
  Worgs: { singular: "Worg" },
  Mephits: { singular: "Mephit" },
  FlyingPests: { singular: null },
  Blights: { singular: "Blight" },
  Lizardfolk: { singular: "Lizardfolk" },
  Constructs: { singular: null },
  Rats: { singular: "Rat" },
  Harpies: { singular: "Harpy" },
  Owlbears: { singular: "Owlbear" },
  Hags: { singular: "Hag" },
  Demons: { singular: "Demon" },
  Devils: { singular: "Devil", stems: ["infernal", "imp"] },
  Trolls: { singular: "Troll" },
  Elementals: { singular: "Elemental" },
  Ettercaps: { singular: "Ettercap" },
  Mummies: { singular: "Mummy" },
  Gargoyles: { singular: "Gargoyle" },
  Mimics: { singular: null },
};

function fail(message) {
  console.error(`import-token-library: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--source") args.source = resolve(argv[++i] ?? "");
    else fail(`unknown argument ${arg}`);
  }
  return args;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function pngDimensions(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || signature.some((b, i) => bytes[i] !== b)) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const lowerFirst = (text) => `${text[0].toLowerCase()}${text.slice(1)}`;

function npcName(asset) {
  if (asset.category === "civilian") {
    const race = typeof asset.race === "string" ? asset.race.trim() : "";
    return race ? `${race} ${lowerFirst(asset.title)}` : asset.title;
  }
  const rule = FAMILY_NAMES[asset.family];
  if (!rule) fail(`family ${asset.family} has no naming rule — add it to FAMILY_NAMES`);
  const lower = asset.title.toLowerCase();
  const stems = [rule.singular?.toLowerCase(), ...(rule.stems ?? [])].filter(Boolean);
  if (!rule.singular || stems.some((stem) => lower.includes(stem))) return asset.title;
  return `${rule.singular} ${lowerFirst(asset.title)}`;
}

const stringList = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()) : [];

function readManifest(source) {
  const text = readFileSync(source, "utf8");
  return JSON.parse(text.charCodeAt(0) === BOM ? text.slice(1) : text);
}

function loadPack(source) {
  if (!existsSync(source)) fail(`manifest not found: ${source}`);
  const packRoot = dirname(source);
  const manifest = readManifest(source);
  const assets = manifest.assets;
  if (!Array.isArray(assets) || assets.length === 0) fail("the manifest lists no assets");
  const groups = new Map();
  for (const group of manifest.groups ?? []) {
    if (!CATEGORIES.has(group.category)) fail(`group ${group.id} has no known category`);
    groups.set(group.id, group);
  }
  const byId = new Map();
  for (const asset of assets) {
    if (byId.has(asset.id)) fail(`duplicate id ${asset.id}`);
    byId.set(asset.id, asset);
  }
  const records = [];
  for (const asset of assets) {
    if (asset.stage !== "filtered") fail(`${asset.id} is not a filtered record`);
    if (!/^[A-Za-z0-9-]+$/.test(asset.id)) fail(`${asset.id}: id is not a safe identifier`);
    if (!CATEGORIES.has(asset.category)) fail(`${asset.id}: category ${asset.category} unknown`);
    const group = groups.get(asset.family);
    if (!group) fail(`${asset.id}: family ${asset.family} is not a group`);
    if (group.category !== asset.category) fail(`${asset.id}: category disagrees with its group`);
    const src = String(asset.src).replace(/\\/g, "/");
    if (!/^Pixel15(\/[A-Za-z0-9][A-Za-z0-9-]*)+\.png$/.test(src)) {
      fail(`${asset.id}: src ${src} is not a safe path under ${PACK_PREFIX}`);
    }
    const file = resolve(packRoot, src);
    if (!file.startsWith(packRoot) || !existsSync(file)) fail(`${asset.id}: missing ${src}`);
    const bytes = readFileSync(file);
    if (sha256(bytes) !== asset.sha256) fail(`${asset.id}: ${src} does not match its sha256`);
    const dims = pngDimensions(bytes);
    if (!dims || dims.width !== CANVAS || dims.height !== CANVAS) {
      fail(`${asset.id}: expected a ${CANVAS}x${CANVAS} PNG, got ${JSON.stringify(dims)}`);
    }
    if (asset.counterpartId) {
      const other = byId.get(asset.counterpartId);
      if (!other || other.counterpartId !== asset.id) {
        fail(`${asset.id}: mimic pair not reciprocal`);
      }
      if (!asset.mimicState || asset.mimicState === other.mimicState) {
        fail(`${asset.id}: a mimic pair needs one disguised and one revealed state`);
      }
    }
    const name = npcName(asset);
    if (name.length === 0 || name.length > NAME_MAX) {
      fail(`${asset.id}: name "${name}" is not 1-${NAME_MAX} chars`);
    }
    records.push({
      id: asset.id,
      category: asset.category,
      family: asset.family,
      src: src.slice(PACK_PREFIX.length),
      title: asset.title,
      name,
      description: typeof asset.description === "string" ? asset.description.trim() : "",
      tags: stringList(asset.tags),
      race: typeof asset.race === "string" ? asset.race : "",
      gender: typeof asset.gender === "string" ? asset.gender : "",
      age: typeof asset.age === "string" ? asset.age : "",
      setting: stringList(asset.setting),
      mimic: asset.mimicState,
      counterpartId: asset.counterpartId,
      bytes,
      sha256: asset.sha256,
    });
  }
  const order = [...groups.keys()];
  const familyIndex = new Map(order.map((g, i) => [g, i]));
  records.sort((a, b) => familyIndex.get(a.family) - familyIndex.get(b.family));
  const families = order
    .filter((g) => records.some((r) => r.family === g))
    .map((id) => ({ id, label: groups.get(id).label || id, category: groups.get(id).category }));
  return { manifest, records, families };
}

function renderEntry(record) {
  const fields = [
    `id: ${JSON.stringify(record.id)}`,
    `category: ${JSON.stringify(record.category)}`,
    `family: ${JSON.stringify(record.family)}`,
    `src: ${JSON.stringify(record.src)}`,
    `title: ${JSON.stringify(record.title)}`,
    `name: ${JSON.stringify(record.name)}`,
  ];
  if (record.description) fields.push(`description: ${JSON.stringify(record.description)}`);
  if (record.tags.length) fields.push(`tags: ${JSON.stringify(record.tags)}`);
  if (record.race) fields.push(`race: ${JSON.stringify(record.race)}`);
  if (record.gender) fields.push(`gender: ${JSON.stringify(record.gender)}`);
  if (record.age) fields.push(`age: ${JSON.stringify(record.age)}`);
  if (record.setting.length) fields.push(`setting: ${JSON.stringify(record.setting)}`);
  if (record.mimic) fields.push(`mimic: ${JSON.stringify(record.mimic)}`);
  if (record.counterpartId) fields.push(`counterpartId: ${JSON.stringify(record.counterpartId)}`);
  return `  { ${fields.join(", ")} },`;
}

function renderCatalog({ manifest, records, families }) {
  const created = manifest.createdAt ?? "unknown date";
  const title = manifest.title ?? "token pack";
  const counts = ["monster", "civilian"]
    .map((c) => `${records.filter((r) => r.category === c).length} ${c}`)
    .join(", ");
  return [
    "// GENERATED FILE — do not edit by hand. Regenerate with:",
    "//   node scripts/import-token-library.mjs",
    `// Source pack: ${title} (${records.length} tokens: ${counts}; manifest created ${created}).`,
    "//",
    "// One entry per line on purpose (prettier-ignore): the 350-line structure",
    "// guard counts lines, and a pretty-printed object per token would be a dozen",
    "// lines each. The image for an entry is libraryImageUrl(entry).",
    "",
    'import type { LibraryAsset, LibraryFamily } from "./tokenCatalogTypes";',
    "",
    "/** Families in the pack's own order, with the pack's labels. */",
    "// prettier-ignore",
    "export const LIBRARY_FAMILIES: readonly LibraryFamily[] = [",
    ...families.map(
      (f) =>
        `  { id: ${JSON.stringify(f.id)}, label: ${JSON.stringify(f.label)}, category: ${JSON.stringify(f.category)} },`,
    ),
    "];",
    "",
    "/** Every token in the pack, grouped by family. */",
    "// prettier-ignore",
    "export const LIBRARY_ASSETS: readonly LibraryAsset[] = [",
    ...records.map(renderEntry),
    "];",
    "",
  ].join("\n");
}

function renderReadme({ manifest, records, families }) {
  const created = (manifest.createdAt ?? "").slice(0, 10) || "an unknown date";
  const monsters = records.filter((r) => r.category === "monster").length;
  const civilians = records.filter((r) => r.category === "civilian").length;
  return `# HeroByte token pack (Pixel15)

${records.length} transparent PNG tokens — ${monsters} monsters and ${civilians} civilians across
${families.length} families — ${CANVAS} × ${CANVAS} px each, drawn top-down for a virtual tabletop and
finished with a pixel-size-15 pass (an 84 × 84 logical grid). Every file is byte-identical to the
community pack's \`Pixel15/\` output (manifest of ${created}) and sits at the pack's own path, so
\`/tokens/<path>\` here is \`Pixel15/<path>\` there.

Generated: do not edit these files by hand. \`node scripts/import-token-library.mjs\` copies the
pack from \`temp/Library\` and regenerates the catalog the DM menu's Library reads
(\`apps/client/src/features/dm/token-library/tokenCatalog.generated.ts\`).

## Provenance

The art was generated by the HeroByte owner with ChatGPT's built-in image generation, with the art
direction, prompts, and the pixel pass by OpenAI Codex (September 2026), then filtered locally with
the pack's calibrated Pixel15 preset. The pack's own manifests carry every source hash and prompt
path.

## Licence

Not yet published. The owner intends to release the images under an open licence as a standalone
community pack; until that lands they are part of this repository under its root LICENSE.
`;
}

function listPngs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listPngs(full));
    else if (entry.name.endsWith(".png")) out.push(full);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const pack = loadPack(args.source);
  const catalog = renderCatalog(pack);
  const readme = renderReadme(pack);
  const planned = new Map();
  for (const record of pack.records) {
    const file = join(PUBLIC_DIR, ...record.src.split("/"));
    if (planned.has(file)) fail(`${record.id}: two tokens share the path ${record.src}`);
    planned.set(file, record);
  }

  if (args.check) {
    const drift = [];
    for (const [file, record] of planned) {
      if (!existsSync(file)) drift.push(`missing ${relative(REPO, file)}`);
      else if (sha256(readFileSync(file)) !== record.sha256) {
        drift.push(`changed ${relative(REPO, file)}`);
      }
    }
    const present = existsSync(PUBLIC_DIR) ? listPngs(PUBLIC_DIR) : [];
    for (const file of present) if (!planned.has(file)) drift.push(`stray ${relative(REPO, file)}`);
    if (!existsSync(CATALOG_FILE) || readFileSync(CATALOG_FILE, "utf8") !== catalog) {
      drift.push(`catalog ${relative(REPO, CATALOG_FILE)} is out of date`);
    }
    if (drift.length) {
      console.error(drift.join("\n"));
      fail(`${drift.length} difference(s) between the pack and the repo`);
    }
    console.log(`import-token-library: ${pack.records.length} tokens match the pack`);
    return;
  }

  // The folder is owned by this script: a renamed or dropped token must not
  // leave its old file behind to be served forever.
  rmSync(PUBLIC_DIR, { recursive: true, force: true });
  for (const [file, record] of planned) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, record.bytes);
    if (sha256(readFileSync(file)) !== record.sha256) fail(`copy of ${record.id} does not verify`);
  }
  writeFileSync(join(PUBLIC_DIR, "README.md"), readme);
  mkdirSync(dirname(CATALOG_FILE), { recursive: true });
  writeFileSync(CATALOG_FILE, catalog);
  const bytes = pack.records.reduce((sum, r) => sum + r.bytes.length, 0);
  console.log(
    `import-token-library: ${pack.records.length} tokens / ${pack.families.length} families ` +
      `(${(bytes / 1024 / 1024).toFixed(2)} MiB) -> ${relative(REPO, PUBLIC_DIR)}; ` +
      `catalog -> ${relative(REPO, CATALOG_FILE)}`,
  );
}

main();
