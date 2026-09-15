// Imports the Pixel15 token pack (the community library Codex built under
// temp/Library — monsters and civilians, pack 1.0.0 and later) into the client:
//
//   apps/client/public/tokens/<pack path>       every PNG of every tier, byte-identical, at the
//                                              pack's own path minus its `Pixel15/` prefix
//   apps/client/src/features/dm/token-library/tokenCatalog.generated.ts   the typed catalog
//   apps/client/public/tokens/README.md         provenance for whoever finds the folder
//
// Three tiers per token: the 1254px master (the map), a 336px medium (the
// portrait) and an 84px thumb (the picker — one pixel per pixel-15 cell).
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
const TIERS = { master: 1254, medium: 336, thumb: 84 };
const CATEGORIES = new Set(["monster", "civilian"]);
/** The token size ladder (TokenSize in @herobyte/shared). */
const TOKEN_SIZES = new Set(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
/** The create-npc name cap (STRING_LIMITS.PLAYER_NAME_MAX): a longer name is refused. */
const NAME_MAX = 50;
/** A byte-order mark: Python wrote the manifest as utf-8-sig, and JSON.parse refuses one. */
const BOM = 0xfeff;

// Packs before 1.0.0 had no `displayName`; the fallback derives one. Monster
// titles are relative to their family ("Mage", "Club brute"), so the name
// prefixes the singular family unless the title already names the creature;
// civilians carry an ancestry, so theirs is "<race> <title>".
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

function derivedName(asset) {
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

const text = (value) => (typeof value === "string" ? value.trim() : "");
const stringList = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()) : [];

function readManifest(source) {
  const raw = readFileSync(source, "utf8");
  return JSON.parse(raw.charCodeAt(0) === BOM ? raw.slice(1) : raw);
}

/** The pack path of one tier, checked for shape and safety; returns the path under /tokens. */
function packPath(id, tier, value) {
  const src = String(value ?? "").replace(/\\/g, "/");
  if (!/^Pixel15(\/[A-Za-z0-9][A-Za-z0-9-]*)+\.png$/.test(src)) {
    fail(`${id}: ${tier} path ${src} is not a safe path under ${PACK_PREFIX}`);
  }
  return src.slice(PACK_PREFIX.length);
}

/** Read one tier's PNG from the pack and verify it against the manifest. */
function readTier(packRoot, id, tier, record) {
  const src = packPath(id, tier, record?.src);
  const file = resolve(packRoot, PACK_PREFIX + src);
  if (!file.startsWith(packRoot) || !existsSync(file)) fail(`${id}: missing ${tier} ${src}`);
  const bytes = readFileSync(file);
  if (sha256(bytes) !== record.sha256) fail(`${id}: ${tier} ${src} does not match its sha256`);
  const dims = pngDimensions(bytes);
  const edge = TIERS[tier];
  if (!dims || dims.width !== edge || dims.height !== edge) {
    fail(`${id}: expected a ${edge}x${edge} ${tier} PNG, got ${JSON.stringify(dims)}`);
  }
  return { src, bytes, sha256: record.sha256 };
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
    const { id } = asset;
    if (asset.stage !== "filtered") fail(`${id} is not a filtered record`);
    if (!/^[A-Za-z0-9-]+$/.test(id)) fail(`${id}: id is not a safe identifier`);
    if (!CATEGORIES.has(asset.category)) fail(`${id}: category ${asset.category} unknown`);
    const group = groups.get(asset.family);
    if (!group) fail(`${id}: family ${asset.family} is not a group`);
    if (group.category !== asset.category) fail(`${id}: category disagrees with its group`);
    const master = readTier(packRoot, id, "master", asset);
    const medium = readTier(packRoot, id, "medium", asset.medium);
    const thumb = readTier(packRoot, id, "thumb", asset.thumb);
    if (asset.counterpartId) {
      const other = byId.get(asset.counterpartId);
      if (!other || other.counterpartId !== id) fail(`${id}: mimic pair not reciprocal`);
      if (!asset.mimicState || asset.mimicState === other.mimicState) {
        fail(`${id}: a mimic pair needs one disguised and one revealed state`);
      }
    }
    const name = text(asset.displayName) || derivedName(asset);
    if (name.length === 0 || name.length > NAME_MAX) {
      fail(`${id}: name "${name}" is not 1-${NAME_MAX} chars`);
    }
    const size = text(asset.tokenSize) || "medium";
    if (!TOKEN_SIZES.has(size)) fail(`${id}: tokenSize ${size} is not on the ladder`);
    const legacyIds = stringList(asset.legacyIds);
    for (const legacy of legacyIds) {
      if (byId.has(legacy)) fail(`${id}: legacy id ${legacy} is still a live id`);
    }
    records.push({
      id,
      category: asset.category,
      family: asset.family,
      src: master.src,
      medium: medium.src,
      thumb: thumb.src,
      title: asset.title,
      name,
      size,
      creatureType: text(asset.creatureType),
      role: text(asset.role),
      description: text(asset.description),
      tags: stringList(asset.tags),
      race: text(asset.race),
      gender: text(asset.gender),
      age: text(asset.age),
      setting: stringList(asset.setting),
      mimic: asset.mimicState,
      counterpartId: asset.counterpartId,
      legacyIds,
      legacySrcs: stringList(asset.legacySrcs).map((s) => packPath(id, "legacy", s)),
      files: [master, medium, thumb],
    });
  }
  const aliases = {};
  for (const [legacy, current] of Object.entries(manifest.idAliases ?? {})) {
    if (!byId.has(current)) fail(`idAliases: ${legacy} points at unknown id ${current}`);
    if (byId.has(legacy)) fail(`idAliases: ${legacy} is still a live id`);
    aliases[legacy] = current;
  }
  const order = [...groups.keys()];
  const familyIndex = new Map(order.map((g, i) => [g, i]));
  records.sort((a, b) => familyIndex.get(a.family) - familyIndex.get(b.family));
  const families = order
    .filter((g) => records.some((r) => r.family === g))
    .map((id) => ({ id, label: groups.get(id).label || id, category: groups.get(id).category }));
  return { manifest, records, families, aliases };
}

function renderEntry(record) {
  const fields = [
    `id: ${JSON.stringify(record.id)}`,
    `category: ${JSON.stringify(record.category)}`,
    `family: ${JSON.stringify(record.family)}`,
    `src: ${JSON.stringify(record.src)}`,
    `medium: ${JSON.stringify(record.medium)}`,
    `thumb: ${JSON.stringify(record.thumb)}`,
    `title: ${JSON.stringify(record.title)}`,
    `name: ${JSON.stringify(record.name)}`,
    `size: ${JSON.stringify(record.size)}`,
  ];
  const optional = [
    ["creatureType", record.creatureType],
    ["role", record.role],
    ["description", record.description],
    ["tags", record.tags.length ? record.tags : ""],
    ["race", record.race],
    ["gender", record.gender],
    ["age", record.age],
    ["setting", record.setting.length ? record.setting : ""],
    ["mimic", record.mimic],
    ["counterpartId", record.counterpartId],
    ["legacyIds", record.legacyIds.length ? record.legacyIds : ""],
    ["legacySrcs", record.legacySrcs.length ? record.legacySrcs : ""],
  ];
  for (const [key, value] of optional) if (value) fields.push(`${key}: ${JSON.stringify(value)}`);
  return `  { ${fields.join(", ")} },`;
}

function renderCatalog({ manifest, records, families, aliases }) {
  const created = manifest.createdAt ?? "unknown date";
  const title = manifest.title ?? "token pack";
  const version = manifest.packVersion ?? "0.0.0";
  const counts = ["monster", "civilian"]
    .map((c) => `${records.filter((r) => r.category === c).length} ${c}`)
    .join(", ");
  return [
    "// GENERATED FILE — do not edit by hand. Regenerate with:",
    "//   node scripts/import-token-library.mjs",
    `// Source pack: ${title} ${version} (${records.length} tokens: ${counts}; manifest created ${created}).`,
    "//",
    "// One entry per line on purpose (prettier-ignore): the 350-line structure",
    "// guard counts lines, and a pretty-printed object per token would be a dozen",
    "// lines each. The images for an entry are libraryImageUrl(entry) (the 1254px",
    "// master), libraryMediumUrl(entry) (336px) and libraryThumbUrl(entry) (84px).",
    "",
    'import type { LibraryAsset, LibraryFamily } from "./tokenCatalogTypes";',
    "",
    `export const LIBRARY_PACK_VERSION = ${JSON.stringify(version)};`,
    "",
    "/** Ids the pack renamed: a saved reference to the old id resolves to the new one. */",
    "// prettier-ignore",
    `export const LIBRARY_ID_ALIASES: Readonly<Record<string, string>> = ${JSON.stringify(aliases)};`,
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
  const version = manifest.packVersion ?? "unversioned";
  const monsters = records.filter((r) => r.category === "monster").length;
  const civilians = records.filter((r) => r.category === "civilian").length;
  const provenance = manifest.provenance ?? {};
  const licence = manifest.license
    ? `\`${manifest.license}\`${manifest.attribution ? ` — ${manifest.attribution}` : ""}`
    : null;
  return `# HeroByte token pack (Pixel15, pack ${version})

${records.length} tokens — ${monsters} monsters and ${civilians} civilians across ${families.length}
families — as transparent PNGs in three tiers: the 1254 × 1254 master (drawn on the map), a
336 × 336 medium (the portrait) and an 84 × 84 thumbnail (the picker; one pixel per pixel-15 cell).
Every file is byte-identical to the community pack's \`Pixel15/\` output (manifest of ${created})
and sits at the pack's own path, so \`/tokens/<path>\` here is \`Pixel15/<path>\` there.

Generated: do not edit these files by hand. \`node scripts/import-token-library.mjs\` copies the
pack from \`temp/Library\` and regenerates the catalog the DM menu's Library reads
(\`apps/client/src/features/dm/token-library/tokenCatalog.generated.ts\`).

## Provenance

${provenance.generator ? `Generator: ${provenance.generator}.` : "The art was generated with ChatGPT's built-in image generation."}
${provenance.authorshipWorkflow ?? ""}
${provenance.pixelFinish ? `Pixel finish: ${provenance.pixelFinish}` : ""}
${provenance.derivatives ? `Derivatives: ${provenance.derivatives}` : ""}
Art direction, prompts and the pixel pass by OpenAI Codex (September 2026). The pack's own manifest
carries every source hash and prompt path.

## Licence

${
  licence ??
  `Not yet published (the pack says \`${manifest.licenseStatus ?? "pending"}\`). The owner intends to
release the images under an open licence as a standalone community pack; until that lands they are
part of this repository under its root LICENSE.`
}
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
    for (const tier of record.files) {
      const file = join(PUBLIC_DIR, ...tier.src.split("/"));
      if (planned.has(file)) fail(`${record.id}: two files share the path ${tier.src}`);
      planned.set(file, tier);
    }
  }

  if (args.check) {
    const drift = [];
    for (const [file, tier] of planned) {
      if (!existsSync(file)) drift.push(`missing ${relative(REPO, file)}`);
      else if (sha256(readFileSync(file)) !== tier.sha256) {
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
  for (const [file, tier] of planned) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, tier.bytes);
    if (sha256(readFileSync(file)) !== tier.sha256) fail(`copy of ${tier.src} does not verify`);
  }
  writeFileSync(join(PUBLIC_DIR, "README.md"), readme);
  mkdirSync(dirname(CATALOG_FILE), { recursive: true });
  writeFileSync(CATALOG_FILE, catalog);
  const bytes = [...planned.values()].reduce((sum, t) => sum + t.bytes.length, 0);
  console.log(
    `import-token-library: pack ${pack.manifest.packVersion ?? "?"}: ${pack.records.length} tokens / ` +
      `${pack.families.length} families, ${planned.size} files (${(bytes / 1024 / 1024).toFixed(2)} MiB) ` +
      `-> ${relative(REPO, PUBLIC_DIR)}; catalog -> ${relative(REPO, CATALOG_FILE)}`,
  );
}

main();
