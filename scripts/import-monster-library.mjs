// Imports the Pixel15 monster pack (the community library Codex built under
// temp/Library) into the client:
//
//   apps/client/public/tokens/monsters/<Family>/<id>.png      every filtered PNG, byte-identical
//   apps/client/src/features/dm/monster-library/monsterCatalog.generated.ts   the typed catalog
//   apps/client/public/tokens/monsters/README.md               provenance for whoever finds the folder
//
// Dependency-free on purpose (node:crypto, node:fs, node:path only), like
// gen-tile-blob47.mjs. It never touches the pack itself: the manifest is read,
// every PNG is hash-checked against it, and the copies are verified after the
// write. The five disguised mimics are the one rename — the pack names those
// files by object (closedChest.png), the catalog by asset id
// (mimicChestHidden.png) — so `<Family>/<id>.png` holds for the whole set.
//
// Usage:
//   node scripts/import-monster-library.mjs                 import from the default pack path
//   node scripts/import-monster-library.mjs --source <manifest.json>
//   node scripts/import-monster-library.mjs --check         report drift, write nothing (exit 1 on drift)

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SOURCE = join(REPO, "temp", "Library", "monster-library-pixel15-manifest.json");
const PUBLIC_DIR = join(REPO, "apps", "client", "public", "tokens", "monsters");
const CATALOG_FILE = join(
  REPO,
  "apps",
  "client",
  "src",
  "features",
  "dm",
  "monster-library",
  "monsterCatalog.generated.ts",
);
const CANVAS = 1254;
/** The create-npc name cap (STRING_LIMITS.PLAYER_NAME_MAX): a longer name is refused. */
const NAME_MAX = 50;

// The pack titles are relative to their family ("Mage", "Club brute"), so the
// NPC name prefixes the singular family unless the title already names the
// creature ("Dire wolf", "Ghast champion", "Imp scout"). Families whose titles
// stand alone get no prefix. Until the pack carries a `name` of its own, this
// table is where a table-ready name comes from.
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
  FlyingPests: { singular: null, label: "Flying Pests" },
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
  console.error(`import-monster-library: ${message}`);
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

function familyLabel(id) {
  return FAMILY_NAMES[id]?.label ?? id.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function npcName(family, title) {
  const rule = FAMILY_NAMES[family];
  if (!rule) fail(`family ${family} has no naming rule — add it to FAMILY_NAMES`);
  const lower = title.toLowerCase();
  const stems = [rule.singular?.toLowerCase(), ...(rule.stems ?? [])].filter(Boolean);
  if (!rule.singular || stems.some((stem) => lower.includes(stem))) return title;
  return `${rule.singular} ${title[0].toLowerCase()}${title.slice(1)}`;
}

function loadPack(source) {
  if (!existsSync(source)) fail(`manifest not found: ${source}`);
  const packRoot = dirname(source);
  // The pack's manifest may open with a byte-order mark (Python wrote it as
  // utf-8-sig); JSON.parse refuses one.
  const manifest = JSON.parse(readFileSync(source, "utf8").replace(/^﻿/, ""));
  const assets = manifest.assets;
  if (!Array.isArray(assets) || assets.length === 0) fail("the manifest lists no assets");
  const groups = (manifest.groups ?? []).map((g) => g.id);
  const byId = new Map();
  for (const asset of assets) {
    if (byId.has(asset.id)) fail(`duplicate id ${asset.id}`);
    byId.set(asset.id, asset);
  }
  const records = [];
  for (const asset of assets) {
    if (asset.stage !== "filtered") fail(`${asset.id} is not a filtered record`);
    if (!/^[A-Za-z0-9-]+$/.test(asset.id)) fail(`${asset.id}: id is not a safe filename`);
    if (!/^[A-Za-z]+$/.test(asset.family)) fail(`${asset.id}: family is not a safe folder name`);
    if (!groups.includes(asset.family)) fail(`${asset.id}: family ${asset.family} is not a group`);
    const file = resolve(packRoot, asset.src);
    if (!file.startsWith(packRoot) || !existsSync(file)) fail(`${asset.id}: missing ${asset.src}`);
    const bytes = readFileSync(file);
    if (sha256(bytes) !== asset.sha256) fail(`${asset.id}: ${asset.src} does not match its sha256`);
    const dims = pngDimensions(bytes);
    if (!dims || dims.width !== CANVAS || dims.height !== CANVAS) {
      fail(`${asset.id}: expected a ${CANVAS}x${CANVAS} PNG, got ${JSON.stringify(dims)}`);
    }
    if (asset.counterpartId) {
      const other = byId.get(asset.counterpartId);
      if (!other || other.counterpartId !== asset.id)
        fail(`${asset.id}: mimic pair not reciprocal`);
      if (!asset.mimicState || asset.mimicState === other.mimicState) {
        fail(`${asset.id}: a mimic pair needs one disguised and one revealed state`);
      }
    }
    const name = npcName(asset.family, asset.title);
    if (name.length === 0 || name.length > NAME_MAX) {
      fail(`${asset.id}: name "${name}" is not 1-${NAME_MAX} chars`);
    }
    records.push({
      id: asset.id,
      family: asset.family,
      title: asset.title,
      name,
      mimic: asset.mimicState,
      counterpartId: asset.counterpartId,
      bytes,
      sha256: asset.sha256,
    });
  }
  const familyIndex = new Map(groups.map((g, i) => [g, i]));
  records.sort((a, b) => familyIndex.get(a.family) - familyIndex.get(b.family));
  const families = groups
    .filter((g) => records.some((r) => r.family === g))
    .map((id) => ({ id, label: familyLabel(id) }));
  return { manifest, records, families };
}

function renderEntry(record) {
  const fields = [
    `id: ${JSON.stringify(record.id)}`,
    `family: ${JSON.stringify(record.family)}`,
    `title: ${JSON.stringify(record.title)}`,
    `name: ${JSON.stringify(record.name)}`,
  ];
  if (record.mimic) fields.push(`mimic: ${JSON.stringify(record.mimic)}`);
  if (record.counterpartId) fields.push(`counterpartId: ${JSON.stringify(record.counterpartId)}`);
  return `  { ${fields.join(", ")} },`;
}

function renderCatalog({ manifest, records, families }) {
  const created = manifest.createdAt ?? "unknown date";
  const title = manifest.title ?? "monster pack";
  return [
    "// GENERATED FILE — do not edit by hand. Regenerate with:",
    "//   node scripts/import-monster-library.mjs",
    `// Source pack: ${title} (${records.length} tokens, manifest created ${created}).`,
    "//",
    "// One entry per line on purpose (prettier-ignore): the 350-line structure",
    "// guard counts lines, and a pretty-printed object per token would be seven",
    "// lines each. The image for an entry is monsterImageUrl(entry).",
    "",
    'import type { MonsterAsset, MonsterFamily } from "./monsterCatalogTypes";',
    "",
    "/** Families in the pack's roadmap order — the order the library lists them. */",
    "// prettier-ignore",
    "export const MONSTER_FAMILIES: readonly MonsterFamily[] = [",
    ...families.map((f) => `  { id: ${JSON.stringify(f.id)}, label: ${JSON.stringify(f.label)} },`),
    "];",
    "",
    "/** Every token in the pack, grouped by family. */",
    "// prettier-ignore",
    "export const MONSTER_ASSETS: readonly MonsterAsset[] = [",
    ...records.map(renderEntry),
    "];",
    "",
  ].join("\n");
}

function renderReadme({ manifest, records, families }) {
  const created = (manifest.createdAt ?? "").slice(0, 10) || "an unknown date";
  return `# HeroByte monster tokens (Pixel15 pack)

${records.length} transparent PNG tokens across ${families.length} families, ${CANVAS} × ${CANVAS} px each,
drawn top-down for a virtual tabletop and finished with a pixel-size-15 pass (an 84 × 84 logical
grid). Every file is byte-identical to the community pack's \`Pixel15/\` output (manifest of
${created}); the five disguised mimics are the only files renamed — to their asset ids — so that
\`<Family>/<id>.png\` holds for the whole set.

Generated: do not edit these files by hand. \`node scripts/import-monster-library.mjs\` copies the
pack from \`temp/Library\` and regenerates the catalog the DM menu's Monster Library reads
(\`apps/client/src/features/dm/monster-library/monsterCatalog.generated.ts\`).

## Provenance

The art was generated by the HeroByte owner with ChatGPT's built-in image generation, with the art
direction, prompts, and the pixel pass by OpenAI Codex (September 2026), then filtered locally with
the pack's calibrated Pixel15 preset. The pack's own manifest carries every source hash and prompt
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
    planned.set(join(PUBLIC_DIR, record.family, `${record.id}.png`), record);
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
    console.log(`import-monster-library: ${pack.records.length} tokens match the pack`);
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
    `import-monster-library: ${pack.records.length} tokens / ${pack.families.length} families ` +
      `(${(bytes / 1024 / 1024).toFixed(2)} MiB) -> ${relative(REPO, PUBLIC_DIR)}; ` +
      `catalog -> ${relative(REPO, CATALOG_FILE)}`,
  );
}

main();
