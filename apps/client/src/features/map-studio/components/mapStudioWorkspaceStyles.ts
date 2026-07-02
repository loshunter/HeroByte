import type { CSSProperties } from "react";

export const workspaceStyle = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: "#0d111a",
  overflow: "hidden",
} satisfies CSSProperties;

export const topBarStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 4,
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "7px 12px",
  background: "rgba(11,13,18,0.96)",
  borderBottom: "1px solid #8a7445",
} satisfies CSSProperties;

export const leftRailStyle = {
  position: "absolute",
  top: 60,
  bottom: 16,
  left: 12,
  zIndex: 3,
  width: 92,
  display: "flex",
  flexDirection: "column",
  gap: 8,
} satisfies CSSProperties;

export const paletteStyle = {
  position: "absolute",
  top: 60,
  right: 12,
  bottom: 16,
  zIndex: 3,
  width: 260,
  overflow: "auto",
  padding: 12,
  background: "rgba(17,20,31,0.96)",
  border: "1px solid #8a7445",
} satisfies CSSProperties;

export const canvasShellStyle = {
  position: "absolute",
  inset: "58px 286px 16px 116px",
} satisfies CSSProperties;

export const emptyStateStyle = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
} satisfies CSSProperties;

export const errorStyle = {
  position: "absolute",
  top: 10,
  left: 10,
  zIndex: 5,
  background: "#3a1820",
  color: "#ffb5aa",
  padding: "8px 10px",
  border: "1px solid #e07070",
  fontSize: 10,
} satisfies CSSProperties;

export const statusStyle = {
  position: "absolute",
  top: 10,
  right: 10,
  zIndex: 5,
  background: "#183825",
  color: "#bff0c9",
  padding: "8px 10px",
  border: "1px solid #7fd68a",
  fontSize: 10,
} satisfies CSSProperties;
