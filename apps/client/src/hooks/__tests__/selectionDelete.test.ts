import { describe, expect, it } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { deleteConfirmText, planSelectionDelete } from "../selectionDelete";

const object = (id: string, owner: string | null, locked = false) => ({
  id,
  type: id.split(":")[0],
  owner,
  locked,
  zIndex: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  data: {},
});

const snapshot = (playerPropsEnabled: boolean) =>
  ({
    playerPropsEnabled,
    sceneObjects: [
      object("token:t1", "me"),
      object("token:t2", "sam"),
      object("drawing:d1", "me"),
      object("prop:mine", "me"),
      object("prop:dms", null),
      object("prop:locked", "me", true),
      object("map:m", null),
    ],
    props: [
      { id: "mine", owner: "me" },
      { id: "dms", owner: null },
      { id: "locked", owner: "me" },
    ],
  }) as unknown as RoomSnapshot;

describe("planSelectionDelete", () => {
  it("lets a DM delete props with tokens and drawings, never a locked piece or the map", () => {
    const plan = planSelectionDelete(
      ["token:t2", "drawing:d1", "prop:mine", "prop:dms", "prop:locked", "map:m"],
      snapshot(false),
      true,
      "dm",
    );
    expect(plan.tokens).toEqual(["t2"]);
    expect(plan.drawings).toEqual(["d1"]);
    expect(plan.props).toEqual(["mine", "dms"]);
    expect(plan.locked).toBe(1);
    expect(plan.skipped).toBe(2);
  });

  it("lets a player delete their own prop only while the DM lets players manage props", () => {
    const on = planSelectionDelete(["prop:mine", "prop:dms"], snapshot(true), false, "me");
    expect(on.props).toEqual(["mine"]);
    expect(on.skipped).toBe(1);
    const off = planSelectionDelete(["prop:mine"], snapshot(false), false, "me");
    expect(off.props).toEqual([]);
    expect(off.skipped).toBe(1);
  });

  it("keeps a player to their own tokens", () => {
    const plan = planSelectionDelete(["token:t1", "token:t2"], snapshot(true), false, "me");
    expect(plan.tokens).toEqual(["t1"]);
    expect(plan.skipped).toBe(1);
  });

  it("names every kind it will delete", () => {
    const plan = planSelectionDelete(
      ["token:t1", "drawing:d1", "prop:mine"],
      snapshot(true),
      false,
      "me",
    );
    expect(deleteConfirmText(plan)).toBe(
      "Delete 1 token and 1 drawing and 1 prop? This cannot be undone.",
    );
  });
});
