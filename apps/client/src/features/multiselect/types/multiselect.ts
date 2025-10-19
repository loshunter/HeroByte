/**
 * Multi-Select Types
 * Types for multi-object selection and manipulation
 */

import type { SceneObject } from "@shared";

/**
 * Selection mode for multi-select operations
 * - replace: Replace current selection with new selection
 * - append: Add to current selection
 * - subtract: Remove from current selection
 * - toggle: Toggle selection state of objects
 */
export type SelectionMode = "replace" | "append" | "subtract" | "toggle";

/**
 * Options for multi-select operations
 */
export interface MultiSelectOptions {
  /** Selection mode (defaults to "replace") */
  mode?: SelectionMode;
}

/**
 * Predicate function for filtering scene objects
 */
export type ObjectFilterPredicate = (obj: SceneObject) => boolean;

/**
 * Reason why an object cannot be deleted
 */
export type DeleteBlockReason = "locked" | "not-owner" | "no-permission";

/**
 * Result of analyzing which objects can be deleted
 */
export interface DeleteAnalysisResult {
  /** IDs of objects that can be deleted */
  allowed: string[];
  /** Map of blocked object IDs to reasons why they're blocked */
  blocked: Map<string, DeleteBlockReason>;
}
