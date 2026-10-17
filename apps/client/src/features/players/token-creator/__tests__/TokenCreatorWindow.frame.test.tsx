/**
 * The Frame tab (C5a) in the creator window: there only when the card hands a
 * frame control; every knob edits a draft; "Use this frame" sends the draft
 * once and closes, Cancel sends nothing; "No frame" sends null. The bake is
 * left to its own tests (jsdom draws no bitmap, and the previews stay blank).
 */

import { fireEvent, render, screen } from "@testing-library/react";
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
import { deps } from "./creatorTestKit";

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
