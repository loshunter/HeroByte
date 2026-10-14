/**
 * The creator's harder paths (review round 1): the bake uses the player's
 * framing at the token's edge; closing mid-save abandons the save; a link stays
 * settable as is, even when its copy cannot be stored; loads wait for a save;
 * a paste goes to one creator and never eats text; a drop anywhere loads.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetUploadError, uploadAssetFile } from "../../../map-studio/uploads/assetUpload";
import {
  HASH,
  deferred,
  deps,
  loadLink,
  open,
  pasteEvent,
  pickFile,
  recordingCanvas,
  settle,
  uploaded,
} from "./creatorTestKit";

describe("the bake follows the framing", () => {
  it("bakes what the player framed, at 768 for a Huge token", async () => {
    const { canvas, calls } = recordingCanvas();
    const { onApply } = open(deps({ bake: { createCanvas: () => canvas } }), "huge");
    await pickFile();
    // One nudge down: 0.02 of the square.
    fireEvent.keyDown(screen.getByTestId("token-creator-crop"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(canvas.width).toBe(768);
    // Centre 384, moved down 0.02 × 768 = 15.36.
    expect(calls).toContainEqual(["translate", 384, 399.36]);
  });

  it("bakes at 512 for a Medium token", async () => {
    const { canvas } = recordingCanvas();
    const { onApply } = open(deps({ bake: { createCanvas: () => canvas } }), "medium");
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(canvas.width).toBe(512);
  });

  it("uploads with the 'apply' intent, so an abandoned bake does not cost the table", async () => {
    const d = deps();
    const { onApply } = open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(vi.mocked(d.upload).mock.calls[0]![3]).toEqual({ intent: "apply" });
  });
});

describe("closing abandons a save", () => {
  it("Cancel during the upload: the picture is never set", async () => {
    const pending = deferred<ReturnType<typeof uploaded>>();
    const { onApply, onClose, view } = open(deps({ upload: vi.fn(() => pending.promise) }));
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await screen.findByRole("button", { name: "Uploading…" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    view.unmount(); // the parent closes the window
    await act(async () => pending.resolve(uploaded()));
    await settle();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("closing during the bake: nothing is uploaded", async () => {
    const { canvas } = recordingCanvas();
    let finishEncode: (() => void) | null = null;
    canvas.toBlob = (callback) => {
      finishEncode = () => callback(new Blob(["baked"], { type: "image/webp" }));
    };
    const d = deps({ bake: { createCanvas: () => canvas } });
    const { onApply, view } = open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await screen.findByRole("button", { name: "Baking…" });
    view.unmount();
    await act(async () => finishEncode?.());
    await settle();
    expect(d.upload).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("a load that lands after the close is released, not kept", async () => {
    const pending = deferred<HTMLImageElement>();
    const d = deps();
    vi.mocked(d.load.loadImage).mockReturnValue(pending.promise);
    const { view } = open(d);
    fireEvent.change(screen.getByLabelText("Token picture file"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    view.unmount();
    await act(async () =>
      pending.resolve({ naturalWidth: 9, naturalHeight: 9 } as HTMLImageElement),
    );
    await settle();
    expect(d.load.revokeObjectURL).toHaveBeenCalledWith("blob:picked");
  });
});

describe("a link stays settable as is", () => {
  it("a link that loaded is offered as is too, and sets the normalized link", async () => {
    const d = deps();
    vi.mocked(d.load.normalizeLink).mockResolvedValue("https://i.imgur.com/abc.png");
    const { onApply } = open(d);
    await loadLink("https://imgur.com/abc");
    await screen.findByRole("button", { name: /Rotate/ });
    fireEvent.click(screen.getByRole("button", { name: "Use the link as is" }));
    expect(onApply).toHaveBeenCalledWith("https://i.imgur.com/abc.png");
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("a full store refuses the copy; the link can still be set as is", async () => {
    const d = deps({
      upload: vi.fn(async () => {
        throw new AssetUploadError("quota-exceeded", "The table's asset storage is full.");
      }),
    });
    const { onApply } = open(d);
    await loadLink("https://i.imgur.com/abc.png");
    await screen.findByRole("button", { name: /Rotate/ });
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("asset storage is full");
    fireEvent.click(screen.getByRole("button", { name: "Use the link as is" }));
    expect(onApply).toHaveBeenCalledWith("https://i.imgur.com/abc.png");
  });

  it("a file picture offers no link", async () => {
    open();
    await pickFile();
    expect(screen.queryByRole("button", { name: "Use the link as is" })).toBeNull();
  });

  it("no table credentials: says to join the table", async () => {
    const d = deps({ upload: uploadAssetFile, getCredentials: () => null });
    open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Join the table before uploading assets.",
    );
  });
});

describe("loads, pastes and drops", () => {
  it("nothing new loads over a save in progress", async () => {
    const pending = deferred<ReturnType<typeof uploaded>>();
    const d = deps({ upload: vi.fn(() => pending.promise) });
    const { onApply } = open(d);
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await screen.findByRole("button", { name: "Uploading…" });
    act(() => {
      document.dispatchEvent(pasteEvent([new File(["y"], "b.png", { type: "image/png" })]));
    });
    expect(d.load.createObjectURL).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(uploaded()));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.stringMatching(HASH)));
  });

  it("text pasted into a text field stays text, even with a picture alongside", async () => {
    const d = deps();
    open(d);
    const field = screen.getByLabelText("Or a link to a picture");
    const paste = pasteEvent([new File(["c"], "cells.png", { type: "image/png" })], "A1\tB1");
    act(() => {
      field.dispatchEvent(paste);
    });
    expect(paste.defaultPrevented).toBe(false);
    expect(d.load.createObjectURL).not.toHaveBeenCalled();
  });

  it("with two creators open, a paste goes to the newest only", async () => {
    const first = deps();
    const second = deps();
    open(first, "medium", "Goblin");
    open(second, "medium", "Orc");
    act(() => {
      document.dispatchEvent(pasteEvent([new File(["x"], "a.png", { type: "image/png" })]));
    });
    await waitFor(() => expect(second.load.createObjectURL).toHaveBeenCalled());
    expect(first.load.createObjectURL).not.toHaveBeenCalled();
  });

  it("a file dropped beside the square loads, and the tab keeps the table", async () => {
    const d = deps();
    open(d);
    const dropped = new File(["x"], "drop.png", { type: "image/png" });
    const target = screen.getByRole("tablist");
    const drop = fireEvent.drop(target, {
      dataTransfer: { files: { length: 1, item: () => dropped }, getData: () => "" },
    });
    // fireEvent returns false when the default was prevented.
    expect(drop).toBe(false);
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.createObjectURL).toHaveBeenCalledWith(dropped);
  });

  it("a dropped link loads; a drop with nothing usable says what to drop", async () => {
    const d = deps();
    open(d);
    const crop = screen.getByTestId("token-creator-crop");
    fireEvent.drop(crop, {
      dataTransfer: { files: { length: 0, item: () => null }, getData: () => "" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Drop a picture file");
    fireEvent.drop(crop, {
      dataTransfer: {
        files: { length: 0, item: () => null },
        getData: (format: string) =>
          format === "text/uri-list" ? "https://i.imgur.com/dropped.png" : "",
      },
    });
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.loadImage).toHaveBeenCalledWith("https://i.imgur.com/dropped.png", true);
  });
});
