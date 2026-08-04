import type {
  Drawing,
  Player,
  PlayerState,
  PlayerStateTokenSnapshot,
  SceneObject,
  Token,
  TokenSize,
} from "@herobyte/shared";
import { cloneDrawingForExport, sanitizeDrawingFromImport } from "./characterDrawings";

interface SavePlayerStateParams {
  player: Player;
  token?: Token | null;
  tokenScene?: (SceneObject & { type: "token" }) | null;
  drawings?: Drawing[] | null;
  initiativeModifier?: number;
}

const TOKEN_SIZES: TokenSize[] = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const MAX_DRAWINGS = 200;

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-");
}

function sanitizeStatusEffects(source: unknown): string[] | undefined {
  if (!Array.isArray(source)) {
    return undefined;
  }

  const cleaned = source
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 16);

  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseTokenSnapshot(raw: unknown): PlayerStateTokenSnapshot | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const snapshot: PlayerStateTokenSnapshot = {};
  const { id, color, imageUrl, position, size, rotation, scale } = raw;

  if (typeof id === "string" && id.trim().length > 0) {
    snapshot.id = id.trim();
  }

  if (typeof color === "string" && color.trim().length > 0) {
    snapshot.color = color.trim();
  }

  if (imageUrl === null) {
    snapshot.imageUrl = null;
  } else if (typeof imageUrl === "string") {
    const trimmed = imageUrl.trim();
    snapshot.imageUrl = trimmed.length > 0 ? trimmed : null;
  }

  if (isRecord(position) && isFiniteNumber(position.x) && isFiniteNumber(position.y)) {
    snapshot.position = { x: position.x, y: position.y };
  }

  if (typeof size === "string" && TOKEN_SIZES.includes(size as TokenSize)) {
    snapshot.size = size as TokenSize;
  }

  if (isFiniteNumber(rotation)) {
    snapshot.rotation = rotation;
  }

  if (
    isRecord(scale) &&
    isFiniteNumber(scale.x) &&
    isFiniteNumber(scale.y) &&
    scale.x > 0 &&
    scale.y > 0
  ) {
    snapshot.scale = { x: scale.x, y: scale.y };
  }

  const definedKeys = Object.keys(snapshot);
  return definedKeys.length === 0 ? undefined : snapshot;
}

export function savePlayerState({
  player,
  token,
  tokenScene,
  drawings = [],
  initiativeModifier,
}: SavePlayerStateParams): void {
  const tokenSnapshot: PlayerStateTokenSnapshot | undefined = token
    ? {
        id: token.id,
        color: token.color,
        imageUrl: token.imageUrl ?? null,
        position: { x: token.x, y: token.y },
        size: token.size,
        rotation: tokenScene?.transform.rotation,
        scale:
          tokenScene && (tokenScene.transform.scaleX !== 1 || tokenScene.transform.scaleY !== 1)
            ? { x: tokenScene.transform.scaleX, y: tokenScene.transform.scaleY }
            : undefined,
      }
    : undefined;

  const sanitizedStatus = sanitizeStatusEffects(player.statusEffects);
  const sanitizedDrawings =
    Array.isArray(drawings) && drawings.length > 0
      ? drawings.slice(0, MAX_DRAWINGS).map(cloneDrawingForExport)
      : undefined;

  const state: PlayerState = {
    name: player.name,
    hp: player.hp ?? 100,
    maxHp: player.maxHp ?? 100,
    portrait: player.portrait ?? null,
    tokenImage: tokenSnapshot?.imageUrl ?? null,
    color: tokenSnapshot?.color,
    token: tokenSnapshot,
    statusEffects: sanitizedStatus,
    drawings: sanitizedDrawings,
    initiativeModifier: initiativeModifier !== undefined ? initiativeModifier : undefined,
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

export async function loadPlayerState(file: File): Promise<PlayerState> {
  const text = await file.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid player state file (not valid JSON)");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid player state structure");
  }

  const { name, hp, maxHp, portrait, tokenImage, color } = parsed;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Player state is missing a valid name");
  }
  if (!isFiniteNumber(hp)) {
    throw new Error("Player state is missing a valid hp value");
  }
  if (!isFiniteNumber(maxHp)) {
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
    portrait === undefined ? undefined : portrait === null ? null : (portrait as string);
  const normalizedTokenImage =
    tokenImage === undefined ? undefined : tokenImage === null ? null : (tokenImage as string);

  const primaryToken = parseTokenSnapshot(parsed.token);

  let fallbackToken: PlayerStateTokenSnapshot | undefined;
  if (!primaryToken) {
    const fallbackSource: Record<string, unknown> = {};
    if (typeof parsed.tokenId === "string") {
      fallbackSource.id = parsed.tokenId;
    }
    if (typeof color === "string") {
      fallbackSource.color = color;
    }
    if (tokenImage !== undefined) {
      fallbackSource.imageUrl = tokenImage;
    }
    if (isRecord(parsed.tokenPosition)) {
      fallbackSource.position = parsed.tokenPosition;
    }
    if (typeof parsed.tokenSize === "string") {
      fallbackSource.size = parsed.tokenSize;
    }
    if (isFiniteNumber(parsed.tokenRotation)) {
      fallbackSource.rotation = parsed.tokenRotation;
    }
    if (isRecord(parsed.tokenScale)) {
      fallbackSource.scale = parsed.tokenScale;
    }
    fallbackToken = parseTokenSnapshot(fallbackSource);
  }

  const tokenSnapshot = primaryToken ?? fallbackToken;
  const statusEffects = sanitizeStatusEffects(parsed.statusEffects);

  let drawings: Drawing[] | undefined;
  if (Array.isArray(parsed.drawings)) {
    const sanitized: Drawing[] = [];
    for (let index = 0; index < Math.min(parsed.drawings.length, MAX_DRAWINGS); index += 1) {
      const drawing = sanitizeDrawingFromImport(parsed.drawings[index], index);
      if (drawing) {
        sanitized.push(drawing);
      }
    }
    drawings = sanitized;
  }

  // Parse initiative modifier (optional number)
  const initiativeModifier = isFiniteNumber(parsed.initiativeModifier)
    ? parsed.initiativeModifier
    : undefined;

  return {
    name: name.trim(),
    hp,
    maxHp,
    portrait: normalizedPortrait,
    tokenImage: tokenSnapshot?.imageUrl ?? normalizedTokenImage,
    color: tokenSnapshot?.color ?? (typeof color === "string" ? color.trim() : undefined),
    token: tokenSnapshot,
    statusEffects,
    drawings,
    initiativeModifier,
  };
}
