// The Party's NPC cards were wired to `undefined` when the DM menu was
// extracted (60d22d65), so every HP, name, art, placement and deletion edit a
// DM made on one silently did nothing. MainLayout now hands the Party real
// handlers for a DM — and none for a player, whom the server would refuse.

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { createKickMobileProps } from "../../features/interaction/__tests__/kickMobile.props";

const captured: {
  onNpcUpdate?: (id: string, updates: { hp?: number }) => void;
  onNpcPlaceToken?: (id: string) => void;
  onNpcDelete?: (id: string) => void;
} = {};

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: (props: typeof captured) => {
    captured.onNpcUpdate = props.onNpcUpdate;
    captured.onNpcPlaceToken = props.onNpcPlaceToken;
    captured.onNpcDelete = props.onNpcDelete;
    return <div data-testid="entities-panel" />;
  },
}));
vi.mock("../../ui/MapBoard", () => ({ default: () => <div data-testid="map-board" /> }));
vi.mock("../../features/dm/lazy-entry", () => ({ DMMenuContainer: () => null }));

import { MainLayout } from "../MainLayout";

function propsWithGoblin(isDM: boolean) {
  const props = createKickMobileProps();
  props.isDM = isDM;
  props.sendMessage = vi.fn();
  props.snapshot = {
    ...(props.snapshot ?? {}),
    characters: [{ id: "npc-1", name: "Goblin", type: "npc", hp: 7, maxHp: 9 }],
  } as unknown as RoomSnapshot;
  return props;
}

beforeEach(() => {
  captured.onNpcUpdate = undefined;
  captured.onNpcPlaceToken = undefined;
  captured.onNpcDelete = undefined;
  vi.restoreAllMocks();
});

describe("MainLayout — the Party's NPC cards act for the DM", () => {
  it("sends the NPC's merged record and its placement for a DM", () => {
    const props = propsWithGoblin(true);
    render(<MainLayout {...props} />);

    captured.onNpcUpdate?.("npc-1", { hp: 3 });
    captured.onNpcPlaceToken?.("npc-1");

    expect(props.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "update-npc", id: "npc-1", name: "Goblin", hp: 3, maxHp: 9 }),
    );
    expect(props.sendMessage).toHaveBeenCalledWith({ t: "place-npc-token", id: "npc-1" });
  });

  it("deletes the NPC for a DM once they confirm", () => {
    const props = propsWithGoblin(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MainLayout {...props} />);

    captured.onNpcDelete?.("npc-1");

    expect(props.sendMessage).toHaveBeenCalledWith({ t: "delete-npc", id: "npc-1" });
  });

  it("gives a player's Party no NPC handler", () => {
    render(<MainLayout {...propsWithGoblin(false)} />);

    expect(captured.onNpcUpdate).toBeUndefined();
    expect(captured.onNpcPlaceToken).toBeUndefined();
    expect(captured.onNpcDelete).toBeUndefined();
  });
});
