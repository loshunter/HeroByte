import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, random, staticFile } from "remotion";
import { C, PIXEL, SANS } from "./theme";

// YouTube channel art and thumbnails, rendered as stills (npx remotion still src/index.ts <id>).

const Stars: React.FC<{ w: number; h: number; n?: number }> = ({ w, h, n = 120 }) => (
  <AbsoluteFill>
    {Array.from({ length: n }, (_, i) => {
      const size = random(`bs${i}`) > 0.82 ? 10 : 5;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: random(`bx${i}`) * w,
            top: random(`by${i}`) * h,
            width: size,
            height: size,
            background: random(`bc${i}`) > 0.7 ? C.gold : C.ink,
            opacity: 0.35 + random(`bo${i}`) * 0.55,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

const Grid: React.FC<{ cell: number }> = ({ cell }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `linear-gradient(${C.line} 3px, transparent 3px), linear-gradient(90deg, ${C.line} 3px, transparent 3px)`,
      backgroundSize: `${cell}px ${cell}px`,
      opacity: 0.5,
    }}
  />
);

const Chip: React.FC<{ children: React.ReactNode; tone?: "gold" | "blue" | "green"; size?: number }> = ({ children, tone = "gold", size = 30 }) => (
  <div
    style={{
      padding: `${size * 0.6}px ${size}px ${size * 0.5}px`,
      background: tone === "blue" ? C.blue : tone === "green" ? C.green : C.gold,
      color: tone === "blue" ? "#fff" : C.goldInk,
      fontFamily: PIXEL,
      fontSize: size,
      borderRadius: 12,
      border: `5px solid ${C.goldInk}`,
      boxShadow: `8px 8px 0 ${C.shadow}`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

/** 2560×1440; YouTube shows the middle 1546×423 on every device, so everything that matters is there. */
export const ChannelBanner: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(1400px 700px at 50% 50%, ${C.bg2} 0%, ${C.bg} 75%)` }}>
    <Grid cell={96} />
    <Stars w={2560} h={1440} n={160} />
    <div style={{ position: "absolute", left: 507, top: 508, width: 1546, height: 423, display: "flex", alignItems: "center", gap: 60 }}>
      <Img src={staticFile("brand/logo-wide.webp")} style={{ height: 240, border: `8px solid ${C.gold}`, borderRadius: 16, boxShadow: `12px 12px 0 ${C.shadow}` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ fontFamily: PIXEL, fontSize: 46, lineHeight: 1.5, color: C.gold, textShadow: `6px 6px 0 ${C.shadow}`, WebkitTextStroke: `2px ${C.goldInk}` }}>
          BUILD THE DUNGEON
          <br />
          WHILE YOUR PARTY PLAYS.
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <Chip size={22}>LESSONS</Chip>
          <Chip size={22} tone="blue">
            PHONES TOO
          </Chip>
          <Chip size={22} tone="green">
            NO ACCOUNTS
          </Chip>
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

export type ThumbProps = { kicker: string; title: string[]; footage: string; at: number; tone?: "gold" | "blue" };

/** 1280×720 lesson thumbnail: big pixel title on the left, a real frame of the app on the right. */
export const Thumbnail: React.FC<ThumbProps> = ({ kicker, title, footage, at, tone = "gold" }) => (
  <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
    <Grid cell={64} />
    <Stars w={1280} h={720} n={60} />
    <div
      style={{
        position: "absolute",
        right: -50,
        top: 250,
        width: 680,
        height: 383,
        transform: "rotate(5deg)",
        border: `8px solid ${C.gold}`,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: `16px 16px 0 ${C.shadow}`,
      }}
    >
      <OffthreadVideo src={staticFile(footage)} trimBefore={Math.round(at * 30)} muted style={{ width: 680, height: 383 }} />
    </div>
    <Img src={staticFile("brand/logo-wide.webp")} style={{ position: "absolute", left: 40, top: 34, height: 92, border: `5px solid ${C.gold}`, borderRadius: 10, boxShadow: `6px 6px 0 ${C.shadow}` }} />
    <div style={{ position: "absolute", left: 46, top: 190, transform: "rotate(-3deg)" }}>
      <Chip size={24} tone={tone === "blue" ? "blue" : "gold"}>
        {kicker}
      </Chip>
    </div>
    <div style={{ position: "absolute", left: 46, top: 290, display: "flex", flexDirection: "column", gap: 10 }}>
      {title.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: PIXEL,
            fontSize: 66,
            lineHeight: 1.25,
            color: i === title.length - 1 ? C.gold : C.ink,
            WebkitTextStroke: `4px ${C.goldInk}`,
            paintOrder: "stroke fill",
            textShadow: `8px 8px 0 ${C.shadow}`,
          }}
        >
          {line}
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", left: 50, bottom: 40, fontFamily: SANS, fontWeight: 700, fontSize: 30, color: C.ink3 }}>
      A virtual tabletop in your browser
    </div>
  </AbsoluteFill>
);
