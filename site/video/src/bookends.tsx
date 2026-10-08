import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, popState } from "./motion";
import { BigTitle, Chips, Sparkles } from "./overlays";
import { Backdrop } from "./stage";
import { C, PIXEL, SANS, W } from "./theme";

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 70 }, (_, i) => {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(frame / (9 + random(`tw${i}`) * 14) + i));
        const size = random(`sz${i}`) > 0.8 ? 8 : 4;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: random(`x${i}`) * 1920,
              top: random(`y${i}`) * 1080,
              width: size,
              height: size,
              background: random(`c${i}`) > 0.7 ? C.gold : C.ink,
              opacity: tw * 0.8,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Intro: React.FC<{ title: string; subtitle: string; chips: string[] }> = ({ title, subtitle, chips }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = popState(frame, fps, 4, 200, { tilt: -10 });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stars />
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center" }}>
        <Img
          src={staticFile("brand/logo-wide.webp")}
          style={{ height: 190, transform: `scale(${logo.scale * logo.sx}, ${logo.scale * logo.sy}) rotate(${logo.rot}deg)`, filter: `drop-shadow(8px 8px 0 ${C.shadow})` }}
        />
      </div>
      <Sparkles x={W / 2} y={245} start={8} seed="introlog" count={24} spread={420} />
      <BigTitle start={22} end={400} text={title} sub={subtitle} y={440} seed="introtitle" />
      <Chips seed="introchips" pos={{ x: W / 2, y: 700 }} end={400} items={chips.map((text, i) => ({ text, at: 58 + i * 7 }))} tone="blue" />
      <Sequence from={4} layout="none">
        <Audio src={staticFile("sfx/ui-open.wav")} volume={0.45} />
      </Sequence>
      <Sequence from={22} layout="none">
        <Audio src={staticFile("sfx/crit-sting.wav")} volume={0.32} />
      </Sequence>
      {chips.map((_, i) => (
        <Sequence key={i} from={58 + i * 7} layout="none">
          <Audio src={staticFile("sfx/token-place.wav")} volume={0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const Outro: React.FC<{ headline: string; steps: string[]; next: string }> = ({ headline, steps, next }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepAt = (i: number) => 26 + i * 9;
  const nextAt = stepAt(steps.length) + 10;
  const n = spring({ frame: frame - nextAt, fps, config: { damping: 12, stiffness: 150 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Stars />
      <BigTitle start={2} end={600} text={headline} y={110} seed="outrotitle" />
      <div style={{ position: "absolute", left: 560, top: 300, display: "flex", flexDirection: "column", gap: 22 }}>
        {steps.map((s, i) => {
          const p = popState(frame, fps, stepAt(i), 600, { tilt: -6 });
          const tick = spring({ frame: frame - stepAt(i) - 5, fps, config: { damping: 8, stiffness: 220 } });
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, opacity: p.opacity, transform: `translateX(${(1 - p.scale) * -80}px)` }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  display: "grid",
                  placeItems: "center",
                  background: C.green,
                  border: `4px solid ${C.goldInk}`,
                  boxShadow: `5px 5px 0 ${C.shadow}`,
                  fontSize: 40,
                  color: C.goldInk,
                  fontWeight: 900,
                  transform: `scale(${tick})`,
                }}
              >
                ✓
              </div>
              <div style={{ fontFamily: PIXEL, fontSize: 34, color: C.ink }}>
                <span style={{ color: C.gold }}>{i + 1}.</span> {s.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 870,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 40,
          color: C.ink,
          opacity: clamp01(n),
          transform: `translateY(${(1 - n) * 40}px)`,
        }}
      >
        {next}
      </div>
      {steps.map((_, i) => (
        <Sequence key={i} from={stepAt(i) + 5} layout="none">
          <Audio src={staticFile("sfx/dice-land.wav")} volume={0.3} />
        </Sequence>
      ))}
      <Sequence from={2} layout="none">
        <Audio src={staticFile("sfx/heal.wav")} volume={0.35} />
      </Sequence>
    </AbsoluteFill>
  );
};
