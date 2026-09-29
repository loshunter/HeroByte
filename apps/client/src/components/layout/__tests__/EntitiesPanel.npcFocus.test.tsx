// An NPC's Focus centres its token — only while that token is on the map.
// NPC tokens are scene-local: after a scene change the character still names
// its token, which waits with its scene, and Focus on it did nothing.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Token } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { DM_UID, entitiesPanelProps, npc, seat } from "./entitiesPanel.fixtures";

afterEach(cleanup);

function renderCards(tokens: Token[]) {
  const props = entitiesPanelProps({
    uid: DM_UID,
    currentIsDM: true,
    players: [seat(DM_UID, "The DM", { isDM: true })],
    characters: [npc("npc-ogre", "Ogre", { tokenId: "t-ogre" })],
    tokens,
  });
  render(<EntitiesPanel {...props} />);
  // Every card at once (the compact roster, where the Party has one, hides them).
  const cards = screen.queryByRole("button", { name: "▦ Cards" });
  if (cards) fireEvent.click(cards);
  return props;
}

const ogreCard = () => screen.getByText("Ogre").closest(".player-card") as HTMLElement;

describe("EntitiesPanel — an NPC's Focus", () => {
  it("centres its token while it is on the map", () => {
    const props = renderCards([{ id: "t-ogre", owner: DM_UID, x: 3, y: 2, color: "#f00" }]);

    fireEvent.click(within(ogreCard()).getByRole("button", { name: "Focus camera on token" }));

    expect(props.onFocusToken).toHaveBeenCalledWith("t-ogre");
  });

  it("offers none while its token waits on another scene", () => {
    renderCards([]);

    expect(within(ogreCard()).queryByRole("button", { name: "Focus camera on token" })).toBeNull();
  });
});

// Lock and Size act on the token on the map too: for a token waiting on another
// scene the server refuses both (it searches the current scene), so neither is
// offered.
describe("EntitiesPanel — an NPC's token settings", () => {
  const openSettings = () =>
    fireEvent.click(within(ogreCard()).getByRole("button", { name: "⚙️" }));

  it("offers Lock and Size while its token is on the map", () => {
    renderCards([{ id: "t-ogre", owner: DM_UID, x: 3, y: 2, color: "#f00" }]);
    openSettings();

    expect(screen.getByText("Token Size")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🔓 Unlocked" })).toBeInTheDocument();
  });

  it("offers neither while its token waits on another scene", () => {
    renderCards([]);
    openSettings();

    expect(screen.queryByText("Token Size")).toBeNull();
    expect(screen.queryByRole("button", { name: "🔓 Unlocked" })).toBeNull();
  });
});
