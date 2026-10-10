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

  it("keeps today's gold for a DM and white for a player with no colour", () => {
    renderPing("dm", [], [token("t-gob", "dm", "#ff0000")]);
    expect(dotColor()).toBe("#FFD700");
    renderPing("bo", [], []);
    expect(dotColor()).toBe("#fff");
  });

  it("writes the name in the ping's colour, outlined in its keyline", () => {
    renderPing("bo", [pc("bors", "bo", "#390076")], []);
    const label = texts.find((text) => text.text === "bo")!;
    expect(label.fill).toBe("#390076");
    expect(label.stroke).toBe("#f4f1e8");
    expect(label.fillAfterStrokeEnabled).toBe(true);
  });
});
