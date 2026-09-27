import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapOperationHandle } from "../mapOperation";
import {
  generation,
  mapDocument,
  queueHarness,
  wireId,
} from "./characterization/mapQueue.fixtures";

function handle(value: unknown): MapOperationHandle {
  expect(value).toEqual({ documentId: "doc-a", completion: expect.any(Promise) });
  if (
    !value ||
    typeof value !== "object" ||
    !("completion" in value) ||
    !(value.completion instanceof Promise) ||
    !("documentId" in value) ||
    value.documentId !== "doc-a"
  ) {
    throw new Error("The property action did not return its own operation handle");
  }
  return { documentId: value.documentId, completion: value.completion };
}

describe("property action outcomes", () => {
  it("returns two original-document handles that settle only on their own receipts", async () => {
    const h = queueHarness();
    let first: unknown, second: unknown;
    act(() => {
      first = h.result.current.updateElement("door", { hidden: true });
      second = h.result.current.updateDoor("door", { state: "locked", width: 80 });
    });
    const general = handle(first),
      door = handle(second);
    const generalDone = vi.fn(),
      doorDone = vi.fn();
    void general.completion.then(generalDone);
    void door.completion.then(doorDone);
    expect(h.commands()).toHaveLength(1);
    h.documentFrame(mapDocument("doc-a", 4), "unrelated");
    h.documentFrame(mapDocument("foreign", 99), wireId(h.command()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(generalDone).not.toHaveBeenCalled();
    expect(doorDone).not.toHaveBeenCalled();
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(generalDone).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
    expect(doorDone).not.toHaveBeenCalled();
    expect(h.command(1)).toMatchObject({ command: { type: "update-door", baseRevision: 4 } });
    h.documentFrame(mapDocument("doc-a", 5), wireId(h.command(1)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(doorDone).toHaveBeenCalledExactlyOnceWith({ status: "succeeded" });
  });

  it("captures a complete transform before a queued caller mutates its draft", () => {
    const h = queueHarness();
    act(() => {
      h.result.current.generate(generation);
    });
    const update = {
      transform: { x: 120, y: 170, scaleX: 1.5, scaleY: 2, rotation: 45 },
      hidden: false,
    };
    act(() => {
      h.result.current.updateElement("door", update);
    });
    update.transform.x = 999;
    update.transform.rotation = 180;
    update.hidden = true;
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    expect(h.command(1)).toMatchObject({
      command: {
        type: "update-element",
        elementId: "door",
        update: {
          transform: { x: 120, y: 170, scaleX: 1.5, scaleY: 2, rotation: 45 },
          hidden: false,
        },
      },
    });
  });

  it("keeps sent and unsent property outcomes on A when B activates", async () => {
    const h = queueHarness();
    let first: unknown, second: unknown;
    act(() => {
      first = h.result.current.updateElement("door", { hidden: true });
      second = h.result.current.updateDoor("door", { state: "open", width: 50 });
    });
    const general = handle(first),
      door = handle(second);
    h.open(mapDocument("doc-b", 20));
    await expect(door.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
    });
    h.documentFrame(mapDocument("doc-a", 4), wireId(h.command()));
    await expect(general.completion).resolves.toEqual({ status: "succeeded" });
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    expect(h.commands()).toHaveLength(1);
  });
});
