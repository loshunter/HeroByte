import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { Box } from "./data";
import { bounce, clamp01, easeInOut, lerp, popState, prog } from "./motion";
import { toScreen, useStage } from "./stage";
import { C, H, PIXEL, SANS, W } from "./theme";

export type TargetRef = { who: string; box: Box };

const CAPTION_TOP = 930; // keep popups clear of the captions

function useTargetBox(target?: TargetRef) {
  const geom = useStage();
  return target ? toScreen(geom, target.who, target.box) : undefined;
}

/** Pixel sparkles bursting out of a point: the "it landed" moment. */
export const Sparkles: React.FC<{ x: number; y: number; start: number; seed: string; count?: number; spread?: number }> = ({
  x,
  y,
  start,
  seed,
  count = 14,
  spread = 150,
}) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < 0 || t > 26) return null;
  const colors = [C.gold, C.ink, C.blue2, C.gold, C.green];
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + random(`${seed}a${i}`) * 0.6;
        const d = (0.5 + random(`${seed}d${i}`) * 0.7) * spread * Math.min(1, t / 9);
        const size = 6 + Math.round(random(`${seed}s${i}`) * 3) * 3;
        const fall = Math.max(0, t - 8) ** 2 * 0.35;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * d - size / 2,
              top: y + Math.sin(a) * d + fall - size / 2,
              width: size,
              height: size,
              background: colors[i % colors.length],
              opacity: 1 - clamp01((t - 14) / 12),
              transform: `rotate(${t * 9 + i * 20}deg)`,
              boxShadow: `2px 2px 0 ${C.shadow}`,
            }}
          />
        );
      })}
    </>
  );
};

/** A pulsing gold ring around a control. */
export const Ring: React.FC<{ start: number; end: number; target: TargetRef }> = ({ start, end, target }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const box = useTargetBox(target);
  const p = popState(frame, fps, start, end, { tilt: 0 });
  if (!p.visible || !box) return null;
  const pulse = 1 + Math.sin(frame / 5) * 0.035;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x - 10,
        top: box.y - 10,
        width: box.width + 20,
        height: box.height + 20,
        border: `5px solid ${C.gold}`,
        borderRadius: 14,
        boxShadow: `0 0 0 4px ${C.shadow}, 0 0 34px 8px rgba(243,198,78,${0.35 + Math.sin(frame / 5) * 0.15})`,
        transform: `scale(${(2 - p.scale) * pulse})`,
        opacity: p.opacity * Math.min(1, p.scale * 1.4),
      }}
    />
  );
};

/** A chunky pixel arrow that bounces toward its target. `angle` is the direction it points. */
const Arrow: React.FC<{ x: number; y: number; angle: number; frame: number; scale: number }> = ({ x, y, angle, frame, scale }) => {
  const b = bounce(frame, 14, 12);
  const dx = Math.cos(angle) * -b;
  const dy = Math.sin(angle) * -b;
  return (
    <svg
      width={74}
      height={74}
      viewBox="-37 -37 74 74"
      style={{
        position: "absolute",
        left: x - 37 + dx,
        top: y - 37 + dy,
        transform: `rotate(${(angle * 180) / Math.PI}deg) scale(${scale})`,
        overflow: "visible",
        filter: `drop-shadow(4px 4px 0 ${C.shadow})`,
      }}
    >
      <path d="M 30 0 L 2 -26 L 2 -11 L -30 -11 L -30 11 L 2 11 L 2 26 Z" fill={C.gold} stroke={C.goldInk} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
};

export type PopupSpec = {
  start: number;
  end: number;
  title?: string;
  lines?: string[];
  icon?: string;
  tone?: "gold" | "blue" | "green" | "red";
  target?: TargetRef;
  /** Screen point when there is no target (the popup's centre). */
  pos?: { x: number; y: number };
  side?: "auto" | "above" | "below" | "left" | "right";
  width?: number;
  seed: string;
  /** Line i appears at lineAt[i] (frames, chapter-local); default staggered. */
  lineAt?: number[];
};

const toneColor = (tone: PopupSpec["tone"]) =>
  tone === "blue" ? C.blue2 : tone === "green" ? C.green : tone === "red" ? C.red : C.gold;

/** The JRPG explainer window: springs in, types its title, points at the control it explains. */
export const Popup: React.FC<PopupSpec> = (spec) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const box = useTargetBox(spec.target);
  const p = popState(frame, fps, spec.start, spec.end);
  if (!p.visible) return null;
  const accent = toneColor(spec.tone);
  const width = spec.width ?? 520;
  const lines = spec.lines ?? [];
  const estH = 40 + (spec.title ? 52 : 0) + lines.length * 46;
  let x: number;
  let y: number;
  let arrow: { x: number; y: number; angle: number } | undefined;
  let origin = "50% 50%";
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    let side = spec.side ?? "auto";
    if (side === "auto") side = cy > H * 0.5 ? "above" : "below";
    const gap = 84;
    if (side === "above" || side === "below") {
      x = Math.max(40, Math.min(W - width - 40, cx - width / 2));
      y = side === "above" ? box.y - gap - estH : box.y + box.height + gap;
    } else {
      x = side === "left" ? box.x - gap - width : box.x + box.width + gap;
      y = cy - estH / 2;
    }
    x = Math.max(40, Math.min(W - width - 40, x));
    y = Math.max(40, Math.min(CAPTION_TOP - estH, y));
    // The arrow leaves the popup's edge nearest the target and points straight at it.
    const ex = Math.max(x, Math.min(x + width, cx));
    const ey = Math.max(y, Math.min(y + estH, cy));
    const dx = cx - ex;
    const dy = cy - ey;
    const len = Math.hypot(dx, dy);
    if (len > 60) {
      const ux = dx / len;
      const uy = dy / len;
      const reach = Math.min(len - Math.max(box.width, box.height) * 0.25 - 30, 70);
      arrow = { x: ex + ux * Math.max(34, reach), y: ey + uy * Math.max(34, reach), angle: Math.atan2(dy, dx) };
    }
    origin = `${ex - x}px ${ey - y}px`;
  } else {
    const pos = spec.pos ?? { x: W / 2, y: 260 };
    x = pos.x - width / 2;
    y = pos.y - estH / 2;
  }
  const title = spec.title ?? "";
  const typed = title.slice(0, Math.max(0, Math.floor(p.t * 1.8)));
  return (
    <>
      {arrow ? <Arrow {...arrow} frame={frame} scale={p.scale} /> : null}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y + p.lift,
          width,
          transformOrigin: origin,
          transform: `scale(${p.scale * p.sx}, ${p.scale * p.sy}) rotate(${p.rot}deg)`,
          opacity: p.opacity,
          background: `linear-gradient(180deg, #1a1f3d 0%, ${C.panel} 100%)`,
          border: `5px solid ${accent}`,
          outline: `3px solid ${C.goldInk}`,
          borderRadius: 12,
          boxShadow: `inset 0 0 0 3px ${C.line2}, 10px 10px 0 ${C.shadow}`,
          padding: "20px 26px 22px",
          color: C.ink,
          display: "flex",
          gap: 20,
          alignItems: "flex-start",
        }}
      >
        {spec.icon ? (
          <div
            style={{
              flex: "0 0 auto",
              width: 72,
              height: 72,
              display: "grid",
              placeItems: "center",
              fontSize: 42,
              background: C.bg,
              border: `4px solid ${accent}`,
              borderRadius: 10,
              boxShadow: `4px 4px 0 ${C.shadow}`,
              transform: `rotate(${Math.sin(frame / 9) * 5}deg) scale(${1 + Math.max(0, 1 - p.t / 12) * 0.4})`,
            }}
          >
            {spec.icon}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title ? (
            <div style={{ fontFamily: PIXEL, fontSize: 24, lineHeight: 1.5, color: accent, marginBottom: lines.length ? 10 : 0, minHeight: 36 }}>
              {typed}
              {typed.length < title.length ? <span style={{ opacity: 0.6 }}>▌</span> : null}
            </div>
          ) : null}
          {lines.map((line, i) => {
            const at = spec.lineAt?.[i] ?? spec.start + 8 + i * 7;
            const u = clamp01((frame - at) / 7);
            return (
              <div
                key={i}
                style={{
                  fontFamily: SANS,
                  fontWeight: 600,
                  fontSize: 31,
                  lineHeight: 1.35,
                  opacity: u,
                  transform: `translateX(${(1 - easeInOut(u)) * 26}px)`,
                }}
                dangerouslySetInnerHTML={{ __html: line }}
              />
            );
          })}
        </div>
      </div>
      <Sparkles x={arrow ? arrow.x : x + width / 2} y={arrow ? arrow.y : y} start={spec.start} seed={spec.seed} />
    </>
  );
};

/** A keycap that slams onto the screen. */
export const KeyCap: React.FC<{ start: number; end: number; label: string; pos?: { x: number; y: number }; seed: string; size?: number }> = ({
  start,
  end,
  label,
  pos = { x: W - 260, y: 300 },
  seed,
  size = 170,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popState(frame, fps, start, end, { tilt: 12, stiff: 320 });
  if (!p.visible) return null;
  const slam = 1 + Math.max(0, 1 - p.t / 5) * 1.6;
  const press = p.t > 4 && p.t < 9 ? 8 : 0;
  const w = Math.max(size, label.length * 52 + 70);
  return (
    <>
      {[0, 1].map((k) => {
        const u = clamp01((p.t - 4 - k * 4) / 16);
        return u > 0 && u < 1 ? (
          <div
            key={k}
            style={{
              position: "absolute",
              left: pos.x - w / 2 - 40 * u,
              top: pos.y - size / 2 - 40 * u,
              width: w + 80 * u,
              height: size + 80 * u,
              borderRadius: 30,
              border: `6px solid ${C.gold}`,
              opacity: 1 - u,
            }}
          />
        ) : null;
      })}
      <div
        style={{
          position: "absolute",
          left: pos.x - w / 2,
          top: pos.y - size / 2 + p.lift + press,
          width: w,
          height: size,
          transform: `scale(${p.scale * slam}) rotate(${p.rot}deg)`,
          opacity: p.opacity,
          background: `linear-gradient(180deg, ${C.ink} 0%, ${C.ink3} 100%)`,
          borderRadius: 26,
          boxShadow: `0 ${16 - press}px 0 #8a7c5c, 0 ${16 - press}px 0 6px ${C.goldInk}, 0 0 0 6px ${C.goldInk}`,
          display: "grid",
          placeItems: "center",
          fontFamily: PIXEL,
          fontSize: label.length > 2 ? 52 : 80,
          color: C.goldInk,
        }}
      >
        {label}
      </div>
      <Sparkles x={pos.x} y={pos.y} start={start + 4} seed={seed} count={18} spread={220} />
    </>
  );
};

/** Chips that pop in one after another: a path through menus, or picked values. */
export const Chips: React.FC<{ items: { text: string; at: number }[]; end: number; pos: { x: number; y: number }; sep?: string; seed: string; tone?: "gold" | "blue" }> = ({
  items,
  end,
  pos,
  sep,
  seed,
  tone = "gold",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = tone === "blue" ? C.blue2 : C.gold;
  return (
    <div style={{ position: "absolute", left: pos.x, top: pos.y, transform: "translateX(-50%)", display: "flex", gap: 14, alignItems: "center" }}>
      {items.map((item, i) => {
        const p = popState(frame, fps, item.at, end, { tilt: i % 2 ? 8 : -8 });
        if (frame < item.at) return null;
        return (
          <React.Fragment key={i}>
            {sep && i > 0 ? (
              <span style={{ fontFamily: PIXEL, fontSize: 30, color: accent, opacity: p.opacity, transform: `scale(${p.scale})` }}>{sep}</span>
            ) : null}
            <div
              style={{
                position: "relative",
                padding: "14px 22px 12px",
                fontFamily: PIXEL,
                fontSize: 22,
                color: C.goldInk,
                background: accent,
                borderRadius: 10,
                border: `3px solid ${C.goldInk}`,
                boxShadow: `6px 6px 0 ${C.shadow}`,
                transform: `scale(${p.scale * p.sx}, ${p.scale * p.sy}) rotate(${p.rot}deg) translateY(${p.lift}px)`,
                opacity: p.opacity,
                whiteSpace: "nowrap",
              }}
            >
              {item.text}
              <Sparkles x={60} y={20} start={item.at} seed={`${seed}${i}`} count={8} spread={80} />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** A big title moment: letters drop in one by one and settle. */
export const BigTitle: React.FC<{ start: number; end: number; text: string; sub?: string; y?: number; seed: string }> = ({ start, end, text, sub, y = 210, seed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popState(frame, fps, start, end, { tilt: 0 });
  if (!p.visible) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y + p.lift, textAlign: "center", opacity: p.opacity }}>
      <div style={{ display: "inline-flex", gap: 2 }}>
        {[...text].map((ch, i) => {
          const u = popState(frame, fps, start + i * 1.5, end, { tilt: i % 2 ? 14 : -14, stiff: 260 });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: PIXEL,
                fontSize: 64,
                color: C.gold,
                WebkitTextStroke: `3px ${C.goldInk}`,
                textShadow: `6px 6px 0 ${C.shadow}`,
                transform: `translateY(${(1 - u.scale) * -120}px) rotate(${u.rot}deg) scale(${u.sx}, ${u.sy})`,
                opacity: frame >= start + i * 1.5 ? 1 : 0,
                width: ch === " " ? 30 : undefined,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div style={{ marginTop: 18, fontFamily: SANS, fontWeight: 700, fontSize: 36, color: C.ink, textShadow: `3px 3px 0 ${C.shadow}`, opacity: clamp01((frame - start - text.length * 1.5) / 8) }}>
          {sub}
        </div>
      ) : null}
      <Sparkles x={W / 2} y={40} start={start + text.length * 1.5} seed={seed} count={22} spread={420} />
    </div>
  );
};

/** Chat bubbles piling up: the "what's the password?" gag. */
export const Spam: React.FC<{ start: number; end: number; text: string; count: number; seed: string; every?: number }> = ({ start, end, text, count, seed, every = 6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const at = start + i * every;
        const p = popState(frame, fps, at, end + i * 1.5, { tilt: random(`${seed}r${i}`) > 0.5 ? 10 : -10 });
        if (!p.visible) return null;
        const x = 160 + random(`${seed}x${i}`) * (W - 640);
        const y = 120 + random(`${seed}y${i}`) * 560;
        const flip = random(`${seed}f${i}`) > 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y + p.lift,
              transform: `scale(${p.scale * p.sx}, ${p.scale * p.sy}) rotate(${p.rot}deg)`,
              transformOrigin: flip ? "100% 100%" : "0% 100%",
              opacity: p.opacity,
              padding: "16px 24px",
              background: C.ink,
              color: C.goldInk,
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 32,
              borderRadius: 22,
              borderBottomLeftRadius: flip ? 22 : 4,
              borderBottomRightRadius: flip ? 4 : 22,
              boxShadow: `6px 6px 0 ${C.shadow}`,
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
        );
      })}
    </>
  );
};

/** A small sticker that stays a while, e.g. "Computer layout only". */
export const Sticker: React.FC<{ start: number; end: number; text: string; pos: { x: number; y: number }; tone?: "gold" | "blue" | "green"; seed: string; tilt?: number }> = ({
  start,
  end,
  text,
  pos,
  tone = "gold",
  seed,
  tilt = -4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = popState(frame, fps, start, end, { tilt: tilt * 3 });
  if (!p.visible) return null;
  const bg = tone === "blue" ? C.blue : tone === "green" ? C.green : C.gold;
  return (
    <div style={{ position: "absolute", left: pos.x, top: pos.y }}>
      <div
        style={{
          transform: `translate(-50%, -50%) scale(${p.scale * p.sx}, ${p.scale * p.sy}) rotate(${tilt + p.rot}deg) translateY(${p.lift}px)`,
          opacity: p.opacity,
          padding: "16px 26px 14px",
          background: bg,
          color: tone === "blue" ? "#fff" : C.goldInk,
          fontFamily: PIXEL,
          fontSize: 24,
          borderRadius: 12,
          border: `4px solid ${C.goldInk}`,
          boxShadow: `8px 8px 0 ${C.shadow}`,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
      <Sparkles x={0} y={0} start={start} seed={seed} count={10} spread={140} />
    </div>
  );
};

/** Dim everything but a target (a spotlight), for the big reveals. */
export const Spotlight: React.FC<{ start: number; end: number; target?: TargetRef; radius?: number }> = ({ start, end, target, radius = 260 }) => {
  const frame = useCurrentFrame();
  const box = useTargetBox(target);
  const u = clamp01((frame - start) / 8) * (1 - clamp01((frame - end) / 8));
  if (u <= 0) return null;
  const cx = box ? box.x + box.width / 2 : W / 2;
  const cy = box ? box.y + box.height / 2 : H / 2;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle ${lerp(1400, radius, u)}px at ${cx}px ${cy}px, transparent 0%, transparent 70%, rgba(5,6,12,${0.72 * u}) 100%)`,
      }}
    />
  );
};

export { prog };
