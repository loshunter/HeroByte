/**
 * The Frame tab (C5a) in the creator window: there only when the card hands a
 * frame control; every knob edits a draft; "Use this frame" sends the draft
 * once and closes, Cancel sends nothing; "No frame" sends null. The bake is
 * left to its own tests (jsdom draws no bitmap, and the previews stay blank).
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultTokenFrame,
  frameWeight,
  presetFrame,
  sanitizeTokenFrame,
  type TokenFrame,
} from "@herobyte/shared";
import { TokenCreatorWindow } from "../TokenCreatorWindow";
import { TokenPictureControl } from "../TokenPictureControl";
import type { TokenFrameControl } from "../frameControl";
import { deferred, deps, loadLink, pickFile, settle, uploaded } from "./creatorTestKit";

function control(frame: TokenFrame | undefined = defaultTokenFrame()) {
  const onApply = vi.fn<(frame: TokenFrame | null) => void>();
  const value: TokenFrameControl = { tokenId: "t1", frame, color: "#390076", onApply };
  return { value, onApply };
}
function open(frame: TokenFrameControl | undefined, onClose = vi.fn()) {
  render(
    <TokenCreatorWindow
      name="Eldryn"
      onApply={vi.fn()}
      onClose={onClose}
      deps={deps()}
      frame={frame}
      initialTab="frame"
    />,
  );
  return { onClose };
}
// jsdom has no 2D canvas, and says so on every call: the previews draw nothing here.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

const press = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const sent = (onApply: ReturnType<typeof control>["onApply"]) => onApply.mock.calls.at(-1)![0];

describe("the Frame tab", () => {
  it("is there only when the card hands the window a frame control", () => {
    open(undefined);
    expect(screen.queryByRole("tab", { name: "Frame" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens on the Frame tab with the token's frame chosen, titled for both", () => {
    open(control().value);
    expect(screen.getByRole("tab", { name: "Frame" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Plain ring" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Art & frame: Eldryn/)).toBeInTheDocument();
    for (const group of ["Plain frames", "Stone frames", "Metal frames", "Wood frames"]) {
      expect(screen.getByRole("group", { name: group })).toBeInTheDocument();
    }
  });

  it("sends the picked preset at the chosen weight and growth, once, then closes", () => {
    const { value, onApply } = control();
    const { onClose } = open(value);
    press("Welded steel");
    press("Slab");
    press("Grow out");
    press("Use this frame");
    expect(onApply).toHaveBeenCalledTimes(1);
    const frame = sent(onApply)!;
    expect(frame.preset).toBe("metal.welded");
    expect(frame.growth).toBe("out");
    expect(frameWeight(frame)).toBeCloseTo(0.24);
    expect(frame.bands).toHaveLength(3);
    expect(sanitizeTokenFrame(frame)).toHaveProperty("frame"); // the server would take it
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the weight and colour when another preset is picked", () => {
    const { value, onApply } = control();
    open(value);
    press("Bold");
    fireEvent.change(screen.getByLabelText("Custom frame colour"), {
      target: { value: "#14254A" },
    });
    press("Castle stone");
    press("Use this frame");
    const frame = sent(onApply)!;
    expect(frame.preset).toBe("stone.castle");
    expect(frame.accent).toBe("#14254a");
    expect(frameWeight(frame)).toBeCloseTo(0.16);
  });

  it("offers glow colour and strength only for a preset that glows", () => {
    const { value, onApply } = control();
    open(value);
    expect(screen.queryByLabelText("Glow strength")).toBeNull();
    press("Cracked stone");
    fireEvent.change(screen.getByLabelText("Glow strength"), { target: { value: "0.3" } });
    fireEvent.change(screen.getByLabelText("Custom glow colour"), { target: { value: "#ff8800" } });
    press("Use this frame");
    expect(sent(onApply)!.bands[0]!.glow).toEqual({ color: "#ff8800", strength: 0.3 });
  });

  it("moves the weight with the slider and takes the frame off with No frame", () => {
    const { value, onApply } = control(presetFrame("stone.castle"));
    open(value);
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "0.2" } });
    press("Use this frame");
    expect(frameWeight(sent(onApply)!)).toBeCloseTo(0.2);
    press("No frame");
    expect(screen.getByRole("button", { name: "Use no frame" })).toBeInTheDocument();
    press("Use no frame");
    expect(sent(onApply)).toBeNull();
  });

  it("sends nothing on Cancel", () => {
    const { value, onApply } = control();
    open(value);
    press("Castle stone");
    press("Cancel");
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("the Frame tab, after review", () => {
  it("offers a frame colour only for frames that take one", () => {
    open(control().value);
    expect(screen.getByLabelText("Custom frame colour")).toBeInTheDocument();
    press("Castle stone");
    expect(screen.queryByLabelText("Custom frame colour")).toBeNull();
    expect(screen.getByText("This material has its own colours.")).toBeInTheDocument();
  });

  it("starts the custom pickers at an older table's hsl colour, not grey", () => {
    const value = { ...control().value, color: "hsl(120, 70%, 50%)" };
    open(value);
    expect(screen.getByLabelText("Custom frame colour")).toHaveValue("#26d926");
  });

  it("turns to the Picture tab when a picture is pasted, and with the arrow keys", () => {
    open(control().value);
    const file = new File(["x"], "art.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true }) as unknown as ClipboardEvent;
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: () => "",
        files: { length: 1, 0: file, item: () => file },
        items: { length: 1, 0: { kind: "file", type: file.type, getAsFile: () => file } },
        types: ["Files"],
      },
    });
    act(() => {
      document.dispatchEvent(paste);
    });
    expect(screen.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Picture" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Frame" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Frame" })).toHaveAttribute("tabindex", "0");
  });

  it("follows the settings window's buttons while it is open", () => {
    const { value } = control();
    const { rerender } = render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={value}
        initialTab="frame"
      />,
    );
    rerender(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={value}
        initialTab="picture"
      />,
    );
    expect(screen.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("the settings window's frame button", () => {
  it("names the frame the token wears and opens the creator on the Frame tab", async () => {
    const { value } = control(presetFrame("wood.oak"));
    render(
      <TokenPictureControl
        onApply={vi.fn()}
        frame={value}
        loadWindow={async () => ({
          default: (props) => <TokenCreatorWindow {...props} deps={deps()} />,
        })}
      />,
    );
    expect(screen.getByText("Token picture & frame")).toBeInTheDocument();
    press("Token frame… (Oak planks)");
    expect(await screen.findByRole("tab", { name: "Frame" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("is absent without a frame control, and says No frame for a frameless token", () => {
    const { rerender } = render(<TokenPictureControl onApply={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Token frame/ })).toBeNull();
    const frameless = { ...control().value, frame: undefined };
    rerender(<TokenPictureControl onApply={vi.fn()} frame={frameless} />);
    expect(screen.getByRole("button", { name: "Token frame… (No frame)" })).toBeInTheDocument();
  });
});

describe("the Frame tab, after review round 2", () => {
  it("saves a picture loaded on the Picture tab when the frame is accepted, not dropping it", async () => {
    const { value, onApply } = control();
    const d = deps();
    const onPicture = vi.fn();
    const onClose = vi.fn();
    render(
      <TokenCreatorWindow
        onApply={onPicture}
        onClose={onClose}
        deps={d}
        frame={value}
        initialTab="picture"
      />,
    );
    await pickFile();
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    press("Welded steel");
    press("Use frame + picture"); // the label names both
    await settle();
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(d.upload).toHaveBeenCalledTimes(1);
    expect(onPicture).toHaveBeenCalledTimes(1);
  });

  it("sends the frame picked meanwhile when the picture is accepted", async () => {
    const { value, onApply } = control();
    render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={value}
        initialTab="frame"
      />,
    );
    press("Castle stone");
    fireEvent.click(screen.getByRole("tab", { name: "Picture" }));
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use picture + frame" }));
    await settle();
    expect(sent(onApply)!.preset).toBe("stone.castle");
  });

  it("moves focus with the arrow keys inside its own window when two are open", () => {
    render(
      <>
        <TokenCreatorWindow
          name="A"
          onApply={vi.fn()}
          onClose={vi.fn()}
          deps={deps()}
          frame={control().value}
        />
        <TokenCreatorWindow
          name="B"
          onApply={vi.fn()}
          onClose={vi.fn()}
          deps={deps()}
          frame={control().value}
        />
      </>,
    );
    const pictureTabs = screen.getAllByRole("tab", { name: "Picture" });
    fireEvent.keyDown(pictureTabs[1]!, { key: "ArrowRight" });
    const frameTabs = screen.getAllByRole("tab", { name: "Frame" });
    expect(document.activeElement).toBe(frameTabs[1]);
    expect(frameTabs[0]).toHaveAttribute("aria-selected", "false");
    expect(frameTabs[0]!.id).not.toBe(frameTabs[1]!.id);
  });

  it("turns back to the Frame tab when Token frame… is pressed again", async () => {
    render(
      <TokenPictureControl
        onApply={vi.fn()}
        frame={control().value}
        loadWindow={async () => ({
          default: (props) => <TokenCreatorWindow {...props} deps={deps()} />,
        })}
      />,
    );
    press("Token frame… (Plain ring)");
    fireEvent.click(await screen.findByRole("tab", { name: "Picture" }));
    press("Token frame… (Plain ring)");
    expect(screen.getByRole("tab", { name: "Frame" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("the Frame tab, after review round 3", () => {
  const openOn = (value: TokenFrameControl, d = deps(), tab: "picture" | "frame" = "picture") => {
    const onPicture = vi.fn();
    const onClose = vi.fn();
    render(
      <TokenCreatorWindow
        onApply={onPicture}
        onClose={onClose}
        deps={d}
        frame={value}
        initialTab={tab}
      />,
    );
    return { onPicture, onClose };
  };

  it("sends no frame when the picture it goes with fails, and turns to show why", async () => {
    const { value, onApply } = control();
    const d = deps({ upload: vi.fn(async () => Promise.reject(new Error("Storage full"))) });
    const { onPicture, onClose } = openOn(value, d);
    await pickFile();
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    press("Welded steel");
    press("Use frame + picture");
    await settle();
    expect(onApply).not.toHaveBeenCalled();
    expect(onPicture).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Picture" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Storage full");
    press("Cancel");
    expect(onApply).not.toHaveBeenCalled(); // Cancel leaves the token as it was
  });

  it("sends a frame picked while the picture uploads, with the picture, and shows the upload", async () => {
    const { value, onApply } = control();
    const upload = deferred<ReturnType<typeof uploaded>>();
    const { onPicture } = openOn(value, deps({ upload: vi.fn(() => upload.promise) }));
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await settle();
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    press("Castle stone");
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeInTheDocument();
    press("Uploading…"); // waits: the save in flight takes the frame along
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => upload.resolve(uploaded()));
    await settle();
    expect(onPicture).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(sent(onApply)!.preset).toBe("stone.castle");
  });

  it("takes the frame picked along when a link is used as is", async () => {
    const { value, onApply } = control();
    const { onPicture } = openOn(value, deps(), "frame");
    press("Castle stone");
    fireEvent.click(screen.getByRole("tab", { name: "Picture" }));
    await loadLink("https://example.com/art.png");
    fireEvent.click(await screen.findByRole("button", { name: /Use the link as is/ }));
    expect(onPicture).toHaveBeenCalledWith("https://example.com/art.png");
    expect(sent(onApply)!.preset).toBe("stone.castle");
  });
  it("draws no hidden preview while the picture is cropped on the Picture tab", async () => {
    const { value } = control();
    openOn(value);
    await pickFile();
    const getContext = vi.mocked(HTMLCanvasElement.prototype.getContext);
    const previewDraws = () =>
      getContext.mock.contexts.filter((canvas) =>
        (canvas as HTMLCanvasElement).getAttribute("aria-label")?.startsWith("Preview at"),
      ).length;
    const before = previewDraws();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: /Rotate/ }));
    expect(previewDraws()).toBe(before);
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    expect(previewDraws()).toBeGreaterThan(before); // shown, they draw
  });
});

describe("the Frame tab's shapes and notch (C5b)", () => {
  it("sends the shape and the notch picked, and keeps both when the material changes", () => {
    const { value, onApply } = control();
    open(value);
    press("Hexagon");
    press("Facing notch");
    press("Castle stone"); // a new material keeps the token's shape and notch
    expect(screen.getByRole("button", { name: "Hexagon" })).toHaveAttribute("aria-pressed", "true");
    press("Use this frame");
    const frame = sent(onApply)!;
    expect(frame.preset).toBe("stone.castle");
    expect(frame.shape).toBe("hexagon");
    expect(frame.notch).toEqual({ gem: "arrow" });
    expect(sanitizeTokenFrame(frame)).toHaveProperty("frame");
  });

  it("takes the notch off again, and offers the frame colour for the gem", () => {
    const { value, onApply } = control();
    open(value);
    press("Castle stone");
    expect(screen.queryByRole("group", { name: "Frame colour" })).toBeNull();
    press("Facing notch");
    expect(screen.getByRole("group", { name: "Frame colour" })).toBeInTheDocument(); // the gem's
    press("Facing notch");
    press("Use this frame");
    expect(sent(onApply)).not.toHaveProperty("notch");
  });

  it("frames the picture in the shape on the Picture tab", async () => {
    const { value } = control();
    open(value);
    press("Shield");
    fireEvent.click(screen.getByRole("tab", { name: "Picture" }));
    await pickFile();
    const crop = screen.getByTestId("token-creator-crop");
    expect(crop.style.clipPath).toMatch(/^polygon\(50\.00% 0\.00%, /);
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    press("Circle");
    fireEvent.click(screen.getByRole("tab", { name: "Picture" }));
    expect(screen.getByTestId("token-creator-crop").style.clipPath).toBe("");
  });
});
