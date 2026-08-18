/**
 * InitiativeRollHandler
 *
 * The rolled initiative path: the server throws the die, and the result lands
 * in the roll log where the table can see it.
 *
 * Split from InitiativeMessageHandler rather than added to it — that file sits
 * against the 350-LOC guard, and rolling needs two services (dice, players)
 * that the rest of it does not. `set-initiative` stays there as the MANUAL
 * path; the two share `applyInitiative` so the auto-start rules cannot drift.
 *
 * @module ws/handlers/InitiativeRollHandler
 */

import type { DiceTerm } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { DiceService } from "../../domains/dice/service.js";
import type { PlayerService } from "../../domains/player/service.js";
import { cryptoDiceRng, type DiceRng } from "../../domains/dice/roller.js";
import { applyInitiative } from "./applyInitiative.js";
import type { InitiativeMessageResult } from "./InitiativeMessageHandler.js";

export class InitiativeRollHandler {
  constructor(
    private characterService: CharacterService,
    private diceService: DiceService,
    private playerService: PlayerService,
  ) {}

  /**
   * Handle roll-initiative message
   *
   * The server rolls the die. The message carried a target and nothing else, so
   * unlike `set-initiative` there is no number here that came off the wire.
   *
   * The roll goes through `DiceService.rollFor` rather than calling the RNG
   * directly, which buys three things at once: `cryptoDiceRng` stays the one
   * generator, the roll lands in `state.diceRolls` where the table can see it,
   * and the breakdown renders in the log exactly like any other d20.
   *
   * `rng` is injectable for the same reason `rollFor`'s is — a golden seed pins
   * the sequence, so "the server rolled this" is provable rather than asserted.
   * Production takes the crypto default.
   *
   * @param state - Current room state
   * @param characterId - Who to roll for
   * @param senderUid - UID of the sender, taken from the connection
   * @param isDM - Whether sender is DM
   * @param rng - Test seam only
   * @returns Result indicating if broadcast/save is needed
   */
  handleRollInitiative(
    state: RoomState,
    characterId: string,
    senderUid: string,
    isDM: boolean,
    rng: DiceRng = cryptoDiceRng,
  ): InitiativeMessageResult {
    const character = this.characterService.findCharacter(state, characterId);
    if (!character) {
      console.warn(`Character ${characterId} not found`);
      return { broadcast: false, save: false };
    }

    const canModify = isDM || this.characterService.canControlCharacter(character, senderUid);
    if (!canModify) {
      console.warn(
        `Player ${senderUid} attempted to roll initiative for a character they don't own`,
      );
      return { broadcast: false, save: false };
    }

    const author = this.playerService.findPlayer(state, senderUid);
    if (!author) {
      // Authenticated but with no player record. DiceMessageHandler drops rolls
      // in this state rather than inventing an identity; the same applies here.
      console.warn(`[Initiative] Dropping roll from ${senderUid}: no player record`);
      return { broadcast: false, save: false };
    }

    const modifier = character.initiativeModifier ?? 0;
    // A zero modifier contributes no term, so the log reads "d20" rather than
    // "d20 + 0" — the same formula a player typing /roll would have got.
    const terms: DiceTerm[] = [{ kind: "die", die: "d20", qty: 1, sign: 1 }];
    if (modifier !== 0) {
      terms.push({ kind: "mod", value: modifier });
    }

    const roll = this.diceService.rollFor(
      state,
      {
        playerUid: senderUid,
        playerName: author.name,
        terms,
        mode: "normal",
        // Initiative is turn order: a hidden one would leave the table unable
        // to check the sequence it is about to play.
        visibility: "public",
        label: `${character.name} — initiative`,
      },
      rng,
    );

    if (!applyInitiative(this.characterService, state, characterId, roll.total, modifier)) {
      return { broadcast: false, save: false };
    }

    console.log(
      `[Server] Rolled initiative for ${character.name} (${characterId}): ${roll.total} (${roll.formula})`,
    );
    return { broadcast: true, save: true };
  }
}
