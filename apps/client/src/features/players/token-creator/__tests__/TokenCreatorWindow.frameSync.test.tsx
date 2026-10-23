/**
 * The creator window after review round 4 (C5a): what each Accept says it
 * sets, a frame nobody touched never sent (a sync replacing the token's frame
 * object while a picture uploads must not send the old frame back), and the
 * Frame tab's previews showing a picture not yet saved as it will be cropped.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultTokenFrame, presetFrame, type TokenFrame } from "@herobyte/shared";
import { TokenCreatorWindow } from "../TokenCreatorWindow";
import { acceptLabels } from "../acceptLabels";
import type { TokenFrameControl } from "../frameControl";
import { deferred, deps, pickFile, settle, uploaded } from "./creatorTestKit";

const control = (frame: TokenFrame | undefined, onApply = vi.fn()): TokenFrameControl => ({
  tokenId: "t1",
  frame,
  color: "#390076",
  onApply,
});

describe("what each Accept says", () => {
  it("names a frame only when it would change, on both tabs", () => {
    const idle = (hasPicture: boolean, hasFrame: boolean, frameChanged: boolean) => {
      const { picture, frame } = acceptLabels({
        phase: "idle",
        hasPicture,
        hasFrame,
        frameChanged,
      });
      return [picture, frame];
    };
    expect(idle(false, true, false)).toEqual(["Use this picture", "Use this frame"]);
    expect(idle(false, true, true)).toEqual(["Use picture + frame", "Use this frame"]);
    expect(idle(false, false, false)).toEqual(["Use this picture", "Use no frame"]);
    expect(idle(false, false, true)).toEqual(["Use picture, no frame", "Use no frame"]);
    expect(idle(true, true, false)).toEqual(["Use this picture", "Use this picture"]);
    expect(idle(true, true, true)).toEqual(["Use picture + frame", "Use frame + picture"]);
    expect(idle(true, false, false)).toEqual(["Use this picture", "Use this picture"]);
    expect(idle(true, false, true)).toEqual(["Use picture, no frame", "Use picture, no frame"]);
    const busy = acceptLabels({
      phase: "uploading",
      hasPicture: true,
      hasFrame: true,
      frameChanged: true,
    });
    expect([busy.picture, busy.frame]).toEqual(["Uploading…", "Uploading…"]);
  });

  it("titles a frame taken off as taken off", () => {
    const off = acceptLabels({
      phase: "idle",
      hasPicture: true,
      hasFrame: false,
      frameChanged: true,
    });
    expect(off.frameTitle).toMatch(/take the frame off$/);
    const same = acceptLabels({
      phase: "idle",
      hasPicture: true,
      hasFrame: false,
      frameChanged: false,
    });
    expect(same.frameTitle).not.toMatch(/frame/);
  });
});

describe("a frame nobody touched", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("is never sent with a picture, when a sync replaces the token's frame mid-upload", async () => {
    const onFrame = vi.fn();
    const upload = deferred<ReturnType<typeof uploaded>>();
    const d = deps({ upload: vi.fn(() => upload.promise) });
    const view = (frame: TokenFrame) => (
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={d}
        frame={control(frame, onFrame)}
        initialTab="picture"
      />
    );
    const { rerender } = render(view(defaultTokenFrame()));
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Use this picture" }));
    await settle();
    // another client restyles the token while the picture uploads: a new frame object arrives
    rerender(view(presetFrame("stone.castle")!));
    await act(async () => upload.resolve(uploaded()));
    await settle();
    expect(onFrame).not.toHaveBeenCalled();
  });
});

describe("a frame nobody touched, when a sync replaces it", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("is never offered as a change, not even for one render", async () => {
    const view = (frame: TokenFrame) => (
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={control(frame)}
        initialTab="picture"
      />
    );
    const { rerender } = render(view(defaultTokenFrame()));
    await pickFile();
    const seen: string[] = [];
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
    rerender(view(presetFrame("stone.castle")!)); // another client restyles the token
    for (const record of observer.takeRecords()) {
      seen.push(record.oldValue ?? "", record.target.textContent ?? "");
      record.addedNodes.forEach((node) => seen.push(node.textContent ?? ""));
      record.removedNodes.forEach((node) => seen.push(node.textContent ?? ""));
    }
    observer.disconnect();
    expect(seen.join(" ")).not.toMatch(/picture \+ frame|frame \+ picture/);
    expect(screen.getByRole("button", { name: "Use this picture" })).toBeInTheDocument();
  });
});

describe("a failure the Frame tab turns to show", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("is scrolled to, clear of the Accept bar, once its tab shows", async () => {
    const scrolled: Element[] = [];
    const scrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as never;
    const d = deps({ upload: vi.fn(async () => Promise.reject(new Error("Storage full"))) });
    render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={d}
        frame={control(defaultTokenFrame())}
        initialTab="picture"
      />,
    );
    await pickFile();
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    fireEvent.click(screen.getByRole("button", { name: "Castle stone" }));
    fireEvent.click(screen.getByRole("button", { name: "Use frame + picture" }));
    await settle();
    const alert = screen.getByRole("alert");
    // the window's own scroller, the one holding both the message and the bar
    expect(scrolled.some((scroller) => scroller.contains(alert))).toBe(true);
    Element.prototype.scrollTo = scrollTo;
  });
});

describe("the Frame tab's previews of a picture not yet saved", () => {
  it("draw it through its crop and turn, as the bake will", async () => {
    const calls: { canvas: string; name: string; args: unknown[] }[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      const label = this.getAttribute("aria-label") ?? "";
      return new Proxy({} as Record<string, unknown>, {
        get: (target, name: string) =>
          name in target
            ? target[name]
            : (...args: unknown[]) => {
                calls.push({ canvas: label, name, args });
                return { addColorStop: () => {} };
              },
        set: (target, name: string, value) => {
          target[name] = value;
          return true;
        },
      }) as never;
    } as never);
    render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={control(defaultTokenFrame())}
        initialTab="picture"
      />,
    );
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: /Rotate/ }));
    calls.length = 0;
    fireEvent.click(screen.getByRole("tab", { name: "Frame" }));
    const card = calls.filter((call) => call.canvas === "Preview at card size on the dark map");
    const token = 88 / (2 * 0.7); // the token in an 88 px preview (a circle frame's room)
    expect(card.find((call) => call.name === "translate")?.args[0]).toBeCloseTo(44 - token / 2);
    expect(card.some((call) => call.name === "rotate" && call.args[0] === Math.PI / 2)).toBe(true);
  });
});

describe("the previews of a polygon frame (C5b)", () => {
  it("trace the frame's shape on the Frame tab, at the room a polygon needs", () => {
    const calls: { canvas: string; name: string; args: unknown[] }[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      const label = this.getAttribute("aria-label") ?? "";
      return new Proxy({} as Record<string, unknown>, {
        get: (target, name: string) =>
          name in target
            ? target[name]
            : (...args: unknown[]) => {
                calls.push({ canvas: label, name, args });
                return { addColorStop: () => {} };
              },
        set: (target, name: string, value) => {
          target[name] = value;
          return true;
        },
      }) as never;
    } as never);
    render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={control({ ...defaultTokenFrame(), shape: "hexagon" })}
        initialTab="frame"
      />,
    );
    const card = calls.filter((call) => call.canvas === "Preview at card size on the dark map");
    expect(card.some((call) => call.name === "arc")).toBe(false);
    const token = 88 / (2 * 0.74);
    const start = card.find((call) => call.name === "moveTo")!;
    expect(start.args[0]).toBeCloseTo(44);
    expect(start.args[1]).toBeCloseTo(44 - 0.5 * Math.cos(Math.PI / 6) * token);
    expect(card.filter((call) => call.name === "lineTo").length).toBeGreaterThanOrEqual(6);
  });

  it("show the picture in the shape on the Picture tab's small previews", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(
      <TokenCreatorWindow
        onApply={vi.fn()}
        onClose={vi.fn()}
        deps={deps()}
        frame={control({ ...defaultTokenFrame(), shape: "shield" })}
        initialTab="picture"
      />,
    );
    await pickFile();
    const previews = screen.getByRole("group", { name: "Preview at token size" });
    const clipped = [...previews.querySelectorAll("div")].filter((div) => div.style.clipPath);
    expect(clipped).toHaveLength(3); // the dark map, the light map, the fog
    expect(clipped[0]!.style.clipPath).toMatch(/^polygon\(/);
  });
});
