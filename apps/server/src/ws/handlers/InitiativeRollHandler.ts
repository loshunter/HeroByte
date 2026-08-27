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
   * `requestedModifier` is the character's own stat, not a result. It arrives
   * when the sender changed the dial in the same gesture as the roll; supplying
   * it PERSISTS the new value (via applyInitiative, the one writer) and then
   * rolls with it. Omitting it keeps the stored one. Without this parameter the
   * dial and the roll would disagree silently — you would drag to +5, roll, and
   * the server would apply the +2 it still had on file.
   *
   * @param state - Current room state
   * @param characterId - Who to roll for
   * @param senderUid - UID of the sender, taken from the connection
   * @param isDM - Whether sender is DM
   * @param requestedModifier - Modifier to persist and roll with; stored one if omitted
   * @param rng - Test seam only
   * @returns Result indicating if broadcast/save is needed
   */
  handleRollInitiative(
    state: RoomState,
    characterId: string,
    senderUid: string,
    isDM: boolean,
    requestedModifier?: number,
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

    const modifier = requestedModifier ?? character.initiativeModifier ?? 0;
    // A zero modifier contributes no term, so the log reads "d20" rather than
    // "d20 + 0" — the same formula a player typing /roll would have got.
    const terms: DiceTerm[] = [{ kind: "die", die: "d20", qty: 1, sign: 1 }];
    if (modifier !== 0) {
      terms.push({ kind: "mod", value: modifier });
    }

    // A HIDDEN creature's roll must not travel in this channel.
    //
    // `visibleRollsFor` filters on the ROLL's own visibility and never consults
    // state.characters, so a public roll routes straight around
    // buildRecipientView — which strips a `visibleToPlayers === false`
    // character, strips its token, and blanks `currentTurnCharacterId` rather
    // than prove that a combatant the recipient cannot see is acting now. A
    // named roll-log line hands over strictly more than the id that filter
    // withholds. Rolling initiative for a hidden ambush is the ordinary DM
    // workflow the guide advertises, so this is reached by pressing a button,
    // not by contriving anything.
    //
    // Fixed at roll time: visibleRollsFor has no re-evaluation hook, so
    // revealing the creature later does not retroactively surface the line.
    // That is the right way round — a spoiler cannot be un-shown.
    const concealed = character.visibleToPlayers === false;

    const roll = this.diceService.rollFor(
      state,
      {
        playerUid: senderUid,
        playerName: author.name,
        terms,
        mode: "normal",
        // Initiative is turn order, and a hidden one leaves the table unable to
        // check the sequence it is about to play — but only for creatures the
        // table can see. There is no sequence to check for a creature the
        // recipient filter is actively concealing.
        visibility: concealed ? "dm" : "public",
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

  /**
   * Handle roll-initiative-all message
   *
   * DM-only, and ONE message rather than one per NPC. The client used to run
   * this loop itself, sending a `set-initiative` per creature; the limiter
   * allows 100 messages per client per second and drops the rest SILENTLY, so
   * a big enough encounter left its tail without initiative while the toast
   * reported the full count. The loop belongs here, where nothing rate-limits
   * one iteration from the next.
   *
   * Each NPC goes through `handleRollInitiative` rather than a second copy of
   * the roll, so the labels, the public log lines and the combat auto-start
   * rules cannot drift from the single-character case. No modifier is passed:
   * a bulk roll is not a gesture on any one dial, so every NPC uses its own
   * stored value.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender, taken from the connection
   * @param isDM - Whether sender is DM
   * @param rng - Test seam only
   * @returns Result indicating if broadcast/save is needed
   */
  handleRollInitiativeAll(
    state: RoomState,
    senderUid: string,
    isDM: boolean,
    rng: DiceRng = cryptoDiceRng,
  ): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to roll initiative for every NPC`);
      return { broadcast: false, save: false };
    }

    // Snapshot the targets before rolling: handleRollInitiative writes into
    // state.characters as it goes, and filtering lazily over a collection being
    // mutated is how a loop like this starts skipping entries.
    const pending = state.characters.filter(
      (character) => character.type === "npc" && character.initiative === undefined,
    );

    let rolled = 0;
    for (const npc of pending) {
      const result = this.handleRollInitiative(state, npc.id, senderUid, isDM, undefined, rng);
      if (result.broadcast) {
        rolled += 1;
      }
    }

    if (rolled === 0) {
      // Nothing changed, so nothing to broadcast or persist. Not an error: a
      // DM pressing this twice is the ordinary way to reach it.
      return { broadcast: false, save: false };
    }

    console.log(`[Server] Rolled initiative for ${rolled} NPC(s) of ${pending.length} pending`);
    return { broadcast: true, save: true };
  }
}
