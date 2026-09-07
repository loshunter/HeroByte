import { useEffect } from "react";
import { isEditableTarget } from "../utils/isEditableTarget";

export interface UseKeyboardNavigationParams {
  selectedDrawingId: string | null;
  selectMode: boolean;
  sendMessage: (msg: { t: "delete-drawing"; id: string }) => void;
  handleSelectDrawing: (id: string | null) => void;
  selectedObjectId: string | null;
  onSelectObject?: (id: string | null) => void;
}

export function useKeyboardNavigation({
  selectedDrawingId,
  selectMode,
  sendMessage,
  handleSelectDrawing,
  selectedObjectId,
  onSelectObject,
}: UseKeyboardNavigationParams): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete") {
        return;
      }

      // The shared definition of "typing surface": the hand-rolled check
      // missed <select> and contentEditable, so Delete inside a select (the
      // inspector's, the DM menu's) deleted the selected drawing.
      if (isEditableTarget(event.target)) {
        return;
      }

      if (selectMode && selectedDrawingId) {
        sendMessage({ t: "delete-drawing", id: selectedDrawingId });
        handleSelectDrawing(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectDrawing, selectMode, selectedDrawingId, sendMessage]);

  useEffect(() => {
    if (!onSelectObject) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedObjectId) {
        onSelectObject(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectObject, selectedObjectId]);
}
