// The eraser leaves a locked drawing alone: a locked piece is deleted by no one,
// the DM included, until it is unlocked (the server refuses it as well).

import { describe, expect, it, vi } from "vitest";
import type { SceneObject } from "@herobyte/shared";
import { commitEraseStroke } from "../eraseStroke";

const drawingObject = (id: string, locked: boolean) =>
  ({
    id: `drawing:${id}`,
    type: "drawing",
    owner: "me",
    locked,
    zIndex: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      drawing: {
        id,
        owner: "me",
        type: "line",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        color: "#f00",
        width: 4,
        opacity: 1,
      },
    },
  }) as unknown as SceneObject & { type: "drawing" };

describe("commitEraseStroke and the lock", () => {
  it("erases the unlocked drawing under the stroke and skips the locked one", () => {
    const sendMessage = vi.fn();
    const stroke = [
      { x: 50, y: -10 },
      { x: 50, y: 10 },
    ];
    commitEraseStroke(
      [drawingObject("free", false), drawingObject("locked", true)],
      stroke,
      20,
      sendMessage,
    );
    const ids = sendMessage.mock.calls.map(([m]) => m.id ?? m.deleteId);
    expect(ids).toContain("free");
    expect(ids).not.toContain("locked");
  });
});
