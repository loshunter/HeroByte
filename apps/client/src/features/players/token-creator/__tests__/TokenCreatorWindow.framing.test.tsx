/**
 * Review round 2: every framing control reaches the bake through the UI; the
 * Auto backdrop is the colour painted; the preview draws what the map draws;
 * the framing holds still while saving; "as is" only ever means the link on
 * screen; the pointer ignores what is not a primary drag; drops and pastes
 * reach the window wherever they land.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenPictureControl } from "../TokenPictureControl";
import { LINK_MAX_LENGTH } from "../useTokenCreator";
import {
  decoded,
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

// jsdom has no PointerEvent, and without one a fired pointer event carries no
// coordinates: a MouseEvent with the two pointer fields is all the stage reads.
if (!("PointerEvent" in window)) {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
    }
  }
  (window as unknown as { PointerEvent: typeof PointerEventShim }).PointerEvent = PointerEventShim;
}

const crop = () => screen.getByTestId("token-creator-crop");
const cropImage = () => crop().querySelector("img")!;

describe("the controls reach the bake", () => {
  it("Rotate, Flip and + all land in the baked picture", async () => {
    const { canvas, calls } = recordingCanvas();
    const { onApply } = open(deps({ bake: { createCanvas: () => canvas } }), "huge");
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: /Rotate/ }));
    fireEvent.click(screen.getByRole("button", { name: /Flip/ }));
    fireEvent.keyDown(crop(), { key: "+" });
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(calls).toContainEqual(["scale", -1, 1]);
    expect(calls).toContainEqual(["rotate", Math.PI / 2]);
    // 300×600 at zoom 1.1 on 768: 2.816 output px per source px.
    const draw = calls.find(([name]) => name === "drawImage")!;
    expect(draw[1]).toBe(decoded);
    expect(draw.slice(2).map((n) => Math.round((n as number) * 10) / 10)).toEqual([
      -422.4, -844.8, 844.8, 1689.6,
    ]);
  });

  it("the Zoom slider and Reset reach the framing", async () => {
    open();
    await pickFile();
    const slider = screen.getByRole("slider", { name: "Zoom" });
    fireEvent.change(slider, { target: { value: String(Math.log(2)) } });
    expect(slider).toHaveAttribute("aria-valuetext", "200%");
    // Absolute, not compounding: 200% then the slider at 3× reads 300%, not 600%.
    fireEvent.change(slider, { target: { value: String(Math.log(3)) } });
    expect(slider).toHaveAttribute("aria-valuetext", "300%");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(slider).toHaveAttribute("aria-valuetext", "100%");
  });

  it("keys: Shift nudges five steps, − zooms out", async () => {
    open();
    await pickFile();
    fireEvent.keyDown(crop(), { key: "+" });
    fireEvent.keyDown(crop(), { key: "ArrowDown", shiftKey: true });
    // Zoom 1.1: the 1:2 picture is 2.2 squares tall (top −60% centred); down 0.1 of
    // the square puts its top at −50%.
    expect(parseFloat(cropImage().style.top)).toBeCloseTo(-50, 6);
    fireEvent.keyDown(crop(), { key: "-" });
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveAttribute("aria-valuetext", "100%");
  });

  it("paints the Auto colour it sampled", async () => {
    const { canvas, calls } = recordingCanvas();
    const { onApply } = open(deps({ bake: { createCanvas: () => canvas } }), "huge");
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    // deps().autoColor answers #334455.
    expect(calls[0]).toEqual(["fillRect", "#334455", 0, 0, 768, 768]);
  });

  it("a Huge token's size reaches the window through the control", async () => {
    const seen: unknown[] = [];
    const Stub = (props: object) => {
      seen.push(props);
      return <p>stub window</p>;
    };
    render(
      <TokenPictureControl
        onApply={vi.fn()}
        tokenSize="huge"
        loadWindow={async () => ({ default: Stub })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Token picture…" }));
    await screen.findByText("stub window");
    expect(seen.at(-1)).toMatchObject({ tokenSize: "huge" });
  });
});

describe("the preview draws what the map draws", () => {
  it("a Medium token: a rounded square at the map's corner (1/6 of the side), no outline", async () => {
    open(deps(), "medium");
    await pickFile();
    const preview = screen.getByRole("group", { name: "Preview at token size" });
    const token = within(preview).getAllByRole("img", { hidden: true })[0]!.parentElement!;
    expect(token.style.borderRadius).toBe("8px");
    expect(token.style.outline).toBe("");
  });
});

describe("the framing holds still while saving", () => {
  it("Rotate, keys and the backdrop do nothing during the upload", async () => {
    const pending = deferred<ReturnType<typeof uploaded>>();
    open(deps({ upload: vi.fn(() => pending.promise) }));
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await screen.findByRole("button", { name: "Uploading…" });
    const before = cropImage().getAttribute("style");
    fireEvent.click(screen.getByRole("button", { name: /Rotate/ }));
    fireEvent.keyDown(crop(), { key: "ArrowDown" });
    fireEvent.change(screen.getByLabelText("Backdrop", { selector: "select" }), {
      target: { value: "none" },
    });
    expect(cropImage().getAttribute("style")).toBe(before);
    expect(screen.getByLabelText("Backdrop", { selector: "select" })).toHaveValue("auto");
    await act(async () => pending.resolve(uploaded()));
  });
});

describe("'as is' means the link on screen", () => {
  it("is withdrawn while a new link loads, then sets the new link", async () => {
    const d = deps();
    const { onApply } = open(d);
    await loadLink("https://i.imgur.com/A.png");
    await screen.findByRole("button", { name: "Use the link as is" });
    const second = deferred<HTMLImageElement>();
    vi.mocked(d.load.loadImage).mockReturnValueOnce(second.promise);
    await loadLink("https://i.imgur.com/B.png");
    expect(screen.queryByRole("button", { name: "Use the link as is" })).toBeNull();
    await act(async () => second.resolve(decoded));
    fireEvent.click(await screen.findByRole("button", { name: "Use the link as is" }));
    expect(onApply).toHaveBeenCalledWith("https://i.imgur.com/B.png");
  });

  it("a failed link drops the old file picture: Accept cannot save it", async () => {
    const d = deps();
    open(d);
    await pickFile();
    vi.mocked(d.load.loadImage).mockRejectedValue(new Error("404"));
    await loadLink("https://i.imgur.com/gone.png");
    await screen.findByRole("button", { name: "Use the link as is" });
    expect(screen.queryByRole("button", { name: /Rotate/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    expect(d.upload).not.toHaveBeenCalled();
  });

  it("editing the link withdraws a failed link's offer", async () => {
    const d = deps();
    vi.mocked(d.load.loadImage).mockRejectedValue(new Error("404"));
    open(d);
    await loadLink("https://i.imgur.com/tpyo.png");
    await screen.findByRole("button", { name: "Use the link as is" });
    fireEvent.change(screen.getByLabelText("Or a link to a picture"), {
      target: { value: "https://i.imgur.com/typo.png" },
    });
    expect(screen.queryByRole("button", { name: "Use the link as is" })).toBeNull();
  });

  it("a link the server would refuse for length says so and stays open", async () => {
    const d = deps();
    vi.mocked(d.load.loadImage).mockRejectedValue(new Error("404"));
    const { onApply, onClose } = open(d);
    await loadLink(`https://i.imgur.com/${"a".repeat(LINK_MAX_LENGTH)}.png`);
    fireEvent.click(await screen.findByRole("button", { name: "Use the link as is" }));
    expect(screen.getByRole("alert")).toHaveTextContent("too long");
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a drop error raised while a load runs is cleared when the picture lands", async () => {
    const d = deps();
    const pending = deferred<HTMLImageElement>();
    vi.mocked(d.load.loadImage).mockReturnValueOnce(pending.promise);
    open(d);
    fireEvent.change(screen.getByLabelText("Token picture file"), {
      target: { files: [new File(["x"], "a.png", { type: "image/png" })] },
    });
    fireEvent.drop(crop(), {
      dataTransfer: { files: { length: 0, item: () => null }, getData: () => "" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Drop a picture file");
    await act(async () => pending.resolve(decoded));
    await screen.findByRole("button", { name: /Rotate/ });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the pointer", () => {
  it("a left drag pans; a right drag does not", async () => {
    open();
    await pickFile();
    // A covering 1:2 picture moves up and down only.
    const top = () => cropImage().style.top;
    const start = top();
    fireEvent.pointerDown(crop(), {
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
      buttons: 2,
      clientY: 100,
    });
    fireEvent.pointerMove(crop(), { pointerId: 1, pointerType: "mouse", buttons: 2, clientY: 140 });
    fireEvent.pointerUp(crop(), { pointerId: 1, pointerType: "mouse" });
    expect(top()).toBe(start);
    fireEvent.pointerDown(crop(), {
      pointerId: 2,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      clientY: 100,
    });
    fireEvent.pointerMove(crop(), { pointerId: 2, pointerType: "mouse", buttons: 1, clientY: 140 });
    expect(top()).not.toBe(start);
  });

  it("a drag moves the picture with the pointer, at the square's own scale", async () => {
    open();
    await pickFile();
    // Give the square a layout width (jsdom has none): 200 px.
    Object.defineProperty(crop(), "clientWidth", { value: 200, configurable: true });
    fireEvent.pointerDown(crop(), {
      pointerId: 4,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      clientY: 100,
    });
    // 20 px down on a 200 px square: a tenth of the square, downward.
    fireEvent.pointerMove(crop(), { pointerId: 4, pointerType: "mouse", buttons: 1, clientY: 120 });
    expect(parseFloat(cropImage().style.top)).toBeCloseTo(-40, 6);
  });

  it("a mouse whose release was lost stops steering", async () => {
    open();
    await pickFile();
    // jsdom lays the square out 1 px wide: a 0.1 px move is a tenth of the square.
    const at = (clientY: number, buttons: number) =>
      fireEvent.pointerMove(crop(), { pointerId: 3, pointerType: "mouse", buttons, clientY });
    fireEvent.pointerDown(crop(), {
      pointerId: 3,
      pointerType: "mouse",
      button: 0,
      buttons: 1,
      clientY: 100,
    });
    at(100.1, 1);
    const after = cropImage().style.top;
    expect(after).not.toBe("-50%");
    // Hovering with no button held (the pointerup went to a context menu).
    at(100.2, 0);
    at(100.3, 1);
    expect(cropImage().style.top).toBe(after);
  });
});

describe("round 3: sizes, near misses and stale offers", () => {
  it("the corners follow the token's size, as the map draws them", async () => {
    open(deps(), "huge");
    await pickFile();
    // Huge: 2× the side, the same 1/8-cell corner: 1/12 of the side.
    expect(parseFloat(crop().style.borderRadius)).toBeCloseTo(100 / 12, 6);
    const preview = screen.getByRole("group", { name: "Preview at token size" });
    const token = within(preview).getAllByRole("img", { hidden: true })[0]!.parentElement!;
    expect(token.style.borderRadius).toBe(`${48 / 12}px`);
  });

  it("a file let go outside the window goes to the creator, not the tab", async () => {
    const d = deps();
    open(d);
    const dropped = new File(["x"], "near.png", { type: "image/png" });
    const transfer = {
      types: ["Files"],
      files: { length: 1, item: () => dropped },
      getData: () => "",
    };
    const over = new Event("dragover", { bubbles: true, cancelable: true });
    Object.defineProperty(over, "dataTransfer", { value: transfer });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: transfer });
    act(() => {
      document.body.dispatchEvent(over);
      document.body.dispatchEvent(drop);
    });
    expect(over.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.createObjectURL).toHaveBeenCalledWith(dropped);
  });

  it("text dragged within the link field stays the field's", () => {
    open();
    const field = screen.getByLabelText("Or a link to a picture");
    const kept = fireEvent.drop(field, {
      dataTransfer: {
        types: ["text/plain"],
        files: { length: 0, item: () => null },
        getData: (format: string) => (format === "text/plain" ? "abc" : ""),
      },
    });
    expect(kept).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a link edited while it loads offers nothing when the old one fails", async () => {
    const d = deps();
    const first = deferred<HTMLImageElement>();
    vi.mocked(d.load.loadImage)
      .mockReturnValueOnce(first.promise)
      .mockRejectedValue(new Error("404"));
    open(d);
    await loadLink("https://i.imgur.com/tpyo.png");
    fireEvent.change(screen.getByLabelText("Or a link to a picture"), {
      target: { value: "https://i.imgur.com/typo.png" },
    });
    await act(async () => first.reject(new Error("404")));
    await settle();
    expect(screen.queryByRole("button", { name: "Use the link as is" })).toBeNull();
  });

  it("editing the link clears a 'too long' alert about the old one", async () => {
    const d = deps();
    vi.mocked(d.load.loadImage).mockRejectedValue(new Error("404"));
    open(d);
    await loadLink(`https://i.imgur.com/${"a".repeat(LINK_MAX_LENGTH)}.png`);
    fireEvent.click(await screen.findByRole("button", { name: "Use the link as is" }));
    expect(screen.getByRole("alert")).toHaveTextContent("too long");
    fireEvent.change(screen.getByLabelText("Or a link to a picture"), {
      target: { value: "https://i.imgur.com/short.png" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("drops and pastes reach the window", () => {
  it("the title bar takes a drag-over and a drop, so the tab keeps the table", async () => {
    const d = deps();
    open(d);
    const title = screen.getByText("🖼️ Token picture: Eldryn");
    expect(fireEvent.dragOver(title)).toBe(false);
    const dropped = new File(["x"], "t.png", { type: "image/png" });
    expect(
      fireEvent.drop(title, {
        dataTransfer: { files: { length: 1, item: () => dropped }, getData: () => "" },
      }),
    ).toBe(false);
    await screen.findByRole("button", { name: /Rotate/ });
    expect(d.load.createObjectURL).toHaveBeenCalledWith(dropped);
  });

  it("an image pasted into the link field, with no text, loads", async () => {
    const d = deps();
    open(d);
    const paste = pasteEvent([new File(["s"], "shot.png", { type: "image/png" })]);
    act(() => {
      screen.getByLabelText("Or a link to a picture").dispatchEvent(paste);
    });
    expect(paste.defaultPrevented).toBe(true);
    await screen.findByRole("button", { name: /Rotate/ });
  });

  it("closing the older of two creators leaves the newer taking pastes", async () => {
    const first = deps();
    const second = deps();
    const older = open(first, "medium", "Goblin");
    open(second, "medium", "Orc");
    older.view.unmount();
    act(() => {
      document.dispatchEvent(pasteEvent([new File(["x"], "a.png", { type: "image/png" })]));
    });
    await waitFor(() => expect(second.load.createObjectURL).toHaveBeenCalled());
  });
});
