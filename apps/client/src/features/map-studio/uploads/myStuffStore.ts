// The asset service is content-addressed and deliberately has no list
// endpoint, so each browser keeps its own "My Stuff" inventory of uploads in
// localStorage. Losing this list never loses data: the bytes live on the
// server, and any document referencing upload:<hash> still renders.

export interface MyStuffAsset {
  hash: string;
  name: string;
  mime: string;
  size: number;
  /** Natural image dimensions in pixels, when the browser could measure them. */
  width?: number;
  height?: number;
  addedAt: number;
}

const STORAGE_KEY = "herobyte-my-stuff";
export const MY_STUFF_MAX_ENTRIES = 60;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export function loadMyStuffAssets(): MyStuffAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMyStuffAsset).slice(0, MY_STUFF_MAX_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Newest-first; re-uploading an existing hash refreshes its entry. Operates on
 * the caller's known list (the hook's React state is the source of truth) so a
 * failed persist can't collapse the shelf back to a stale localStorage read.
 */
export function addMyStuffAsset(current: MyStuffAsset[], asset: MyStuffAsset): MyStuffAsset[] {
  const rest = current.filter((entry) => entry.hash !== asset.hash);
  const next = [asset, ...rest].slice(0, MY_STUFF_MAX_ENTRIES);
  persist(next);
  return next;
}

export function removeMyStuffAsset(current: MyStuffAsset[], hash: string): MyStuffAsset[] {
  const next = current.filter((entry) => entry.hash !== hash);
  persist(next);
  return next;
}

function persist(assets: MyStuffAsset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // Private-mode storage failures degrade to a session-only shelf.
  }
}

function isMyStuffAsset(value: unknown): value is MyStuffAsset {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.hash === "string" &&
    SHA256_HEX.test(record.hash) &&
    typeof record.name === "string" &&
    typeof record.mime === "string" &&
    typeof record.size === "number" &&
    typeof record.addedAt === "number" &&
    (record.width === undefined || typeof record.width === "number") &&
    (record.height === undefined || typeof record.height === "number")
  );
}
