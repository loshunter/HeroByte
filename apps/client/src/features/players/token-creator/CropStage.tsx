// ============================================================================
// TOKEN CREATOR — THE CROP AREA
// ============================================================================
// The token's square at working size. Drag moves the picture, the wheel and
// a pinch zoom about the pointer (or between the fingers), arrow keys nudge
// and +/- zoom (drops land on the window around it). Placement is in percent of the square,
// from the same plan the bake draws with.
//
// Pinch is two pointers on one element with `touch-action: none`, pointer
// capture per finger (the InitiativeModifierDial precedent): no browser
// gesture competes, and a finger that slides off the square still steers.

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { cssBackground, type BackdropFill } from "./backdrop";
import {
  cssPlacement,
  panBy,
  placementFor,
  zoomAbout,
  type CropState,
  type Size,
} from "./cropMath";
import type { LoadedPicture } from "./pictureSources";

interface CropStageProps {
  picture: LoadedPicture | null;
  crop: CropState;
  onCrop: (update: (crop: CropState) => CropState) => void;
  fill: BackdropFill;
  /** The map's corner as a share of the side (see TokenCreatorWindow). */
  corner: number;
}

const NUDGE = 0.02;
const WHEEL_RATE = 0.0015;
const KEY_ZOOM = 1.1;

/** The transparent-art checkerboard: what "no backdrop" looks like. */
const CHECKER = "repeating-conic-gradient(#3a3646 0% 25%, #24212d 0% 50%) 50% / 16px 16px";

type Point = { x: number; y: number };

/** The window around it takes drops (TokenCreatorWindow); the square shows the hint. */
export function CropStage({ picture, crop, onCrop, fill, corner }: CropStageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const sizeRef = useRef<Size | null>(null);
  sizeRef.current = picture?.size ?? null;

  /**
   * A client point as box edges from the square's centre, plus the square's width.
   * The square is its padding box (the picture's box): the 2 px border is outside it.
   */
  const toBox = (point: Point): { at: Point; px: number } => {
    const box = boxRef.current;
    const rect = box?.getBoundingClientRect();
    const px = box?.clientWidth || rect?.width || 1;
    const left = (rect?.left ?? 0) + (box?.clientLeft ?? 0);
    const top = (rect?.top ?? 0) + (box?.clientTop ?? 0);
    return { at: { x: (point.x - left) / px - 0.5, y: (point.y - top) / px - 0.5 }, px };
  };

  // The wheel needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      const size = sizeRef.current;
      if (!size) return;
      event.preventDefault();
      const { at } = toBox({ x: event.clientX, y: event.clientY });
      const factor = Math.exp(-event.deltaY * WHEEL_RATE);
      onCrop((current) => zoomAbout(current, size, factor, at));
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [onCrop]);

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // The primary button only: a right-click's context menu swallows its pointerup.
    if (!picture || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const size = sizeRef.current;
    const previous = pointers.current.get(event.pointerId);
    if (!size || !previous) return;
    // A mouse whose release never reached us (it left the window, a menu ate it).
    if (event.pointerType === "mouse" && event.buttons === 0) {
      pointers.current.delete(event.pointerId);
      return;
    }
    const before = pinchState();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      const { px } = toBox(previous);
      const dx = (event.clientX - previous.x) / px;
      const dy = (event.clientY - previous.y) / px;
      onCrop((current) => panBy(current, size, dx, dy));
      return;
    }
    const after = pinchState();
    if (!before || !after || before.distance === 0) return;
    const { at, px } = toBox(after.middle);
    const dx = (after.middle.x - before.middle.x) / px;
    const dy = (after.middle.y - before.middle.y) / px;
    const factor = after.distance / before.distance;
    onCrop((current) => zoomAbout(panBy(current, size, dx, dy), size, factor, at));
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const size = sizeRef.current;
    if (!size) return;
    const step = event.shiftKey ? NUDGE * 5 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    let update: ((crop: CropState) => CropState) | null = null;
    if (move) update = (current) => panBy(current, size, move[0], move[1]);
    else if (event.key === "+" || event.key === "=")
      update = (current) => zoomAbout(current, size, KEY_ZOOM);
    else if (event.key === "-") update = (current) => zoomAbout(current, size, 1 / KEY_ZOOM);
    if (!update) return;
    // Arrow keys move the picture here, never a token on the map behind.
    event.preventDefault();
    event.stopPropagation();
    onCrop(update);
  };

  const placed = picture ? cssPlacement(placementFor(crop, picture.size, 100)) : null;
  const imageStyle: CSSProperties | undefined = placed
    ? {
        position: "absolute",
        left: `${placed.left}%`,
        top: `${placed.top}%`,
        width: `${placed.width}%`,
        height: `${placed.height}%`,
        transform: placed.transform,
        maxWidth: "none",
        pointerEvents: "none",
        userSelect: "none",
      }
    : undefined;

  return (
    <div
      ref={boxRef}
      role="group"
      aria-label={
        picture
          ? "Crop area: drag to move, wheel or pinch to zoom, arrow keys nudge"
          : "Drop or paste a picture here"
      }
      tabIndex={0}
      data-testid="token-creator-crop"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onKeyDown={onKeyDown}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "280px",
        aspectRatio: "1 / 1",
        margin: "0 auto",
        overflow: "hidden",
        borderRadius: `${corner * 100}%`,
        border: "2px solid var(--jrpg-border-gold)",
        background: fill.kind === "none" ? CHECKER : cssBackground(fill),
        touchAction: "none",
        cursor: picture ? "grab" : "default",
      }}
    >
      {picture && placed ? (
        <img src={picture.displaySrc} alt="" draggable={false} style={imageStyle} />
      ) : (
        <p
          className="jrpg-text-small"
          style={{
            position: "absolute",
            inset: 0,
            margin: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px",
            color: "var(--jrpg-white)",
          }}
        >
          Drop a picture here, paste one, or choose a file below.
        </p>
      )}
    </div>
  );
}
