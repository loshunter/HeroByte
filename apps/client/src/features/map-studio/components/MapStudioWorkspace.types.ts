import type { MapStudioTileAsset } from "../starterTiles";

export type StudioTool = "pan" | "select" | "tile" | "room" | "erase";
export type TileCategory = MapStudioTileAsset["category"];
export type MapViewBox = { x: number; y: number; width: number; height: number };
export type RoomDrag = { start: { x: number; y: number }; end: { x: number; y: number } };

export const MAX_ROOM_TILES = 5000;
