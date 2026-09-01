// ============================================================================
// THE ATLAS — the campaign as a navigable graph of linked maps
// ============================================================================
// Its own module, not barrel declarations: a runtime `export const` in
// packages/shared/src/index.ts erases to `export declare const` in the built
// d.ts, which is what the server's tsconfig path-maps to at runtime — the dev
// server then cannot boot while every gate stays green (HANDOFF-NEXT §7). The
// barrel RE-EXPORTS from here instead.
//
// Type-only imports from the barrel follow the models.ts/combatUtils.ts
// precedent: fully erased at compile time, so no runtime cycle exists.

import type { Drawing, PlayerStagingZone, Prop, SceneObject, Token } from "./index.js";
import type { CompiledDoorState } from "./sceneCompiler.js";
import type { MapDoorState } from "./mapStudioTypes.js";

export type AtlasNodeKind =
  | "world"
  | "region"
  | "settlement"
  | "building"
  | "dungeon"
  | "wilderness";

/**
 * One node of the campaign graph. A node with no `mapDocumentId` is a PROMISE —
 * ~100 bytes of metadata the engine can cash into a real map on demand.
 *
 * PRIVACY: players receive a whitelist PROJECTION of this shape (id, kind,
 * name, parentId when the parent is discovered, discovered) built in
 * atlasProjection.ts — `recipe`, `mapDocumentId`, and the timestamps never
 * exist on a player's wire. Undiscovered nodes are absent entirely.
 */
export interface AtlasNode {
  id: string;
  kind: AtlasNodeKind;
  name: string;
  /** Absent = a root of the campaign tree. */
  parentId?: string;
  /** Absent = an ungenerated promise. 1:1 with nodes — enforced at link/generate. */
  mapDocumentId?: string;
  discovered: boolean;
  /**
   * Provenance, recorded when a promise is cashed by a recipe. DM-only on the
   * wire: a seed plus a reimplemented recipe is a floor-plan oracle.
   */
  recipe?: {
    recipeId: "dungeon";
    seed: number;
    theme: "stone" | "wood";
    density: "low" | "medium" | "high";
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * The wire shape of a node: a DM's is the full record, a player's is the
 * whitelist projection built in the server's atlasProjection.ts (id, kind,
 * name, discovered, plus parentId only when the parent is discovered).
 */
export type AtlasNodeSnapshot = Pick<AtlasNode, "id" | "kind" | "name" | "discovered"> &
  Partial<Pick<AtlasNode, "parentId" | "mapDocumentId" | "recipe" | "createdAt" | "updatedAt">>;

/**
 * A travel affordance drawn ON a map: a door/stair/signpost sprite at `anchor`
 * (DOCUMENT px on the from-node's map) leading to another node.
 *
 * PRIVACY: players receive links only when `visibleToPlayers` and the from-node
 * is discovered, with `toNodeId` blanked unless the target is discovered — the
 * sprite renders without knowing where it leads.
 */
export interface MapLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  anchor: { x: number; y: number };
  linkType: "door" | "stair" | "signpost";
  visibleToPlayers: boolean;
}

/**
 * The wire shape of a link: a DM's is the full record; a player's projection
 * blanks `toNodeId` when the target is undiscovered and drops the tautological
 * `visibleToPlayers` byte.
 */
export type MapLinkSnapshot = Pick<MapLink, "id" | "fromNodeId" | "anchor" | "linkType"> &
  Partial<Pick<MapLink, "toNodeId" | "visibleToPlayers">>;

/**
 * A suspended scene — everything the table looked like on one map, captured
 * when the live binding moved off it and restored when it returns. Keyed by
 * mapDocumentId (the scene actually on the table), never by node or binding.
 *
 * NEVER serialized to any recipient, DM included — it exists on the wire
 * nowhere. It persists in the server state file and rides SessionFile's
 * ENVELOPE (not the snapshot) on export.
 */
export interface SceneState {
  mapDocumentId: string;
  suspendedAt: number;
  /** Stayers only — traveling tokens (the party) never suspend. */
  tokens: Token[];
  props: Prop[];
  drawings: Drawing[];
  /**
   * The scene-graph residue the per-broadcast rebuild folds forward rather
   * than derives: the "map" object's transform (an INPUT to server-side fog
   * geometry), per-object gizmo scale/rotation, locked flags, z-order.
   */
  sceneObjects: SceneObject[];
  /** tokenId -> characterId at capture time, for restore-time reconciliation. */
  characterLinks: Record<string, string>;
  /**
   * Door runtime state, with the authored state it was captured against —
   * restore applies the runtime only where the door still exists AND its
   * authored state is unchanged (the preserveDoorRuntimeStates rule).
   */
  doorStates: Record<string, { state: CompiledDoorState; authored: MapDoorState }>;
  combatActive: boolean;
  currentTurnCharacterId?: string;
  /**
   * Per-character initiative held at capture. The roster is room-global and a
   * second fight legitimately clears it; without this, "resumes exactly as you
   * left it" is false for the one collection the mission names.
   */
  initiatives: Record<string, { initiative: number; initiativeModifier?: number }>;
  fogEnabled: boolean;
  /** Fog's companion dial — the same scene-local argument as fogEnabled. */
  defaultVisionRadius: number | null;
  playerStagingZone?: PlayerStagingZone;
  mapBackground?: string;
}

/**
 * Handler-enforced creation ceilings, and the load-session wire caps for the
 * graph collections (SNAPSHOT_LIMITS mirrors these numbers).
 *
 * The EXPORT promise (a campaign must fit a session file) is protected by the
 * document-count mint cap against MAX_SESSION_DOCUMENTS, not by `nodes` —
 * nodes and documents are deliberately decoupled (promises mint nothing,
 * unlinked drafts exist by design).
 */
export const ATLAS_LIMITS = {
  nodes: 64,
  links: 256,
} as const;
