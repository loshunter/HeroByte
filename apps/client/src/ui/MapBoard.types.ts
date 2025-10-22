import type { RoomSnapshot, ClientMessage } from "@shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { Camera } from "../hooks/useCamera";

/**
 * Camera command for programmatic camera control.
 * Used to focus on tokens or reset the camera view.
 */
export type CameraCommand = { type: "focus-token"; tokenId: string } | { type: "reset" };

/**
 * Options for selection operations.
 * Controls how new selections interact with existing selections.
 */
export type SelectionRequestOptions = {
  mode?: "replace" | "append" | "toggle" | "subtract";
};

/**
 * Props for the MapBoard component.
 * Main VTT canvas component that handles rendering and interaction.
 */
export interface MapBoardProps {
  snapshot: RoomSnapshot | null; // Current room state
  sendMessage: (msg: ClientMessage) => void; // Function to send messages to server
  uid: string; // Current player's UID
  gridSize: number; // Synchronized grid size
  snapToGrid: boolean; // Whether to snap tokens to grid
  pointerMode: boolean; // Pointer tool active
  measureMode: boolean; // Measure tool active
  drawMode: boolean; // Draw tool active
  transformMode: boolean; // Transform tool active (gizmo mode)
  selectMode: boolean; // Selection tool active
  isDM: boolean; // Whether the current user can manage all objects
  alignmentMode: boolean; // Alignment tool active
  alignmentPoints?: AlignmentPoint[]; // Captured alignment points
  alignmentSuggestion?: AlignmentSuggestion | null; // Preview transform for alignment
  onAlignmentPointCapture?: (point: AlignmentPoint) => void;
  drawTool: "freehand" | "line" | "rect" | "circle" | "eraser"; // Active drawing tool
  drawColor: string; // Drawing color
  drawWidth: number; // Drawing brush size
  drawOpacity: number; // Drawing opacity (0-1)
  drawFilled: boolean; // Whether shapes are filled
  onRecolorToken: (sceneId: string, owner?: string | null) => void;
  onTransformObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  onDrawingComplete?: (drawingId: string) => void; // Called when a drawing is completed
  cameraCommand: CameraCommand | null;
  onCameraCommandHandled: () => void;
  selectedObjectId?: string | null; // Currently selected object for transform gizmo
  selectedObjectIds?: string[];
  onSelectObject?: (objectId: string | null, options?: SelectionRequestOptions) => void; // Selection handler
  onSelectObjects?: (objectIds: string[]) => void; // Batch selection handler
  onCameraChange?: (camera: Camera) => void; // Called when camera changes
}
