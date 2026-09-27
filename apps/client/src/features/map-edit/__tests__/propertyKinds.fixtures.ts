import type { MapElement } from "@herobyte/shared";
import { propertyDoor } from "./properties.u5.fixtures";

const base = { ...propertyDoor, id: "selection-kind" };
export const propertyKinds: MapElement[] = [
  { ...base, type: "tile", data: { assetId: "terrain:grass", columns: 1, rows: 1 } },
  { ...base, type: "stamp", data: { assetId: "prop:crate", width: 50, height: 50 } },
  {
    ...base,
    type: "shape",
    data: { shape: "rectangle", points: [], stroke: "#fff", strokeWidth: 1, opacity: 1 },
  },
  { ...base, type: "wall", data: { points: [], blocksMovement: true, blocksVision: true } },
  propertyDoor,
  {
    ...base,
    type: "light",
    data: { radius: 100, color: "#fff", intensity: 1, castsShadows: false },
  },
  {
    ...base,
    type: "text",
    data: { text: "Gate", color: "#fff", fontSize: 20, visibleToPlayers: true },
  },
  { ...base, type: "spline", data: { points: [], kind: "rope" } },
];
