// ============================================================================
// SCENE SUSPEND/RESUME — the pure half of travel
// ============================================================================
// Capture everything one map's table looked like; restore it exactly when the
// binding returns. The §4.10 five-bucket contract governs every RoomState
// field: captured (tokens-that-stay, props, drawings, sceneObjects residue,
// door runtime, combat, initiatives, fog pair, staging, mapBackground),
// cleared on every restore (pointers, selection, drawing undo/redo), global
// (the roster and table settings), derived (compiled outputs — the caller's
// job), infrastructure (users, stateVersion, the binding itself).
//
// Everything here is PURE and SYNCHRONOUS over RoomState — the travel
// mutation must be one synchronous block or a half-traveled frame (or a
// racing fork) can observe two scenes at once.

import {
  authoredDoorStatesOf,
  type CompiledScene,
  type MapDocument,
  type SceneState,
  type Token,
} from "@herobyte/shared";
import { createSelectionMap, type RoomState } from "../model.js";

/**
 * A token TRAVELS (follows the party to the destination) iff:
 *   1. it is the linked token of a `type: "pc"` character, or
 *   2. it has no linked character and its owner is a non-DM player.
 * NPC-linked tokens are scene-local UNCONDITIONALLY — classifying by the
 * owner's isDM first was the review's C3 finding: EXIT DM MODE would have
 * turned every goblin into a traveler, because NPC tokens carry the placing
 * DM's uid and isDM is dynamic.
 */
export function isTravelingToken(token: Token, state: RoomState): boolean {
  const linked = state.characters.find((character) => character.tokenId === token.id);
  if (linked) {
    return linked.type === "pc";
  }
  const owner = state.players.find((player) => player.uid === token.owner);
  return Boolean(owner && !owner.isDM);
}

export interface CaptureResult {
  saved: SceneState;
  travelers: Token[];
}

/**
 * Capture the CURRENT scene, keyed by the outgoing document (the scene
 * actually on the table — never the binding, which can be cleared or point
 * elsewhere). The outgoing document is required because door runtime restores
 * only where the authored state is unchanged, and "authored at capture" comes
 * from the document, not the compiled scene.
 */
export function captureSceneState(
  state: RoomState,
  outgoingDocument: MapDocument,
  now: number,
): CaptureResult {
  const travelers = state.tokens.filter((token) => isTravelingToken(token, state));
  const travelerSceneIds = new Set(travelers.map((token) => `token:${token.id}`));
  const stayers = state.tokens.filter((token) => !isTravelingToken(token, state));

  const characterLinks: Record<string, string> = {};
  for (const token of stayers) {
    const linked = state.characters.find((character) => character.tokenId === token.id);
    if (linked) characterLinks[token.id] = linked.id;
  }

  const authored = authoredDoorStatesOf(outgoingDocument);
  const doorStates: SceneState["doorStates"] = {};
  for (const door of state.compiledScene?.doors ?? []) {
    const authoredState = authored.get(door.id);
    if (authoredState !== undefined) {
      doorStates[door.id] = { state: door.state, authored: authoredState };
    }
  }

  const initiatives: SceneState["initiatives"] = {};
  for (const character of state.characters) {
    if (character.initiative !== undefined) {
      initiatives[character.id] = {
        initiative: character.initiative,
        ...(character.initiativeModifier !== undefined
          ? { initiativeModifier: character.initiativeModifier }
          : {}),
      };
    }
  }

  const saved: SceneState = structuredClone({
    mapDocumentId: outgoingDocument.id,
    suspendedAt: now,
    tokens: stayers,
    props: state.props,
    drawings: state.drawings,
    // The graph residue the per-broadcast rebuild FOLDS rather than derives:
    // the "map" object's transform (an input to server-side fog geometry),
    // gizmo scale/rotation, locks, z-order. Travelers' entries ride with the
    // party instead (restoreCollections carries them across).
    sceneObjects: state.sceneObjects.filter((object) => !travelerSceneIds.has(object.id)),
    characterLinks,
    doorStates,
    combatActive: state.combatActive,
    currentTurnCharacterId: state.currentTurnCharacterId,
    initiatives,
    fogEnabled: state.fogEnabled,
    defaultVisionRadius: state.defaultVisionRadius,
    playerStagingZone: state.playerStagingZone,
    mapBackground: state.mapBackground,
  });

  return { saved, travelers };
}

/**
 * Overlay a suspended scene's door RUNTIME states onto a fresh compile —
 * only where the door still exists AND its authored state matches what it
 * was at capture (the preserveDoorRuntimeStates rule: a re-authored door's
 * new authored state wins).
 */
export function overlaySavedDoorStates(
  compiled: CompiledScene,
  saved: SceneState,
  document: MapDocument,
): CompiledScene {
  const authoredNow = authoredDoorStatesOf(document);
  return {
    ...compiled,
    doors: compiled.doors.map((door) => {
      const savedDoor = saved.doorStates[door.id];
      if (savedDoor && authoredNow.get(door.id) === savedDoor.authored) {
        return { ...door, state: savedDoor.state };
      }
      return door;
    }),
  };
}

export interface RestoreOptions {
  /** Applied only on a FIRST VISIT (no saved scene). */
  firstVisitFogEnabled: boolean;
}

/**
 * Install the destination's collections (saved, or first-visit defaults),
 * carry the travelers in, reconcile against the global roster, and apply the
 * clear list. Runs AFTER the caller has compiled the destination — this
 * function never compiles.
 */
export function restoreCollections(
  state: RoomState,
  saved: SceneState | undefined,
  travelers: Token[],
  options: RestoreOptions,
): void {
  const travelerSceneIds = new Set(travelers.map((token) => `token:${token.id}`));
  const travelerEntries = state.sceneObjects.filter((object) => travelerSceneIds.has(object.id));

  if (saved) {
    // RESTORE-GC (review S4): the roster is global and its lifecycle ops only
    // see LIVE tokens. Drop a captured token whose linked character is gone,
    // or now links a DIFFERENT token (place-npc-token deletes-and-recreates
    // while the old token sleeps here — without this, the same NPC wakes up
    // with two bodies).
    const restoredTokens = saved.tokens.filter((token) => {
      const linkedCharacterId = saved.characterLinks[token.id];
      if (!linkedCharacterId) return true;
      const character = state.characters.find((entry) => entry.id === linkedCharacterId);
      return Boolean(character && character.tokenId === token.id);
    });
    state.tokens = [...restoredTokens, ...travelers];
    state.props = saved.props;
    state.drawings = saved.drawings;
    state.sceneObjects = [...saved.sceneObjects, ...travelerEntries];
    state.combatActive = saved.combatActive;
    state.fogEnabled = saved.fogEnabled;
    state.defaultVisionRadius = saved.defaultVisionRadius;
    state.playerStagingZone = saved.playerStagingZone;
    state.mapBackground = saved.mapBackground;

    // Initiative: the captured values overlay characters that still exist;
    // every OTHER character's initiative clears, so the resumed order is
    // exactly this scene's (a fight fought elsewhere while this scene slept
    // legitimately rewrote the roster's values). Modifiers are character-sheet
    // data, NOT scene data — never cleared, only restored where captured.
    for (const character of state.characters) {
      const capturedInitiative = saved.initiatives[character.id];
      if (capturedInitiative) {
        character.initiative = capturedInitiative.initiative;
        if (capturedInitiative.initiativeModifier !== undefined) {
          character.initiativeModifier = capturedInitiative.initiativeModifier;
        }
      } else {
        character.initiative = undefined;
      }
    }
    // The active combatant must still resolve to a character IN the order,
    // or next-turn's findIndex(-1)+1 lands on whoever sorts first.
    const turnCharacter = state.characters.find(
      (entry) => entry.id === saved.currentTurnCharacterId,
    );
    state.currentTurnCharacterId =
      turnCharacter && turnCharacter.initiative !== undefined
        ? saved.currentTurnCharacterId
        : undefined;
  } else {
    // FIRST VISIT: an empty room, the party walking in.
    state.tokens = [...travelers];
    state.props = [];
    state.drawings = [];
    state.sceneObjects = [...travelerEntries];
    state.combatActive = false;
    state.currentTurnCharacterId = undefined;
    state.fogEnabled = options.firstVisitFogEnabled;
    state.playerStagingZone = undefined;
    state.mapBackground = undefined;
    // defaultVisionRadius inherits — a table dial until a scene captures it.
  }

  // The clear list runs on EVERY restore: pointers are ephemeral, selections
  // reference dead ids, and undo must never replay across scenes.
  state.pointers = [];
  state.selectionState = createSelectionMap();
  state.drawingUndoStacks = {};
  state.drawingRedoStacks = {};
}

/**
 * TRAVEL ONLY: warp the party to the destination's staging zone (CELL-space
 * rect whose x/y is its CENTER — the getSpawnPosition math, rng injectable),
 * else spread them at the document's center cell. A destination smaller than
 * the party spreads into the off-map void, which renders fine (accepted).
 */
export function placeArrivals(
  state: RoomState,
  travelers: Token[],
  document: MapDocument,
  rng: () => number = Math.random,
): void {
  const zone = state.playerStagingZone;
  for (const [index, traveler] of travelers.entries()) {
    const live = state.tokens.find((token) => token.id === traveler.id);
    if (!live) continue;
    if (zone) {
      const angle = ((zone.rotation ?? 0) * Math.PI) / 180;
      const randomX = rng() * zone.width - zone.width / 2;
      const randomY = rng() * zone.height - zone.height / 2;
      live.x = zone.x + (randomX * Math.cos(angle) - randomY * Math.sin(angle));
      live.y = zone.y + (randomX * Math.sin(angle) + randomY * Math.cos(angle));
    } else {
      const { size, offsetX, offsetY } = document.grid;
      const centerX = Math.floor((document.width / 2 - offsetX) / size);
      const centerY = Math.floor((document.height / 2 - offsetY) / size);
      live.x = centerX + (index % 3) - 1;
      live.y = centerY + Math.floor(index / 3) - 1;
    }
  }
}
