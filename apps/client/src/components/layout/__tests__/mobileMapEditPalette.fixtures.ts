import { vi } from "vitest";
import { screen } from "@testing-library/react";
import type { MobileSurface } from "../../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";
export const toolbar = (overrides: Record<string, unknown> = {}) =>
  ({
    isLive: false,
    busy: false,
    activeSubTool: "wall",
    onSelectSubTool: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
    error: null,
    ...overrides,
  }) as unknown as MapEditToolbarProps;

export const props = (overrides: Record<string, unknown> = {}) => ({
  surface: "none" as MobileSurface,
  onToggleSurface: vi.fn(),
  onToolSelect: vi.fn(),
  onSnapToGridChange: vi.fn(),
  onResetCamera: vi.fn(),
  activeTool: "map-edit" as const,
  snapToGrid: false,
  isDM: true,
  mode: true,
  mapEditToolbarProps: toolbar(),
  ...overrides,
});

export const dock = () => screen.getByRole("navigation", { name: /map edit actions/i });
