import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Box, LessonData, Target } from "./data";
import { makeResolver } from "./data";
import { clamp01, easeInOut, lerp, popState } from "./motion";
import { BigTitle, Chips, KeyCap, Popup, Ring, Spam, Sparkles, Spotlight, Sticker } from "./overlays";
import type { ChapterScript } from "./script";
import { Backdrop, FootagePanel, type Panel, StageProvider, frameOf } from "./stage";
import { C, H, PIXEL, SANS, W } from "./theme";

export const LEAD = 0.7; // seconds of banner before the narration starts

type Cam = { s: number; cx: number; cy: number };
const BASE: Cam = { s: 1, cx: W / 2, cy: H / 2 };
const lerpCam = (a: Cam, b: Cam, u: number): Cam => ({ s: lerp(a.s, b.s, u), cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u) });

function zoomCam(box: Box | undefined, k: number, want = 1.7): Cam {
  if (!box) return { s: want, cx: W / 2, cy: H / 2 };
  const bw = box.width * k;
  const bh = box.height * k;
  const s = Math.max(1, Math.min(want, (W * 0.8) / bw, (H * 0.72) / bh));
  const cx = Math.max(W / 2 / s, Math.min(W - W / 2 / s, (box.x + box.width / 2) * k));
  const cy = Math.max(H / 2 / s, Math.min(H - H / 2 / s, (box.y + box.height / 2) * k));
  return { s, cx, cy };
}

/** Camera at narration time t: ease into each zoom just before its cue, hold, ease out (or pan on). */
function camAt(t: number, zooms: { f0: number; f1: number; cam: Cam }[]): Cam {
  const keys: [number, Cam][] = [[-99, BASE]];
  const zs = [...zooms].sort((a, b) => a.f0 - b.f0);
  zs.forEach((z, i) => {
    const last = keys[keys.length - 1];
    keys.push([Math.max(z.f0 - 0.45, last[0] + 0.01), last[1]]);
    keys.push([Math.max(z.f0 + 0.25, last[0] + 0.02), z.cam]);
    keys.push([Math.max(z.f1, last[0] + 0.03), z.cam]);
    const next = zs[i + 1];
    if (!next || next.f0 - 0.45 > z.f1 + 0.6) keys.push([z.f1 + 0.6, BASE]);
  });
  let i = keys.length - 1;
  while (i > 0 && keys[i][0] > t) i--;
  const [ta, a] = keys[i];
  const nextKey = keys[i + 1];
  if (!nextKey) return a;
  const [tb, b] = nextKey;
  return lerpCam(a, b, easeInOut(clamp01((t - ta) / (tb - ta))));
}

const FULL = { x: 0, y: 0, w: W, h: H };
const LEFT = { x: 28, y: 196, w: 924, h: 520 };
const RIGHT = { x: 968, y: 196, w: 924, h: 520 };
const OFF_RIGHT = { x: W + 40, y: 196, w: 924, h: 520 };
const PHONE_DESK = { x: 60, y: 150, w: 1180, h: 664 };
const PHONE = { x: 1350, y: 0, w: 400, h: 0 };
const lerpRect = (a: typeof FULL, b: typeof FULL, u: number) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });

/** Karaoke captions: the current phrase, each word lighting up as Wren says it. */
const Captions: React.FC<{ words: { w: string; s: number; e: number }[]; fixes?: Record<string, string> }> = ({ words: raw, fixes = {} }) => {
  const frame = useCurrentFrame();
  // Whisper splits some words: "Hero" "Byte", "kicked" "-in". Join them back for reading.
  const words: typeof raw = [];
  for (const w of raw) {
    const prev = words[words.length - 1];
    if (prev && (w.w.startsWith("-") || (prev.w === "Hero" && /^Byte/.test(w.w)))) {
      words[words.length - 1] = { w: prev.w + w.w, s: prev.s, e: w.e };
    } else words.push(w);
  }
  for (const w of words) if (fixes[w.w]) w.w = fixes[w.w];
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks: { s: number; e: number; words: typeof words }[] = [];
  let cur: typeof words = [];
  words.forEach((w, i) => {
    cur.push(w);
    const text = cur.map((x) => x.w).join(" ");
    const next = words[i + 1];
    const ends = /[.!?]$/.test(w.w) || !next || next.s - w.e > 0.55 || text.length > 44;
    if (ends) {
      chunks.push({ s: cur[0].s, e: w.e, words: cur });
      cur = [];
    }
  });
  const idx = chunks.findIndex((c, i) => t >= c.s - 0.12 && t < (chunks[i + 1]?.s ?? c.e + 0.7) - 0.12);
  if (idx < 0) return null;
  const chunk = chunks[idx];
  const u = clamp01((t - chunk.s + 0.12) / 0.12);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "14px 30px 16px",
          background: "rgba(8,9,18,0.86)",
          border: `3px solid ${C.line3}`,
          borderRadius: 14,
          boxShadow: `6px 6px 0 ${C.shadow}`,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 42,
          lineHeight: 1.25,
          color: C.ink3,
          textAlign: "center",
          transform: `translateY(${(1 - u) * 14}px)`,
          opacity: u,
        }}
      >
        {chunk.words.map((w, i) => {
          const nextS = chunk.words[i + 1]?.s ?? w.e + 0.4;
          const on = t >= w.s && t < nextS;
          const said = t >= w.s;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: 12,
                color: on ? C.gold : said ? C.ink : C.muted,
                transform: on ? "translateY(-3px) scale(1.07)" : undefined,
                textShadow: on ? `0 0 18px rgba(243,198,78,.45)` : undefined,
              }}
            >
              {w.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** "CHAPTER 2 · CLAIM THE DM SEAT" sweeping in at the start of a chapter. */
const Banner: React.FC<{ n: number; total: number; title: string }> = ({ n, total, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 170 } });
  const out = clamp01((frame - 42) / 9);
  if (frame > 52) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 360, transform: `translateX(${(1 - inS) * -1200 + easeInOut(out) * 2200}px)` }}>
      <div
        style={{
          padding: "26px 60px 24px 70px",
          background: C.gold,
          color: C.goldInk,
          clipPath: "polygon(0 0, 100% 0, calc(100% - 40px) 100%, 0 100%)",
          boxShadow: `0 10px 0 ${C.shadow}`,
        }}
      >
        <div style={{ fontFamily: PIXEL, fontSize: 22, opacity: 0.75, marginBottom: 14 }}>
          CHAPTER {n} OF {total}
        </div>
        <div style={{ fontFamily: PIXEL, fontSize: 54, letterSpacing: 2 }}>{title.toUpperCase()}</div>
      </div>
      <Sparkles x={900} y={60} start={14} seed={`banner${n}`} count={16} spread={260} />
    </div>
  );
};

const FastForward: React.FC<{ speed: number }> = ({ speed }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        top: 190,
        padding: "12px 18px 10px",
        background: C.blue,
        color: "#fff",
        fontFamily: PIXEL,
        fontSize: 26,
        borderRadius: 10,
        border: `3px solid ${C.goldInk}`,
        boxShadow: `5px 5px 0 ${C.shadow}`,
        transform: `rotate(-3deg) scale(${1 + Math.sin(frame / 3) * 0.04})`,
      }}
    >
      ⏩ {Math.round(speed)}×
    </div>
  );
};

/** The three-ways infographic: a big row, then a tracker that lights the way being explained. */
const Ways: React.FC<{ ways: string[]; start: number; end: number; active: number[]; dock: number }> = ({ ways, start, end, active, dock }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = spring({ frame: frame - dock, fps, config: { damping: 15, stiffness: 120 } });
  const which = active.reduce((acc, f, i) => (frame >= f ? i : acc), -1);
  return (
    <>
      {ways.map((label, i) => {
        const p = popState(frame, fps, start + i * 7, end, { tilt: i === 1 ? 8 : -8 });
        if (!p.visible) return null;
        const bigX = W / 2 + (i - 1) * 470;
        const bigY = 640;
        const dockX = 250;
        const dockY = 330 + i * 120;
        const x = lerp(bigX, dockX, d);
        const y = lerp(bigY, dockY, d);
        const s = lerp(1, 0.52, d);
        const on = which === i && frame >= dock;
        const pulse = on ? 1 + Math.sin(frame / 4) * 0.05 : 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 210,
              top: y - 110,
              width: 420,
              height: 220,
              transform: `scale(${p.scale * p.sx * s * pulse}, ${p.scale * p.sy * s * pulse}) rotate(${p.rot}deg)`,
              opacity: p.opacity * (frame >= dock && !on && which >= 0 ? 0.55 : 1),
              background: on ? C.gold : C.panel,
              color: on ? C.goldInk : C.ink,
              border: `6px solid ${on ? C.goldInk : C.gold}`,
              borderRadius: 18,
              boxShadow: `10px 10px 0 ${C.shadow}`,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: 20,
            }}
          >
            <div style={{ fontFamily: PIXEL, fontSize: 64, color: on ? C.goldInk : C.gold }}>{i + 1}</div>
            <div style={{ fontFamily: PIXEL, fontSize: 24, lineHeight: 1.5 }}>{label}</div>
          </div>
        );
      })}
    </>
  );
};

const sfxDefault: Record<string, string> = {
  popup: "button-blip.wav",
  sticker: "token-place.wav",
  title: "crit-sting.wav",
  key: "ui-open.wav",
};

export const Chapter: React.FC<{ n: number; total: number; data: LessonData; script: ChapterScript; slug: string; captionFixes?: Record<string, string> }> = ({
  n,
  total,
  data,
  script,
  slug,
  captionFixes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lead = Math.round(LEAD * fps);
  const R = makeResolver(data, n);
  const t = (frame - lead) / fps;
  const F = (cue: Parameters<typeof R.time>[0]) => Math.round(R.time(cue) * fps);
  // The main view: the DM's screen in a DM lesson, the player's computer in a player lesson.
  const main = R.rec("dm") ? "dm" : "player";
  const recs: Record<string, ReturnType<typeof R.rec>> = { [main]: R.rec(main) };
  for (const who of ["player", "phone"]) if (who !== main && R.rec(who)) recs[who] = R.rec(who);
  const k = W / recs[main].view.width;

  const zooms = (script.zooms ?? []).map((z) => ({
    f0: R.time(z.from),
    f1: R.time(z.to),
    cam: zoomCam(z.target ? R.box(z.target as Target) : undefined, k, z.scale),
  }));
  const splitAt = script.split ? R.time(script.split.from) : Infinity;
  const u = script.split ? spring({ frame: frame - lead - Math.round(splitAt * fps), fps, config: { damping: 16, stiffness: 110 } }) : 0;
  // The phone shot: the desktop shrinks left, a phone slides in on the right, then back.
  let v = 0;
  if (script.phone) {
    const pf = lead + F(script.phone.from);
    const pin = spring({ frame: frame - pf, fps, config: { damping: 15, stiffness: 120 } });
    const pout =
      script.phone.to === undefined ? 0 : spring({ frame: frame - lead - F(script.phone.to), fps, config: { damping: 15, stiffness: 120 } });
    v = clamp01(pin - pout);
  }
  const dmCam = lerpCam(camAt(t, zooms), BASE, Math.max(u, v));
  const dmRect = v > 0 ? lerpRect(FULL, PHONE_DESK, v) : lerpRect(FULL, LEFT, u);
  const panels: Record<string, Panel> = {
    [main]: { ...dmRect, ...dmCam, label: v > 0.5 ? "COMPUTER" : script.split?.labels[0], opacity: 1 },
  };
  if (recs.player && main !== "player") panels.player = { ...lerpRect(OFF_RIGHT, RIGHT, u), ...BASE, label: script.split?.labels[1], opacity: u > 0.01 ? 1 : 0 };
  if (recs.phone) {
    const { VW, VH } = frameOf(recs.phone);
    const h = (PHONE.w * VH) / VW;
    const at = { ...PHONE, h, y: (H - h) / 2 - 20 };
    panels.phone = { ...lerpRect({ ...at, x: W + 60 }, at, v), s: 1, cx: VW / 2, cy: VH / 2, label: script.phone?.label ?? "PHONE", opacity: v > 0.01 ? 1 : 0, phone: true };
  }

  // Screen shake for the big keys.
  let shake = { x: 0, y: 0 };
  for (const b of script.beats) {
    if (b.kind === "key" && b.shake) {
      const d = frame - lead - F(b.from);
      if (d >= 2 && d < 16) {
        const a = 18 * Math.exp(-(d - 2) / 4);
        shake = { x: Math.sin(d * 2.7) * a, y: Math.cos(d * 3.3) * a };
      }
    }
  }
  const ff = Object.values(recs)
    .flatMap((r) => r.fastForward)
    .filter((s) => s.speed > 2.5 && s.to - s.from > 0.5)
    .find((s) => t >= s.from - 0.1 && t <= Math.max(s.to, s.from + 0.9));

  const footage = (who: string) =>
    frame < lead ? (
      <Freeze frame={0} key={who}>
        <FootagePanel who={who} panel={panels[who]} rec={recs[who]} />
      </Freeze>
    ) : (
      <Sequence from={lead} layout="none" key={who}>
        <FootagePanel who={who} panel={panels[who]} rec={recs[who]} />
      </Sequence>
    );

  const sfx: { at: number; src: string; volume: number }[] = [];
  const addSfx = (at: number, src: string | null | undefined, volume = 0.35) => {
    if (src) sfx.push({ at, src, volume });
  };

  const overlays = script.beats.map((b, i) => {
    const seed = `ch${n}b${i}`;
    switch (b.kind) {
      case "popup": {
        addSfx(F(b.from), b.sfx === undefined ? sfxDefault.popup : b.sfx);
        const target = b.target ? { who: b.target.who ?? main, box: R.box(b.target) } : undefined;
        return (
          <Popup key={i} seed={seed} start={F(b.from)} end={F(b.to)} title={b.title} lines={b.lines} lineAt={b.lineAt?.map(F)} icon={b.icon} tone={b.tone} target={target} side={b.side} pos={b.pos} width={b.width} />
        );
      }
      case "ring":
        return <Ring key={i} start={F(b.from)} end={F(b.to)} target={{ who: b.target.who ?? main, box: R.box(b.target) }} />;
      case "key":
        addSfx(F(b.from), b.sfx ?? sfxDefault.key, b.shake ? 0.6 : 0.4);
        return <KeyCap key={i} seed={seed} start={F(b.from)} end={F(b.to)} label={b.label} pos={b.pos} />;
      case "chips":
        b.items.forEach((it) => addSfx(F(it.at), "token-place.wav", 0.3));
        return <Chips key={i} seed={seed} items={b.items.map((it) => ({ text: it.text, at: F(it.at) }))} end={F(b.to)} pos={b.pos} sep={b.sep} tone={b.tone} />;
      case "title":
        addSfx(F(b.from), b.sfx === undefined ? sfxDefault.title : b.sfx, 0.32);
        return <BigTitle key={i} seed={seed} start={F(b.from)} end={F(b.to)} text={b.text} sub={b.sub} y={b.y} />;
      case "spam":
        for (let s = 0; s < b.count; s++) addSfx(F(b.from) + s * (b.every ?? 6), "button-blip.wav", 0.22);
        return <Spam key={i} seed={seed} start={F(b.from)} end={F(b.to)} text={b.text} count={b.count} every={b.every} />;
      case "sticker":
        addSfx(F(b.from), b.sfx === undefined ? sfxDefault.sticker : b.sfx, 0.35);
        return <Sticker key={i} seed={seed} start={F(b.from)} end={F(b.to)} text={b.text} pos={b.pos} tone={b.tone} tilt={b.tilt} />;
      case "spot":
        return <Spotlight key={i} start={F(b.from)} end={F(b.to)} radius={b.radius} target={b.target ? { who: b.target.who ?? main, box: R.box(b.target) } : undefined} />;
      case "sfx":
        addSfx(F(b.at), b.src, b.volume ?? 0.4);
        return null;
      case "ways":
        b.ways.forEach((_, w) => addSfx(F(b.from) + w * 7, "button-blip.wav", 0.3));
        return <Ways key={i} ways={b.ways} start={F(b.from)} end={F(b.to)} active={b.active.map(F)} dock={F(b.dock)} />;
    }
  });

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <StageProvider value={{ panels, recs }}>
        <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px)` }}>
          {footage(main)}
          {recs.player && main !== "player" && u > 0.01 ? footage("player") : null}
          {recs.phone && v > 0.01 ? footage("phone") : null}
          <Sequence from={lead} layout="none">
            {overlays}
          </Sequence>
        </AbsoluteFill>
      </StageProvider>
      <Sequence from={lead} layout="none">
        <Captions words={R.words} fixes={captionFixes} />
        {ff ? <FastForward speed={ff.speed} /> : null}
        <Audio src={staticFile(`audio/${slug}/${data.chapters[n - 1].file}`)} />
        {sfx.map((s, i) => (
          <Sequence key={i} from={s.at} durationInFrames={Math.round(fps * 2.5)} layout="none">
            <Audio src={staticFile(`sfx/${s.src}`)} volume={s.volume} />
          </Sequence>
        ))}
      </Sequence>
      <Banner n={n} total={total} title={script.title} />
      <ChapterTag n={n} total={total} />
    </AbsoluteFill>
  );
};

const ChapterTag: React.FC<{ n: number; total: number }> = ({ n, total }) => (
  <div style={{ position: "absolute", right: 40, bottom: 44, display: "flex", gap: 8 }}>
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        style={{
          width: 22,
          height: 22,
          background: i < n - 1 ? C.green : i === n - 1 ? C.gold : C.panel,
          border: `3px solid ${C.goldInk}`,
          boxShadow: `3px 3px 0 ${C.shadow}`,
        }}
      />
    ))}
  </div>
);

/** Chapter length in seconds (lead included). */
export function chapterSeconds(data: LessonData, n: number, script: ChapterScript) {
  const R = makeResolver(data, n);
  const end = script.end !== undefined ? R.time(script.end) : R.duration + 1.0;
  return LEAD + Math.max(end, R.duration + 0.6);
}

/** A pixel wipe between chapters: gold bars sweep across and away. */
export const Wipe: React.FC = () => {
  const frame = useCurrentFrame();
  const cols = 16;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: cols }, (_, i) => {
        const local = frame - i * 0.8;
        const grow = clamp01(local / 7);
        const shrink = clamp01((local - 9) / 7);
        const h = (easeInOut(grow) - easeInOut(shrink)) * H;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (i * W) / cols,
              width: W / cols + 1,
              top: shrink > 0 ? H - h : 0,
              height: h,
              background: i % 2 ? C.gold : C.panel,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
