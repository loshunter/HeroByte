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
  ChatMessage,
  DiceRoll,
  Pointer,
  Prop,
  SceneObject,
  SelectionState,
  SnapshotCharacter,
  Token,
} from "@herobyte/shared";
import { coerceDiceVisibility, gridCellToWorldPoint, hpBadgeFor } from "@herobyte/shared";
import type { RoomState } from "../model.js";
import { selectionMapToRecord } from "../selectionSerialization.js";
import { createVisionContext, isWorldPointVisible } from "../scene/visionFilter.js";
import { projectAtlasFor, type AtlasView } from "./atlasProjection.js";

/** The per-recipient view of every position-sensitive collection. */
export interface RecipientView extends AtlasView {
  tokens: Token[];
  characters: SnapshotCharacter[];
  props: Prop[];
  pointers: Pointer[];
  sceneObjects: SceneObject[];
  selectionState: SelectionState;
  /** Active combatant, but only when this recipient can actually resolve them. */
  currentTurnCharacterId: string | undefined;
  /** Chat with other people's whispers removed. */
  chatLog: ChatMessage[];
  /** Roll history with other people's private rolls removed. */
  diceRolls: DiceRoll[];
}

/**
 * Whispers this recipient is a party to, plus every public message.
 *
 * FAILS CLOSED. `recipientUid` is legitimately undefined on real paths —
 * `toSnapshot` defaults `isDM` to true, `createSnapshot()` passes no uid at
 * all, and that unfiltered snapshot is what seeds a table fork and a session
 * export. So "no identified recipient" must mean "no whispers", never "all
 * whispers". The fog code deliberately does the opposite (an undefined uid
 * disables filtering); copying that default here would leak every private
 * message into forks, exports, and any future caller that forgets an
 * argument.
 *
 * Note this ignores `isDM` on purpose. A DM is a player at the table, not an
 * auditor of everyone's private conversations; granting blanket read would
 * be a surveillance decision, and it is not this slice's to make.
 *
 * WHAT THIS DOES NOT PROTECT AGAINST. The filter is only as strong as the
 * recipient identity it keys on, and `uid` is CLIENT-SUPPLIED — read straight
 * off the connection query string, bound to no secret (see
 * ConnectionLifecycleManager, and the note in AuthenticationHandler). Anyone
 * already holding the table password can therefore reconnect as another
 * player's uid and receive their whispers; the uid list is published to every
 * player in the snapshot, so guessing is not required either.
 *
 * That is the known, accepted limitation of the current identity model —
 * signed session tokens are explicitly deferred to a later arc
 * (docs/planning/session-one-arc.md §7). So: whispers are private FROM the
 * other people at your table, not from an attacker willing to impersonate
 * one. Do not describe them to users as secure against a table member.
 */
export function visibleChatFor(chatLog: ChatMessage[], recipientUid?: string): ChatMessage[] {
  // Defence in depth, not paranoia: this runs inside the DEBOUNCED broadcast
  // timer, outside route()'s try/catch, and the process has no
  // uncaughtException handler — so a non-array here kills the one process
  // serving every room, and a persisted one does it again on every restart.
  // The load-session validator is the primary guard; this disarms a state
  // file already poisoned before that guard existed.
  if (!Array.isArray(chatLog)) return [];
  return chatLog.filter((message) => {
    if (!message.to) return true; // public
    if (!recipientUid) return false; // fail closed
    return message.to === recipientUid || message.authorUid === recipientUid;
  });
}

/**
 * Rolls this recipient is entitled to, whole records — a hidden roll is absent
 * from the payload, not blanked in it. The numbers ARE the secret, so there is
 * nothing to redact down to.
 *
 * FAILS CLOSED, for the same reasons as visibleChatFor above and then one
 * more: `createSnapshot()` (no uid, isDM defaulting to true) is what seeds a
 * table fork, so "no identified recipient" must mean "public rolls only" or a
 * fork would carry the previous table's secret rolls into a new one.
 *
 * `dm` visibility is the one place a DM IS privileged, and deliberately so:
 * "roll it to the DM" is a request addressed to them, the way a whisper is
 * addressed to a player. `self` grants nothing to anyone — a DM is a player at
 * the table, not an auditor of everyone's private dice, which is the same call
 * visibleChatFor makes for whispers.
 *
 * Unknown visibility strings collapse to `self` (coerceDiceVisibility), so a
 * corrupt or forward-dated state file cannot turn a secret roll into a
 * broadcast one.
 *
 * Same identity bound as whispers: `uid` is CLIENT-SUPPLIED, so a private roll
 * is private FROM the other people at your table, not from someone willing to
 * reconnect under another player's uid. Do not describe it to users as secure
 * against a table member.
 */
export function visibleRollsFor(
  diceRolls: DiceRoll[],
  isDM: boolean,
  recipientUid?: string,
): DiceRoll[] {
  // Defence in depth, exactly as visibleChatFor: this runs inside the
  // DEBOUNCED broadcast timer, outside route()'s try/catch, in a process with
  // no uncaughtException handler. A persisted non-array would otherwise kill
  // the process serving every room, on every restart.
  if (!Array.isArray(diceRolls)) return [];
  return diceRolls.filter((roll) => {
    const visibility = coerceDiceVisibility(roll.visibility);
    if (visibility === "public") return true;
    if (!recipientUid) return false; // fail closed
    if (roll.playerUid === recipientUid) return true;
    return visibility === "dm" && isDM;
  });
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

  // Monster HP display (S4): in "bloodied"/"hidden" mode an NPC's numbers are
  // REDACTED from the wire — a player socket never receives them, so devtools
  // and sniffing show nothing (same principle as fog and whispers). Bloodied
  // mode substitutes a coarse badge computed with the SHARED hpBadgeFor, the
  // same function the client's player lens uses, so the two views can never
  // disagree. PCs always keep exact numbers: party health is the party's own
  // information. Shallow CLONES on the redacted records only — every object in
  // this view aliases live RoomState, and mutating one would corrupt the
  // authoritative state and persist it on the next save.
  const hpMode = state.monsterHpDisplay ?? "exact";
  const hpRedactedCharacters: SnapshotCharacter[] =
    isDM || hpMode === "exact"
      ? fogFilteredCharacters
      : fogFilteredCharacters.map((character) => {
          if (character.type !== "npc") return character;
          const redacted: SnapshotCharacter = {
            ...character,
            hp: undefined,
            maxHp: undefined,
            tempHp: undefined,
          };
          if (hpMode === "bloodied") {
            redacted.hpBadge = hpBadgeFor(character.hp, character.maxHp);
          }
          return redacted;
        });

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
    characters: hpRedactedCharacters,
    props: visibleProps,
    pointers: visiblePointers,
    sceneObjects: visibleSceneObjects,
    selectionState: visibleSelection,
    currentTurnCharacterId: visibleTurnCharacterId,
    chatLog: visibleChatFor(state.chatLog, recipientUid),
    diceRolls: visibleRollsFor(state.diceRolls, isDM, recipientUid),
    // The campaign graph — discovered-only whitelist for players (its own
    // module: this file has no LOC headroom, and the rules deserve a name).
    ...projectAtlasFor(state, isDM),
  };
}
