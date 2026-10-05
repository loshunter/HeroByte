// The eraser leaves a locked drawing alone: a locked piece is deleted by no one,
// the DM included, until it is unlocked (the server refuses it as well).

import { describe, expect, it, vi } from "vitest";
import type { SceneObject } from "@herobyte/shared";
import { commitEraseStroke } from "../eraseStroke";
import { onLockNotice } from "../../../locking/lockNotice";

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

  const across = [
    { x: 50, y: -10 },
    { x: 50, y: 10 },
  ];
  const noticesDuring = (run: () => void) => {
    const heard: (string | undefined)[] = [];
    const off = onLockNotice((message) => heard.push(message));
    run();
    off();
    return heard;
  };

  it("says the lock stopped it, once per stroke, when it crossed a locked drawing it could erase", () => {
    const heard = noticesDuring(() =>
      commitEraseStroke(
        [drawingObject("a", true), drawingObject("b", true)],
        across,
        20,
        vi.fn(),
        () => true,
      ),
    );
    // No message: the viewer's role picks the words (the DM is told to unlock it first).
    expect(heard).toEqual([undefined]);
  });

  it("says nothing for a locked drawing that is not the eraser's to erase, or one it missed", () => {
    expect(
      noticesDuring(() =>
        commitEraseStroke([drawingObject("a", true)], across, 20, vi.fn(), () => false),
      ),
    ).toEqual([]);
    const far = [
      { x: 500, y: 500 },
      { x: 510, y: 510 },
    ];
    expect(
      noticesDuring(() =>
        commitEraseStroke([drawingObject("a", true)], far, 20, vi.fn(), () => true),
      ),
    ).toEqual([]);
  });
});
