import type { Drawing } from "@shared";

export type DrawingOperation =
  | {
      type: "add";
      drawing: Drawing;
    }
  | {
      type: "erase";
      drawing: Drawing;
    }
  | {
      type: "partial-erase";
      original: Drawing;
      segments: Drawing[];
    };

export type DrawingOperationStack = DrawingOperation[];
