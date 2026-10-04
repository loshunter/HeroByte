/**
 * Multi-Select Handlers Barrel Export
 */

export {
  calculateMarqueeRect,
  testAABBIntersection,
  isClickMarquee,
  isSelectableObjectId,
} from "./marqueeSelection.js";

export {
  analyzeObjectsForDeletion,
  shouldBlockDelete,
  buildDeleteConfirmationMessage,
  buildPartialDeleteWarning,
  separateObjectsByType,
} from "./multiSelectActions.js";
