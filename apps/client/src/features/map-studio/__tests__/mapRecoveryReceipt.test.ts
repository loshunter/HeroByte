import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapDocument, queueHarness } from "./characterization/mapQueue.fixtures";
import type { MapRecoveryCallback } from "../mapRecovery";

beforeEach(() => vi.useFakeTimers());

function setup() {
  const h = queueHarness();
  const receive = (requestId?: string, id = "doc-a", error = false) => {
    // Extra wire field is deliberately structural until the protocol gains it.
    if (error) {
      const frame = {
        t: "map-studio-error" as const,
        documentId: id,
        commandId: `get:${id}`,
        code: "not-found" as const,
        reason: "Map gone",
        requestId,
      };
      h.receive(frame);
    } else {
      const frame = { t: "map-studio-document" as const, document: mapDocument(id), requestId };
      h.receive(frame);
    }
  };
  const begin = (id = "doc-a") => {
    const settle = vi.fn<MapRecoveryCallback>();
    act(() => h.result.current.openDocument(id, settle));
    const request = h.send.mock.calls.at(-1)?.[0];
    const requestId = request && "requestId" in request ? request.requestId : undefined;
    // A useful behavioral failure before implementation, not an invalid TS cast.
    expect(typeof requestId).toBe("string");
    if (typeof requestId !== "string") throw new Error("No recovery identity sent");
    return { settle, requestId };
  };
  return { ...h, begin, receipt: receive };
}

describe("map recovery request lifetime", () => {
  it("ignores other GETs and documents; matching receipt settles once", () => {
    const h = setup(),
      r = h.begin();
    h.receipt();
    h.receipt("earlier-get");
    h.receipt(r.requestId, "doc-b");
    expect(r.settle).not.toHaveBeenCalled();
    h.receipt(r.requestId);
    expect(r.settle).toHaveBeenCalledExactlyOnceWith({ status: "received" });
    h.receipt(r.requestId, "doc-a", true);
    act(() => vi.advanceTimersByTime(12_000));
    expect(r.settle).toHaveBeenCalledTimes(1);
  });

  it("only the matching error settles failure; a late success cannot reverse it", () => {
    const h = setup(),
      r = h.begin();
    h.receipt("other", "doc-a", true);
    expect(r.settle).not.toHaveBeenCalled();
    h.receipt(r.requestId, "doc-a", true);
    expect(r.settle).toHaveBeenCalledExactlyOnceWith({ status: "failed", reason: "Map gone" });
    h.receipt(r.requestId);
    expect(r.settle).toHaveBeenCalledTimes(1);
  });

  it("has its own 12-second deadline after a broadcast clears generic loading", () => {
    const h = setup(),
      r = h.begin();
    h.documentFrame(mapDocument("doc-a", 4), "other-dm");
    expect(h.result.current.loading).toBe(false);
    act(() => vi.advanceTimersByTime(11_999));
    expect(r.settle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(r.settle).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: "failed" }));
    h.receipt(r.requestId);
    expect(r.settle).toHaveBeenCalledTimes(1);
  });

  it("supersedes a recovery without letting its late reply complete the successor", () => {
    const h = setup(),
      first = h.begin(),
      second = h.begin();
    expect(second.requestId).not.toBe(first.requestId);
    expect(first.settle).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "failed" }),
    );
    h.receipt(first.requestId);
    expect(second.settle).not.toHaveBeenCalled();
    h.receipt(second.requestId);
    expect(second.settle).toHaveBeenCalledExactlyOnceWith({ status: "received" });
  });

  it("cancels on document switch and never revives on returning to the document", () => {
    const h = setup(),
      r = h.begin();
    h.open(mapDocument("doc-b"));
    expect(r.settle).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: "failed" }));
    h.receipt(r.requestId);
    expect(h.result.current.activeDocument?.id).toBe("doc-b");
    h.open(mapDocument());
    h.receipt(r.requestId);
    expect(r.settle).toHaveBeenCalledTimes(1);
  });

  it("settles on disposal and ignores retained handlers", () => {
    const h = setup(),
      r = h.begin();
    h.unmount();
    expect(r.settle).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: "failed" }));
    h.receipt(r.requestId);
    act(() => vi.advanceTimersByTime(12_000));
    expect(r.settle).toHaveBeenCalledTimes(1);
  });
});
