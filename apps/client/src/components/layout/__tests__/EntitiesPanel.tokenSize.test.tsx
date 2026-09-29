// Token size is offered wherever the server allows it: the token's owner, or
// the DM on any token (TokenMessageHandler.handleSetSize wires the DM path on
// purpose). The card offered size to its owner only, so a DM's window for a
// player showed sight, lock and delete but no size.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Token } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { ALICE_UID, BOB_UID, DM_UID, entitiesPanelProps, pc, seat } from "./entitiesPanel.fixtures";

const players = [
  seat(DM_UID, "The DM", { isDM: true }),
  seat(ALICE_UID, "Alice"),
  seat(BOB_UID, "Bob"),
];
const characters = [pc("char-alice", "Alice", ALICE_UID, { tokenId: "t-alice" })];
const tokens = [{ id: "t-alice", owner: ALICE_UID, x: 0, y: 0, color: "#f00" }] as Token[];

afterEach(cleanup);

function renderAs(uid: string, currentIsDM: boolean) {
  const props = entitiesPanelProps({ players, characters, tokens, uid, currentIsDM });
  render(<EntitiesPanel {...props} />);
  // Every card at once (the compact roster, where the Party has one, hides them).
  const cards = screen.queryByRole("button", { name: "▦ Cards" });
  if (cards) fireEvent.click(cards);
  return props;
}

const aliceCard = () => screen.getByText("Alice").closest(".player-card") as HTMLElement;

describe("EntitiesPanel — who may resize a player's token", () => {
  it("the DM, from the player's card", () => {
    const props = renderAs(DM_UID, true);

    fireEvent.click(within(aliceCard()).getByRole("button", { name: "Open player settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Large" }));

    expect(props.onTokenSizeChange).toHaveBeenCalledWith("t-alice", "large");
  });

  it("the owner, as before", () => {
    const props = renderAs(ALICE_UID, false);

    fireEvent.click(within(aliceCard()).getByRole("button", { name: "Open player settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Huge" }));

    expect(props.onTokenSizeChange).toHaveBeenCalledWith("t-alice", "huge");
  });
});
