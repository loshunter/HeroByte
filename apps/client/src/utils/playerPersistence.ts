import type { Player, PlayerState } from "@shared";

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}

export function savePlayerState(player: Player, tokenImage?: string | null | undefined): void {
  const state: PlayerState = {
    name: player.name,
    hp: player.hp ?? 100,
    maxHp: player.maxHp ?? 100,
    portrait: player.portrait ?? null,
    tokenImage: tokenImage ?? null,
  };

  const safeName = sanitizeFilenameSegment(player.name || "player");
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const fileName = `${safeName || "player"}-state-${timestamp}.json`;
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function loadPlayerState(file: File): Promise<PlayerState> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("Invalid player state file (not valid JSON)");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid player state structure");
  }

  const { name, hp, maxHp, portrait, tokenImage } = parsed;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Player state is missing a valid name");
  }
  if (typeof hp !== "number" || !Number.isFinite(hp)) {
    throw new Error("Player state is missing a valid hp value");
  }
  if (typeof maxHp !== "number" || !Number.isFinite(maxHp)) {
    throw new Error("Player state is missing a valid maxHp value");
  }
  if (hp < 0 || maxHp <= 0) {
    throw new Error("Player state contains invalid HP values");
  }

  if (portrait !== undefined && portrait !== null && typeof portrait !== "string") {
    throw new Error("Player state portrait must be a string or null");
  }
  if (tokenImage !== undefined && tokenImage !== null && typeof tokenImage !== "string") {
    throw new Error("Player state tokenImage must be a string or null");
  }

  const normalizedPortrait =
    portrait === undefined ? undefined : (portrait === null ? null : portrait);
  const normalizedTokenImage =
    tokenImage === undefined ? undefined : (tokenImage === null ? null : tokenImage);

  return {
    name: name.trim(),
    hp,
    maxHp,
    portrait: normalizedPortrait,
    tokenImage: normalizedTokenImage,
  };
}
