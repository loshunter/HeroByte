// Drawing presentation preferences. Server snapshots own history availability.
import { useState } from "react";
import type { DrawTool } from "@herobyte/shared";

interface UseDrawingStateReturn {
  drawTool: DrawTool;
  drawColor: string;
  drawWidth: number;
  drawOpacity: number;
  drawFilled: boolean;
  setDrawTool: (tool: DrawTool) => void;
  setDrawColor: (color: string) => void;
  setDrawWidth: (width: number) => void;
  setDrawOpacity: (opacity: number) => void;
  setDrawFilled: (filled: boolean) => void;
}

/** Keep local settings across history updates; never infer history from drawing IDs. */
export function useDrawingState(): UseDrawingStateReturn {
  const [drawTool, setDrawTool] = useState<DrawTool>("freehand");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [drawFilled, setDrawFilled] = useState(false);

  return {
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
  };
}
