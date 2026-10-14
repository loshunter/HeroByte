/**
 * Shared fakes for the creator window's tests: a canvas that records its calls,
 * the injected decoder and upload, and the open/pick/settle steps.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { TokenSize } from "@herobyte/shared";
import type { BakeCanvas, BakeContext } from "../bake";
import { TokenCreatorWindow } from "../TokenCreatorWindow";
import type { TokenCreatorDeps } from "../useTokenCreator";

export const HASH = "b".repeat(64);
export const decoded = { naturalWidth: 300, naturalHeight: 600 } as HTMLImageElement;

/**
 * A canvas whose context records [name, ...args] (fillRect with the fillStyle it
 * paints, drawImage with the image it draws) and whose toBlob answers `type`.
 */
export function recordingCanvas(type = "image/webp") {
  const calls: Array<[string, ...unknown[]]> = [];
  const record =
    (name: string) =>
    (...args: unknown[]) =>
      void calls.push([name, ...args]);
  const context: BakeContext = {
    fillStyle: "",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillRect: (...args) => void calls.push(["fillRect", context.fillStyle, ...args]),
    createLinearGradient: (...args) => {
      calls.push(["createLinearGradient", ...args]);
      return {
        addColorStop: (...stop: unknown[]) => void calls.push(["addColorStop", ...stop]),
      } as unknown as CanvasGradient;
    },
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    scale: record("scale"),
    rotate: record("rotate"),
    drawImage: (image, ...args) => void calls.push(["drawImage", image, ...args]),
  };
  const canvas: BakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback) => callback(new Blob(["baked"], { type })),
  };
  return { canvas, calls };
}

export function uploaded() {
  return { hash: HASH, url: `/assets/${HASH}`, mime: "image/webp", size: 5, deduplicated: false };
}

export function deps(overrides: Partial<TokenCreatorDeps> = {}): TokenCreatorDeps {
  return {
    load: {
      createObjectURL: vi.fn(() => "blob:picked"),
      revokeObjectURL: vi.fn(),
      loadImage: vi.fn(async () => decoded),
      readableSource: vi.fn(async (url: string) => url),
      normalizeLink: vi.fn(async (url: string) => url),
    },
    bake: { createCanvas: () => recordingCanvas().canvas },
    upload: vi.fn(async () => uploaded()),
    getCredentials: () => ({ secret: "s" }),
    autoColor: () => "#334455",
    ...overrides,
  };
}

export function open(d = deps(), tokenSize: TokenSize = "huge", name = "Eldryn") {
  const onApply = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <TokenCreatorWindow
      name={name}
      tokenSize={tokenSize}
      onApply={onApply}
      onClose={onClose}
      deps={d}
    />,
  );
  return { onApply, onClose, d, view };
}

/** Let any bake and upload a click started run to the end. */
export async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function pickFile(type = "image/png") {
  const input = screen.getByLabelText("Token picture file");
  fireEvent.change(input, { target: { files: [new File(["x"], "art.png", { type })] } });
  await screen.findByRole("button", { name: /Rotate/ });
}

export async function loadLink(link: string) {
  fireEvent.change(screen.getByLabelText("Or a link to a picture"), { target: { value: link } });
  fireEvent.click(screen.getByRole("button", { name: "Load link" }));
}

/** A promise you resolve or reject from outside. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A paste event carrying `files` and `text`, aimed at `target`. */
export function pasteEvent(files: File[], text = "") {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: { length: files.length, item: (i: number) => files[i] ?? null },
      items: null,
      getData: (format: string) => (format === "text/plain" ? text : ""),
    },
  });
  return event;
}
