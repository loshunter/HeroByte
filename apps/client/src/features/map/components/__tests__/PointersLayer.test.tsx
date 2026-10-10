// Pings in their player's colour (C3): the DM pings in the DM's own PC's colour,
// never a placed NPC's; a party member out of sight keeps their colour (read off
// the party record, not the fogged token list); no colour keeps today's gold and
// white; and the name label reads on any map.

import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Player, Pointer, SnapshotCharacter, Token } from "@herobyte/shared";

type Props = Record<string, unknown> & { children?: ReactNode };
const circles: Props[] = [];
const texts: Props[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children }: Props) => <div>{children}</div>,
  Circle: (props: Props) => {
    circles.push(props);
    return <div />;
  },
  Text: (props: Props) => {
    texts.push(props);
    return <div />;
  },
}));
vi.mock("../../../juice", () => ({ useSfx: () => ({ play: () => undefined }) }));

const { PointersLayer } = await import("../PointersLayer");

const players: Player[] = [
  { uid: "dm", name: "DM", isDM: true } as Player,
  { uid: "bo", name: "Bo" } as Player,
];
const ping = (uid: string): Pointer => ({
  id: `p-${uid}`,
  uid,
  x: 10,
  y: 10,
  name: uid,
  timestamp: Date.now(),
});
const pc = (id: string, owner: string, color?: string) =>
  ({
    id,
    name: id,
    type: "pc",
    ownedByPlayerUID: owner,
    tokenId: `t-${id}`,
    color,
  }) as SnapshotCharacter;
const token = (id: string, owner: string, color: string) =>
  ({ id, owner, x: 0, y: 0, color }) as Token;

/** The ping's main dot: the circle filled in its colour, with a glow. */
function dotColor(): unknown {
  return circles.find((circle) => circle.shadowColor !== undefined && circle.radius !== undefined)
    ?.fill;
}

function renderPing(uid: string, characters: SnapshotCharacter[], tokens: Token[]) {
  circles.length = 0;
  texts.length = 0;
  render(
    <PointersLayer
      cam={{ x: 0, y: 0, scale: 1 }}
      pointers={[ping(uid)]}
      players={players}
      tokens={tokens}
      characters={characters}
    />,
  );
}

describe("PointersLayer colours", () => {
  it("pings the DM in the DM's own PC's colour, not the NPC token placed last", () => {
    renderPing(
      "dm",
      [
        pc("hero", "dm", "#00aa55"),
        { id: "gob", name: "Goblin", type: "npc", tokenId: "t-gob" } as SnapshotCharacter,
      ],
      [token("t-hero", "dm", "#00aa55"), token("t-gob", "dm", "#ff0000")],
    );
    expect(dotColor()).toBe("#00aa55");
  });

  it("keeps a party member's colour while fog keeps their token out of the payload", () => {
    renderPing("bo", [pc("bors", "bo", "#8a2be2")], []);
    expect(dotColor()).toBe("#8a2be2");
  });

  it("edges a deep colour's dot in its light keyline so it shows on a dark map", () => {
    renderPing("bo", [pc("bors", "bo", "#390076")], []);
    const dot = circles.find((circle) => circle.fill === "#390076" && circle.shadowColor);
    expect(dot?.stroke).toBe("#f4f1e8");
  });

  it("keeps today's gold for a DM and white for a player with no colour", () => {
    renderPing("dm", [], [token("t-gob", "dm", "#ff0000")]);
    expect(dotColor()).toBe("#FFD700");
    renderPing("bo", [], []);
    expect(dotColor()).toBe("#fff");
  });

  it("draws the dot and label without Konva's stage-sized buffer canvas", () => {
    renderPing("bo", [pc("bors", "bo", "#390076")], []);
    const dot = circles.find((circle) => circle.fill === "#390076" && circle.shadowColor);
    expect(dot?.perfectDrawEnabled).toBe(false);
    expect(texts.find((text) => text.text === "bo")?.perfectDrawEnabled).toBe(false);
  });

  it("lays the expanding ring over its keyline", () => {
    renderPing("bo", [pc("bors", "bo", "#390076")], []);
    const rings = circles.filter((circle) => circle.radius !== undefined && !circle.fill);
    expect(rings.map((ring) => ring.stroke)).toEqual(["#f4f1e8", "#390076"]);
  });

  it("aims in the viewer's colour over its keyline; gold for a DM and cyan without one", () => {
    const aim = (uid: string, characters: SnapshotCharacter[]) => {
      circles.length = 0;
      render(
        <PointersLayer
          cam={{ x: 0, y: 0, scale: 1 }}
          pointers={[]}
          players={players}
          tokens={[]}
          characters={characters}
          pointerMode
          preview={{ x: 5, y: 5 }}
          previewUid={uid}
        />,
      );
      // The aim pulses (re-renders): its last two dashed circles are the current ones.
      return circles
        .filter((circle) => circle.dash)
        .slice(-2)
        .map((circle) => circle.stroke);
    };
    expect(aim("bo", [pc("bors", "bo", "#390076")])).toEqual(["#f4f1e8", "#390076"]);
    expect(aim("dm", [])).toEqual(["#0b0b16", "#FFD700"]);
    expect(aim("bo", [])).toEqual(["#0b0b16", "#61dafb"]);
  });

  it("writes the name in the ping's colour, outlined in its keyline", () => {
    renderPing("bo", [pc("bors", "bo", "#390076")], []);
    const label = texts.find((text) => text.text === "bo")!;
    expect(label.fill).toBe("#390076");
    expect(label.stroke).toBe("#f4f1e8");
    expect(label.fillAfterStrokeEnabled).toBe(true);
    expect(label.lineJoin).toBe("round");
    // A colour that sits too close to its keyline is lifted away from it (glyphs >= 4.5:1).
    renderPing("bo", [pc("bors", "bo", "#008183")], []);
    const teal = texts.find((text) => text.text === "bo")!;
    expect(teal.fill).not.toBe("#008183");
  });
});
