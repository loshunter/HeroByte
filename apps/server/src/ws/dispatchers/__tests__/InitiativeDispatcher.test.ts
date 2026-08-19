/**
 * InitiativeDispatcher
 *
 * These exist because of a specific failure this slice ran into: the wire
 * declared `roll-initiative-all` and validated it, but no dispatcher case
 * handled it. An unhandled message does not error — messageRouter falls past
 * every dispatcher, logs an unknown type, and then ACKNOWLEDGES THE MESSAGE AS
 * A SUCCESS. So a misspelled or missing `case` is invisible from the client and
 * invisible to the handler unit tests, which call the handlers directly.
 *
 * The routing itself is what is asserted here; the handlers' behaviour lives in
 * ../../handlers/__tests__/InitiativeRollHandler.test.ts.
 *
 * @module ws/dispatchers/__tests__/InitiativeDispatcher.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { InitiativeDispatcher } from "../InitiativeDispatcher.js";
import type { InitiativeMessageHandler } from "../../handlers/InitiativeMessageHandler.js";
import type { InitiativeRollHandler } from "../../handlers/InitiativeRollHandler.js";
import type { RoutingContext } from "../../services/MessageRoutingContext.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";

describe("InitiativeDispatcher", () => {
  let dispatcher: InitiativeDispatcher;
  let handler: InitiativeMessageHandler;
  let rollHandler: InitiativeRollHandler;
  let state: RoomState;
  let context: RoutingContext;
  let isDM: boolean;

  const routed = { broadcast: true, save: true };

  beforeEach(() => {
    state = createEmptyRoomState();
    isDM = true;

    handler = {
      handleSetInitiative: vi.fn(() => routed),
      handleStartCombat: vi.fn(() => routed),
      handleEndCombat: vi.fn(() => routed),
      handleNextTurn: vi.fn(() => routed),
      handlePreviousTurn: vi.fn(() => routed),
      handleClearAllInitiative: vi.fn(() => routed),
    } as unknown as InitiativeMessageHandler;

    rollHandler = {
      handleRollInitiative: vi.fn(() => routed),
      handleRollInitiativeAll: vi.fn(() => routed),
    } as unknown as InitiativeRollHandler;

    context = {
      getState: () => state,
      isDM: () => isDM,
    } as unknown as RoutingContext;

    dispatcher = new InitiativeDispatcher(handler, rollHandler);
  });

  it("routes roll-initiative-all to the bulk handler", () => {
    // Without a case for this, the message reaches no handler and the client is
    // told it succeeded. Nothing else in the suite can see that.
    const result = dispatcher.dispatch({ t: "roll-initiative-all" }, context, "dm-uid");

    expect(rollHandler.handleRollInitiativeAll).toHaveBeenCalledWith(state, "dm-uid", true);
    expect(result).toEqual(routed);
  });

  it("passes the DM flag through rather than assuming it", () => {
    isDM = false;

    dispatcher.dispatch({ t: "roll-initiative-all" }, context, "player1");

    expect(rollHandler.handleRollInitiativeAll).toHaveBeenCalledWith(state, "player1", false);
  });

  it("routes roll-initiative with its target and the modifier off the wire", () => {
    dispatcher.dispatch(
      { t: "roll-initiative", characterId: "char-1", modifier: 5 },
      context,
      "player1",
    );

    expect(rollHandler.handleRollInitiative).toHaveBeenCalledWith(
      state,
      "char-1",
      "player1",
      true,
      5,
    );
  });

  it("forwards an absent modifier as undefined, meaning 'use the stored one'", () => {
    dispatcher.dispatch({ t: "roll-initiative", characterId: "char-1" }, context, "player1");

    expect(rollHandler.handleRollInitiative).toHaveBeenCalledWith(
      state,
      "char-1",
      "player1",
      true,
      undefined,
    );
  });

  it("keeps the two roll messages apart", () => {
    dispatcher.dispatch({ t: "roll-initiative", characterId: "char-1" }, context, "player1");

    expect(rollHandler.handleRollInitiativeAll).not.toHaveBeenCalled();
  });

  it("returns null for a message it does not own, so routing continues", () => {
    const result = dispatcher.dispatch({ t: "heartbeat" } as ClientMessage, context, "player1");

    expect(result).toBeNull();
  });
});
