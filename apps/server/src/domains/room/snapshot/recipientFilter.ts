// ============================================================================
// RECIPIENT FILTER — what one recipient is allowed to see
// ============================================================================
// Extracted verbatim from model.ts's toSnapshot (2026-08-02) with no behavior
// change. It moved for two reasons:
//
//   1. model.ts was 3 lines under the 350-LOC guard, and the guard does not
//      protect a file already near it — the next field added to RoomState
//      would have tripped the build.
//   2. Every privacy decision in the product funnels through this code. It
//      deserves to be findable by name rather than buried mid-function.
//
// The whole contract: given the room state and ONE recipient, return the
// collections that recipient may receive. Nothing here writes to state.

import type {
  Character,
  Pointer,
  Prop,
  SceneObject,
  SelectionState,
  Token,
} from "@herobyte/shared";
import { gridCellToWorldPoint } from "@herobyte/shared";
import type { RoomState } from "../model.js";
import { selectionMapToRecord } from "../selectionSerialization.js";
import { createVisionContext, isWorldPointVisible } from "../scene/visionFilter.js";

/** The per-recipient view of every position-sensitive collection. */
export interface RecipientView {
  tokens: Token[];
  characters: Character[];
  props: Prop[];
  pointers: Pointer[];
  sceneObjects: SceneObject[];
  selectionState: SelectionState;
  /** Active combatant, but only when this recipient can actually resolve them. */
  currentTurnCharacterId: string | undefined;
}

/**
 * Build one recipient's view of the room.
 *
 * `isDM` short-circuits every filter — DMs see the unfiltered table. Fog
 * filtering additionally requires a `recipientUid`, since sightlines are
 * computed from that player's own tokens.
 */
export function buildRecipientView(
  state: RoomState,
  isDM: boolean,
  recipientUid?: string,
): RecipientView {
  // Filter characters based on visibility (DM sees all, players only see visible NPCs)
  const visibleCharacters = isDM
    ? state.characters
    : state.characters.filter((c) => c.visibleToPlayers !== false);

  // Collect IDs of hidden NPC tokens to filter from tokens and scene objects
  const hiddenCharacterTokenIds = isDM
    ? null
    : new Set(
        state.characters
          .filter((c) => c.visibleToPlayers === false && c.tokenId)
          .map((c) => c.tokenId as string),
      );

  // Filter tokens to exclude hidden NPC tokens
  const npcFilteredTokens = isDM
    ? state.tokens
    : state.tokens.filter((t) => !hiddenCharacterTokenIds?.has(t.id));

  // Fog of war: entities outside the recipient's sightlines never enter the
  // payload, so socket sniffing reveals nothing the fog hides. Own tokens are
  // always included.
  const vision = !isDM && recipientUid ? createVisionContext(state, recipientUid) : null;
  const visibleTokens = vision
    ? npcFilteredTokens.filter(
        (token) =>
          token.owner === recipientUid ||
          isWorldPointVisible(
            vision,
            gridCellToWorldPoint(state.gridSize, { x: token.x, y: token.y }),
          ),
      )
    : npcFilteredTokens;
  const visionTokenIds = vision ? new Set(visibleTokens.map((token) => token.id)) : null;

  // NPC character records must agree with the fog: a record whose token the
  // recipient cannot see is a spoiler (name, HP), so it never enters the
  // payload. Party members and tokenless NPCs always ride along — rosters
  // don't fog, and off-map NPCs stay governed by visibleToPlayers.
  const fogFilteredCharacters = visionTokenIds
    ? visibleCharacters.filter(
        (character) =>
          character.type !== "npc" || !character.tokenId || visionTokenIds.has(character.tokenId),
      )
    : visibleCharacters;

  // The active combatant must be someone the recipient can actually resolve.
  // Both filters above already strip a hidden or fogged NPC's record AND its
  // token — shipping its id anyway puts back exactly what they removed: proof
  // that a combatant the recipient cannot see is acting RIGHT NOW, plus a
  // stable id to correlate across rounds. The client would sound useTurnChime
  // for it too. Party members and tokenless NPCs always survive
  // fogFilteredCharacters, so a player's own turn can never strip.
  const visibleTurnCharacterId = fogFilteredCharacters.some(
    (character) => character.id === state.currentTurnCharacterId,
  )
    ? state.currentTurnCharacterId
    : undefined;

  // Pointers are world-pixel positions; fog hides pings inside unseen areas,
  // but a pinger always sees their own echo and DM pings are narration —
  // visible to the whole table.
  const dmUids = vision ? new Set(state.players.filter((p) => p.isDM).map((p) => p.uid)) : null;
  const visiblePointers = vision
    ? state.pointers.filter(
        (pointer) =>
          pointer.uid === recipientUid ||
          dmUids!.has(pointer.uid) ||
          isWorldPointVisible(vision, pointer),
      )
    : state.pointers;
  const visiblePointerIds = vision
    ? new Set(visiblePointers.map((pointer) => pointer.id ?? pointer.uid))
    : null;

  // Props are grid-cell positions; scenery inside fogged rooms stays unknown.
  const visibleProps = vision
    ? state.props.filter(
        (prop) =>
          prop.owner === recipientUid ||
          isWorldPointVisible(vision, gridCellToWorldPoint(state.gridSize, prop)),
      )
    : state.props;
  const visiblePropIds = vision ? new Set(visibleProps.map((prop) => prop.id)) : null;

  // The scene graph mirrors tokens, props, and pointers — it must agree with
  // the filtered entity lists or it becomes the leak.
  const visibleSceneObjects = state.sceneObjects.filter((object) => {
    if (isDM) {
      return true;
    }
    if (object.type === "token") {
      const tokenId = object.id.startsWith("token:") ? object.id.slice("token:".length) : null;
      if (!tokenId) return true;
      if (hiddenCharacterTokenIds?.has(tokenId)) return false;
      return visionTokenIds ? visionTokenIds.has(tokenId) : true;
    }
    if (object.type === "prop" && visiblePropIds) {
      const propId = object.id.startsWith("prop:") ? object.id.slice("prop:".length) : null;
      return !propId || visiblePropIds.has(propId);
    }
    if (object.type === "pointer" && visiblePointerIds) {
      const pointerId = object.id.startsWith("pointer:")
        ? object.id.slice("pointer:".length)
        : null;
      return !pointerId || visiblePointerIds.has(pointerId);
    }
    return true;
  });

  // Selection entries referencing objects the recipient cannot see would
  // reveal their existence and ids — strip them. References may be scene ids
  // ("token:abc") or raw entity ids, so admit both forms of every visible
  // entity. Drawings are never position-filtered.
  const selectionRecord = selectionMapToRecord(state.selectionState);
  let visibleSelection = selectionRecord;
  if (!isDM) {
    const visibleRefIds = new Set<string>();
    for (const object of visibleSceneObjects) visibleRefIds.add(object.id);
    for (const token of visibleTokens) {
      visibleRefIds.add(token.id);
      visibleRefIds.add(`token:${token.id}`);
    }
    for (const prop of visibleProps) {
      visibleRefIds.add(prop.id);
      visibleRefIds.add(`prop:${prop.id}`);
    }
    for (const drawing of state.drawings) {
      visibleRefIds.add(drawing.id);
      visibleRefIds.add(`drawing:${drawing.id}`);
    }
    visibleSelection = {};
    for (const [uid, entry] of Object.entries(selectionRecord)) {
      if (!entry) continue;
      if (entry.mode === "single") {
        if (visibleRefIds.has(entry.objectId)) visibleSelection[uid] = entry;
      } else {
        const objectIds = entry.objectIds.filter((id) => visibleRefIds.has(id));
        if (objectIds.length > 0) visibleSelection[uid] = { mode: "multiple", objectIds };
      }
    }
  }

  return {
    tokens: visibleTokens,
    characters: fogFilteredCharacters,
    props: visibleProps,
    pointers: visiblePointers,
    sceneObjects: visibleSceneObjects,
    selectionState: visibleSelection,
    currentTurnCharacterId: visibleTurnCharacterId,
  };
}
