/**
 * DiceDispatcher — routing, not behaviour.
 *
 * This file exists for the failure the initiative slice already paid for once:
 * the wire declared `roll-initiative-all` and validated it, but no dispatcher
 * case handled it. An unhandled message does not error — messageRouter falls
 * past every dispatcher, logs an unknown type, and then ACKNOWLEDGES IT AS A
 * SUCCESS. So a missing `case` is invisible from the client and invisible to
 * the handler unit tests, which call handlers directly.
 *
 * `enter-roll` is exactly as exposed: a player types what they threw, the
 * client shows no error, and the number never reaches the table.
 *
 * @module ws/dispatchers/__tests__/DiceDispatcher.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { DiceDispatcher } from "../DiceDispatcher.js";
import type { DiceMessageHandler } from "../../handlers/DiceMessageHandler.js";
import type { RoutingContext } from "../../services/MessageRoutingContext.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";

describe("DiceDispatcher", () => {
  let dispatcher: DiceDispatcher;
  let handler: DiceMessageHandler;
  let state: RoomState;
  let context: RoutingContext;
  let isDM: boolean;

  const routed = { broadcast: true, save: true };

  beforeEach(() => {
    state = createEmptyRoomState();
    isDM = false;

    handler = {
      handleDiceRoll: vi.fn(() => routed),
      handleEnterRoll: vi.fn(() => routed),
      handleClearRollHistory: vi.fn(() => routed),
    } as unknown as DiceMessageHandler;

    context = {
      getState: () => state,
      isDM: () => isDM,
    } as unknown as RoutingContext;

    dispatcher = new DiceDispatcher(handler);
  });

  it("routes enter-roll, which nothing else would reveal was unrouted", () => {
    const message = { t: "enter-roll", total: 17 } as ClientMessage;

    const result = dispatcher.dispatch(message, context, "player-1");

    expect(handler.handleEnterRoll).toHaveBeenCalledTimes(1);
    expect(result).toBe(routed);
  });

  it("hands the handler every field the rewrite path needs", () => {
    // rollId is what turns a fresh entry into a rewrite, and visibility is what
    // keeps a private entry private. A dispatcher that dropped either would
    // route successfully and do the wrong thing.
    const message = {
      t: "enter-roll",
      rollId: "roll-9",
      total: 11,
      formula: "2d6 + 3",
      visibility: "dm",
    } as ClientMessage;

    dispatcher.dispatch(message, context, "player-1");

    expect(handler.handleEnterRoll).toHaveBeenCalledWith(
      state,
      "player-1",
      false,
      11,
      "roll-9",
      "2d6 + 3",
      "dm",
    );
  });

  it("passes the sender's DM status through, since it decides whose roll may be rewritten", () => {
    isDM = true;

    dispatcher.dispatch({ t: "enter-roll", total: 4 } as ClientMessage, context, "dm-uid");

    expect(handler.handleEnterRoll).toHaveBeenCalledWith(
      state,
      "dm-uid",
      true,
      4,
      undefined,
      undefined,
      undefined,
    );
  });

  it("takes the author from the CONNECTION, not from the payload", () => {
    // The one guarantee entering a roll does not relax: a client may assert a
    // number, never a name. A dispatcher reading a uid off the message would
    // hand that back.
    const forged = { t: "enter-roll", total: 20, playerUid: "someone-else" } as ClientMessage;

    dispatcher.dispatch(forged, context, "player-1");

    expect(handler.handleEnterRoll).toHaveBeenCalledWith(
      state,
      "player-1",
      false,
      20,
      undefined,
      undefined,
      undefined,
    );
  });

  it("still routes an ordinary roll and a history clear", () => {
    dispatcher.dispatch({ t: "dice-roll", formula: "d20" } as ClientMessage, context, "player-1");
    dispatcher.dispatch({ t: "clear-roll-history" } as ClientMessage, context, "dm-uid");

    expect(handler.handleDiceRoll).toHaveBeenCalledTimes(1);
    expect(handler.handleClearRollHistory).toHaveBeenCalledTimes(1);
  });

  it("returns null for a message that is not its own", () => {
    const result = dispatcher.dispatch({ t: "next-turn" } as ClientMessage, context, "dm-uid");

    expect(result).toBeNull();
    expect(handler.handleEnterRoll).not.toHaveBeenCalled();
  });
});
