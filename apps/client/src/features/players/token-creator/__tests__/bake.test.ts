/**
 * The bake, through a recording fake canvas (jsdom has none). What this pins:
 * the WebP → PNG fallback reads the blob's TYPE (Safari's silent PNG), a
 * tainted canvas becomes a named error, and the backdrop is painted before
 * the picture with the placement the crop math gave.
 */

import { describe, expect, it, vi } from "vitest";
import {
  BAKE_EDGE,
  BAKE_EDGE_LARGE,
  TaintedPictureError,
  bakeEdgeFor,
  bakePicture,
  encodePicture,
  type BakeCanvas,
  type BakeContext,
} from "../bake";
import { DEFAULT_CROP, rotateClockwise } from "../cropMath";

const SOURCE = { width: 300, height: 600 };
const image = {} as CanvasImageSource;

function recorder() {
  const calls: Array<[string, ...unknown[]]> = [];
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  const context: BakeContext = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    fillRect: (...args) => calls.push(["fillRect", context.fillStyle, ...args]),
    createLinearGradient: (...args) => {
      calls.push(["createLinearGradient", ...args]);
      return gradient;
    },
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    translate: (...args) => calls.push(["translate", ...args]),
    scale: (...args) => calls.push(["scale", ...args]),
    rotate: (...args) => calls.push(["rotate", ...args]),
    drawImage: (_image, ...args) => calls.push(["drawImage", ...args]),
  };
  return { calls, context, gradient };
}

function canvasAnswering(answers: Array<Blob | null | Error>, context?: BakeContext) {
  const requests: Array<{ type?: string; quality?: number }> = [];
  const canvas: BakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => context ?? recorder().context,
    toBlob: (callback, type, quality) => {
      requests.push({ type, quality });
      const answer = answers.shift() ?? null;
      if (answer instanceof Error) throw answer;
      callback(answer);
    },
  };
  return { canvas, requests };
}

describe("encodePicture", () => {
  it("keeps a WebP answer as WebP at quality 0.85", async () => {
    const { canvas, requests } = canvasAnswering([new Blob(["w"], { type: "image/webp" })]);
    const result = await encodePicture(canvas);
    expect(result.mime).toBe("image/webp");
    expect(requests).toEqual([{ type: "image/webp", quality: 0.85 }]);
  });

  it("names Safari's silent PNG answer a PNG, without encoding twice", async () => {
    const { canvas, requests } = canvasAnswering([new Blob(["p"], { type: "image/png" })]);
    const result = await encodePicture(canvas);
    expect(result.mime).toBe("image/png");
    expect(result.blob.type).toBe("image/png");
    expect(requests).toHaveLength(1);
  });

  it("encodes again as PNG when the answer has no type, and labels it", async () => {
    const { canvas, requests } = canvasAnswering([new Blob(["?"]), new Blob(["p"])]);
    const result = await encodePicture(canvas);
    expect(requests.map((r) => r.type)).toEqual(["image/webp", "image/png"]);
    expect(result).toMatchObject({ mime: "image/png" });
    expect(result.blob.type).toBe("image/png");
  });

  it("turns a tainted canvas into TaintedPictureError", async () => {
    const security = Object.assign(new Error("tainted"), { name: "SecurityError" });
    const { canvas } = canvasAnswering([security]);
    await expect(encodePicture(canvas)).rejects.toBeInstanceOf(TaintedPictureError);
  });
});

describe("bakePicture", () => {
  it("bakes Huge and Gargantuan at 768, everything else at 512", () => {
    expect(bakeEdgeFor("gargantuan")).toBe(BAKE_EDGE_LARGE);
    expect(bakeEdgeFor("huge")).toBe(BAKE_EDGE_LARGE);
    expect(bakeEdgeFor("large")).toBe(BAKE_EDGE);
    expect(bakeEdgeFor(undefined)).toBe(BAKE_EDGE);
  });

  it("paints the solid backdrop first, then the placed picture", async () => {
    const { calls, context } = recorder();
    const { canvas } = canvasAnswering([new Blob(["w"], { type: "image/webp" })], context);
    const baked = await bakePicture(
      image,
      SOURCE,
      rotateClockwise(DEFAULT_CROP, SOURCE),
      { kind: "solid", color: "#123456" },
      512,
      { createCanvas: () => canvas },
    );
    expect(baked).toMatchObject({ mime: "image/webp", fileName: "token.webp", edge: 512 });
    expect(canvas.width).toBe(512);
    expect(calls[0]).toEqual(["fillRect", "#123456", 0, 0, 512, 512]);
    expect(calls.slice(1)).toEqual([
      ["save"],
      ["translate", 256, 256],
      ["scale", 1, 1],
      ["rotate", Math.PI / 2],
      // A 1:2 picture covering 512: 512 wide, 1024 tall, drawn centred.
      ["drawImage", -256, -512, 512, 1024],
      ["restore"],
    ]);
  });

  it("paints no backdrop for 'none', so transparency survives", async () => {
    const { calls, context } = recorder();
    const { canvas } = canvasAnswering([new Blob(["w"], { type: "image/webp" })], context);
    await bakePicture(image, SOURCE, DEFAULT_CROP, { kind: "none" }, 512, {
      createCanvas: () => canvas,
    });
    expect(calls.some(([name]) => name === "fillRect")).toBe(false);
  });

  it("paints a gradient top to bottom", async () => {
    const { calls, context, gradient } = recorder();
    const { canvas } = canvasAnswering([new Blob(["w"], { type: "image/webp" })], context);
    await bakePicture(
      image,
      SOURCE,
      DEFAULT_CROP,
      { kind: "gradient", from: "#ffffff", to: "#000000" },
      768,
      { createCanvas: () => canvas },
    );
    expect(calls[0]).toEqual(["createLinearGradient", 0, 0, 0, 768]);
    expect(gradient.addColorStop).toHaveBeenCalledWith(0, "#ffffff");
    expect(gradient.addColorStop).toHaveBeenCalledWith(1, "#000000");
    expect(calls[1]?.[0]).toBe("fillRect");
  });

  it("names a PNG fallback token.png", async () => {
    const { canvas } = canvasAnswering([new Blob(["p"], { type: "image/png" })]);
    const baked = await bakePicture(image, SOURCE, DEFAULT_CROP, { kind: "none" }, 512, {
      createCanvas: () => canvas,
    });
    expect(baked.fileName).toBe("token.png");
  });
});
