import type { MapGridType } from "@herobyte/shared";

export interface GridGeometry {
  width: number;
  height: number;
  path: string;
}

export function getGridGeometry(type: MapGridType, size: number): GridGeometry {
  if (type === "isometric") {
    return {
      width: size * 2,
      height: size,
      path: `M 0 ${size / 2} L ${size} 0 L ${size * 2} ${size / 2} L ${size} ${size} Z`,
    };
  }
  if (type === "hex-row") {
    const height = Math.sqrt(3) * size;
    return {
      width: size * 3,
      height,
      path: `M 0 ${height / 2} L ${size / 2} 0 L ${size * 1.5} 0 L ${size * 2} ${height / 2} L ${size * 1.5} ${height} L ${size / 2} ${height} Z M ${size * 2} ${height / 2} L ${size * 2.5} 0 L ${size * 3} 0`,
    };
  }
  if (type === "hex-column") {
    const width = Math.sqrt(3) * size;
    return {
      width,
      height: size * 3,
      path: `M ${width / 2} 0 L ${width} ${size / 2} L ${width} ${size * 1.5} L ${width / 2} ${size * 2} L 0 ${size * 1.5} L 0 ${size / 2} Z M ${width / 2} ${size * 2} L ${width} ${size * 2.5} L ${width} ${size * 3}`,
    };
  }
  return { width: size, height: size, path: `M ${size} 0 L 0 0 0 ${size}` };
}
