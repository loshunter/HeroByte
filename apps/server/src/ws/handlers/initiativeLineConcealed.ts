/**
 * initiativeLineConcealed
 *
 * Whether a character's initiative line — rolled by the server, or entered by
 * hand — must go to the DM's log only. The ONE spelling of it, for both paths.
 *
 * A roll-log line is written once, for every player at once, and
 * `visibleRollsFor` filters it on its own visibility alone. So it must be
 * concealed whenever the recipient filter (`buildRecipientView`) COULD strip
 * the character's record from some player:
 *  - an NPC hidden with the 👁 eye (`visibleToPlayers === false`) — stripped
 *    for every player;
 *  - while fog is on over a built map (the filter's own condition,
 *    `createVisionContext`), an NPC with a token — stripped for any player who
 *    cannot see that token. Which players can see it changes as tokens move,
 *    and the line cannot follow, so it goes to the DM whenever the fog could
 *    hide it. A creature the whole table can see loses its public line under
 *    fog: the price of never naming one a player cannot see.
 *
 * @module ws/handlers/initiativeLineConcealed
 */

import type { Character } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";

export function initiativeLineConcealed(
  state: Pick<RoomState, "fogEnabled" | "compiledScene">,
  character: Pick<Character, "type" | "tokenId" | "visibleToPlayers">,
): boolean {
  if (character.visibleToPlayers === false) return true;
  return (
    character.type === "npc" &&
    Boolean(character.tokenId) &&
    state.fogEnabled === true &&
    state.compiledScene !== undefined
  );
}
