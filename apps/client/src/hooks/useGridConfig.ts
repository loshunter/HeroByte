import { useEffect, useState } from "react";

export type GridConfig = {
  show: boolean;
  size: number;
  color: string;
  majorEvery: number;
  opacity: number;
};

const DEFAULT_GRID_CONFIGURATION: Omit<GridConfig, "size"> = {
  show: true,
  color: "#447DF7",
  majorEvery: 5,
  opacity: 0.15,
};

/**
 * Manages the grid configuration for the map board while keeping the grid size
 * in sync with the provided `gridSize` value.
 *
 * @param gridSize - The size of a single grid cell in pixels.
 * @returns The current grid configuration reflecting the latest grid size.
 *
 * @example
 * ```tsx
 * const grid = useGridConfig(50);
 * return <Stage grid={grid} />;
 * ```
 */
export function useGridConfig(gridSize: number): GridConfig {
  const [grid, setGrid] = useState<GridConfig>({
    ...DEFAULT_GRID_CONFIGURATION,
    size: gridSize,
  });

  useEffect(() => {
    setGrid((previous) =>
      previous.size === gridSize ? previous : { ...previous, size: gridSize },
    );
  }, [gridSize]);

  return grid;
}
