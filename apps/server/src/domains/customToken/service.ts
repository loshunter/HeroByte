// ============================================================================
// CUSTOM TOKEN DOMAIN - SERVICE
// ============================================================================
// A table's own Library tokens: images the DM brought (an upload, or an
// https link such as imgur) with the name, description, tags and size the
// bundled pack's entries carry, so they search and pick like pack art.
// Table state, DM-only on the wire, saved with the session.

import { randomUUID } from "crypto";
import {
  CUSTOM_TOKEN_LIMITS,
  type CustomToken,
  type NpcDisposition,
  type TokenSize,
} from "@herobyte/shared";
import type { RoomState } from "../room/model.js";

export interface CustomTokenInput {
  name: string;
  imageUrl: string;
  thumbUrl?: string;
  disposition?: NpcDisposition;
  description?: string;
  tags?: readonly string[];
  size?: TokenSize;
}

/**
 * One spelling per tag: trimmed, lower-cased, deduplicated, capped — so
 * "Monster" and "monster" search as one word, the way the pack's tags do.
 */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    if (seen.size >= CUSTOM_TOKEN_LIMITS.TAGS_MAX) break;
    const tag = raw.trim().toLowerCase().slice(0, CUSTOM_TOKEN_LIMITS.TAG_MAX);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export class CustomTokenService {
  /** Null when the table is at its cap; the caller decides what to say. */
  add(state: RoomState, input: CustomTokenInput, addedBy: string): CustomToken | null {
    if (state.customTokens.length >= CUSTOM_TOKEN_LIMITS.COUNT_MAX) return null;
    const description = input.description?.trim();
    const thumbUrl = input.thumbUrl?.trim();
    const token: CustomToken = {
      id: randomUUID(),
      name: input.name.trim(),
      imageUrl: input.imageUrl.trim(),
      // Only when there is one: absent is the shipped shape, and a bare
      // `thumbUrl: undefined` is still a key in the saved session file.
      ...(thumbUrl ? { thumbUrl } : {}),
      // Absent means hostile, so only a real stance is stored.
      ...(input.disposition ? { disposition: input.disposition } : {}),
      ...(description ? { description } : {}),
      tags: normalizeTags(input.tags),
      size: input.size ?? "medium",
      addedBy,
      addedAt: Date.now(),
    };
    state.customTokens.push(token);
    return token;
  }

  remove(state: RoomState, id: string): boolean {
    const index = state.customTokens.findIndex((token) => token.id === id);
    if (index < 0) return false;
    state.customTokens.splice(index, 1);
    return true;
  }
}
