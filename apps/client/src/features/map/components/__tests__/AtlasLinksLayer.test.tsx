// ============================================================================
// ATLASLINKSLAYER COMPONENT TESTS
// ============================================================================
// The layer renders what the server projection sent (no client re-filter),
// scopes sprites to the CURRENT node's map, marks DM-hidden links, and gives
// a hit shape only to a DM with somewhere to travel.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MapLinkSnapshot } from "@herobyte/shared";
import { AtlasLinksLayer } from "../AtlasLinksLayer";
import type { Camera } from "../../types";

type MockProps = Record<string, unknown> & { children?: ReactNode };

const circleProps: MockProps[] = [];
const textProps: MockProps[] = [];
const groupProps: MockProps[] = [];

vi.mock("react-konva", () => ({
  Group: ({ children, ...props }: MockProps) => {
    groupProps.push(props);
    return <div data-testid="konva-group">{children}</div>;
  },
  Circle: (props: MockProps) => {
    circleProps.push(props);
    return <div data-testid="konva-circle" />;
  },
  Text: (props: MockProps) => {
    textProps.push(props);
    return <div data-testid="konva-text" />;
  },
}));

const cam: Camera = { x: 10, y: 20, scale: 2 };

function link(overrides: Partial<MapLinkSnapshot> = {}): MapLinkSnapshot {
  return {
    id: "link-1",
    fromNodeId: "node-here",
    anchor: { x: 300, y: 400 },
    linkType: "door",
    ...overrides,
  };
}

beforeEach(() => {
  circleProps.length = 0;
  textProps.length = 0;
  groupProps.length = 0;
});

describe("AtlasLinksLayer", () => {
  it("renders only links FROM the current node — anchors belong to that map alone", () => {
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link(), link({ id: "link-2", fromNodeId: "node-elsewhere" })]}
        currentNodeId="node-here"
        dmView={false}
      />,
    );
    // One badge circle, no hit circle (player), one glyph.
    expect(circleProps).toHaveLength(1);
    expect(textProps).toHaveLength(1);
    expect(circleProps[0]).toMatchObject({ x: 300, y: 400, listening: false });
  });

  it("renders nothing when the current node is unknown (the deliberately mysterious frame)", () => {
    const { container } = render(
      <AtlasLinksLayer cam={cam} links={[link()]} currentNodeId={undefined} dmView={false} />,
    );
    expect(container.querySelector("[data-testid=konva-group]")).toBeNull();
  });

  it("nests the camera then the map transform, the DoorsLayer alignment contract", () => {
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link()]}
        currentNodeId="node-here"
        mapTransform={{ x: 5, y: 6, scaleX: 1.5, scaleY: 1.5, rotation: 30 }}
        dmView={false}
      />,
    );
    expect(groupProps[0]).toMatchObject({ x: 10, y: 20, scaleX: 2, scaleY: 2 });
    expect(groupProps[1]).toMatchObject({ x: 5, y: 6, scaleX: 1.5, scaleY: 1.5, rotation: 30 });
  });

  it("a DM's travel-capable sprite gets ONE listening hit shape that fires onTravel with the target", () => {
    const onTravel = vi.fn();
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link({ toNodeId: "node-away" })]}
        currentNodeId="node-here"
        dmView={true}
        onTravel={onTravel}
      />,
    );
    const listeners = circleProps.filter((p) => p.listening === true);
    expect(listeners).toHaveLength(1);
    const activate = listeners[0]!.onClick as (e: {
      cancelBubble: boolean;
      evt: MouseEvent;
    }) => void;
    activate({ cancelBubble: false, evt: new MouseEvent("click") });
    expect(onTravel).toHaveBeenCalledWith("node-away");
  });

  it("a target-less sprite is inert even for the DM, and a player's is inert always", () => {
    const onTravel = vi.fn();
    render(
      <AtlasLinksLayer
        cam={cam}
        // The player projection blanks toNodeId when the target is hidden.
        links={[link()]}
        currentNodeId="node-here"
        dmView={true}
        onTravel={onTravel}
      />,
    );
    expect(circleProps.filter((p) => p.listening === true)).toHaveLength(0);

    circleProps.length = 0;
    // Defense-in-depth: even a caller that hands a player view a handler must
    // not produce a hit shape — dmView is part of canTravel on purpose.
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link({ toNodeId: "node-away" })]}
        currentNodeId="node-here"
        dmView={false}
        onTravel={onTravel}
      />,
    );
    expect(circleProps.filter((p) => p.listening === true)).toHaveLength(0);
  });

  it("marks a players-can't-see-this link for the DM alone", () => {
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link({ toNodeId: "node-away", visibleToPlayers: false })]}
        currentNodeId="node-here"
        dmView={true}
        onTravel={vi.fn()}
      />,
    );
    // badge + dashed marker ring + hit = 3 circles, one dashed.
    expect(circleProps.filter((p) => Array.isArray(p.dash))).toHaveLength(1);

    circleProps.length = 0;
    // The same link shape WITHOUT dmView never draws the marker (a player list
    // could never contain visibleToPlayers:false, but the layer must not rely
    // on that alone).
    render(
      <AtlasLinksLayer
        cam={cam}
        links={[link({ visibleToPlayers: false })]}
        currentNodeId="node-here"
        dmView={false}
      />,
    );
    expect(circleProps.filter((p) => Array.isArray(p.dash))).toHaveLength(0);
  });
});
