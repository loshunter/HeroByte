import React, { createContext, useContext } from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { Box, Rec } from "./data";
import { C, H, PIXEL, W } from "./theme";

/** Where a recording sits on screen right now, and how its camera is zoomed. */
export type Panel = { x: number; y: number; w: number; h: number; s: number; cx: number; cy: number; label?: string; opacity: number; phone?: boolean };

/** A recording's frame at output scale: 1920 wide, as tall as its aspect needs (a phone is tall). */
export const frameOf = (rec: Rec) => ({ VW: W, VH: (W * rec.view.height) / rec.view.width });

export type StageGeom = {
  panels: Record<string, Panel>;
  recs: Record<string, Rec>;
};

const Ctx = createContext<StageGeom | null>(null);
export const StageProvider = Ctx.Provider;

/** A captured box (CSS px of the recorded page) in output pixels, through camera and panel. */
export function toScreen(geom: StageGeom, who: string, box: Box): Box {
  const panel = geom.panels[who];
  const rec = geom.recs[who];
  const { VW, VH } = frameOf(rec);
  const k = VW / rec.view.width; // recorded CSS px -> unzoomed frame
  const vx = (box.x * k - panel.cx) * panel.s + VW / 2;
  const vy = (box.y * k - panel.cy) * panel.s + VH / 2;
  const f = panel.w / VW;
  return { x: panel.x + vx * f, y: panel.y + vy * f, width: box.width * k * panel.s * f, height: box.height * k * panel.s * f };
}

export function useStage() {
  const geom = useContext(Ctx);
  if (!geom) throw new Error("useStage outside a chapter");
  return geom;
}

/** One recording, framed by its panel and camera. */
export const FootagePanel: React.FC<{ who: string; panel: Panel; rec: Rec }> = ({ panel, rec }) => {
  const { VW, VH } = frameOf(rec);
  const f = panel.w / VW;
  const inset = panel.w < W;
  return (
    <div
      style={{
        position: "absolute",
        left: panel.x,
        top: panel.y,
        width: panel.w,
        height: panel.h,
        overflow: "hidden",
        opacity: panel.opacity,
        borderRadius: panel.phone ? 40 : inset ? 14 : 0,
        boxShadow: panel.phone
          ? `0 0 0 14px #050608, 0 0 0 19px ${C.gold}, 14px 16px 0 19px ${C.shadow}`
          : inset
            ? `0 0 0 4px ${C.gold}, 10px 12px 0 4px ${C.shadow}`
            : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: VW,
          height: VH,
          transformOrigin: "0 0",
          transform: `scale(${f}) translate(${VW / 2}px, ${VH / 2}px) scale(${panel.s}) translate(${-panel.cx}px, ${-panel.cy}px)`,
        }}
      >
        <OffthreadVideo src={staticFile(rec.src)} muted style={{ width: VW, height: VH }} />
      </div>
      {panel.label && inset ? (
        <div
          style={{
            position: "absolute",
            left: panel.phone ? "50%" : 18,
            top: panel.phone ? 26 : 16,
            transform: panel.phone ? "translateX(-50%)" : undefined,
            whiteSpace: "nowrap",
            padding: "10px 16px 9px",
            background: C.gold,
            color: C.goldInk,
            fontFamily: PIXEL,
            fontSize: 20,
            borderRadius: 6,
            boxShadow: `4px 4px 0 ${C.shadow}`,
          }}
        >
          {panel.label}
        </div>
      ) : null}
    </div>
  );
};

export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 50% 40%, ${C.bg2} 0%, ${C.bg} 70%)`,
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${C.line} 2px, transparent 2px), linear-gradient(90deg, ${C.line} 2px, transparent 2px)`,
        backgroundSize: "64px 64px",
        opacity: 0.45,
      }}
    />
  </AbsoluteFill>
);
