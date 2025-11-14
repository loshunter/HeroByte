// ============================================================================
// COMMON VALIDATION UTILITIES
// ============================================================================
// Shared type guards, helpers, and constants used across domain validators

import type { DrawingSegmentPayload } from "@shared";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Message record type for validation
 */
export type MessageRecord = Record<string, unknown>;

/**
 * Selection modes for multi-select operations
 */
export const SELECTION_MODES = ["replace", "append", "subtract"] as const;

/**
 * Maximum number of partial segments in erase operations
 */
export const MAX_PARTIAL_SEGMENTS = 50;

/**
 * Maximum number of points in a drawing segment
 */
export const MAX_SEGMENT_POINTS = 10_000;

/**
 * Valid token sizes
 */
export const VALID_TOKEN_SIZES = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
] as const;

/**
 * Point interface for coordinate validation
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Type guard: Check if value is a non-null object
 */
export function isRecord(value: unknown): value is MessageRecord {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard: Check if value is a finite number
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Type guard: Check if value is a valid point with finite coordinates
 */
export function isPoint(value: unknown): value is Point {
  return (
    isRecord(value) &&
    isFiniteNumber((value as MessageRecord).x) &&
    isFiniteNumber((value as MessageRecord).y)
  );
}

/**
 * Validate a partial drawing segment (used in erase-partial operations)
 */
export function validatePartialSegment(segment: unknown, index: number): ValidationResult {
  if (!isRecord(segment)) {
    return { valid: false, error: `erase-partial: segment ${index} must be an object` };
  }

  const payload = segment as DrawingSegmentPayload;

  if (payload.type !== "freehand") {
    return { valid: false, error: "erase-partial: segment type must be freehand" };
  }

  if (!Array.isArray(payload.points)) {
    return { valid: false, error: "erase-partial: segments must provide point arrays" };
  }
  if (payload.points.length < 2) {
    return { valid: false, error: "erase-partial: segments must contain at least 2 points" };
  }
  if (payload.points.length > MAX_SEGMENT_POINTS) {
    return {
      valid: false,
      error: `erase-partial: segment exceeds point limit (max ${MAX_SEGMENT_POINTS})`,
    };
  }
  if (!payload.points.every((point) => isPoint(point))) {
    return { valid: false, error: "erase-partial: segment points must contain finite coordinates" };
  }

  if (
    typeof payload.color !== "string" ||
    payload.color.length === 0 ||
    payload.color.length > 128
  ) {
    return { valid: false, error: "erase-partial: segment color must be a non-empty string" };
  }

  if (!isFiniteNumber(payload.width) || payload.width <= 0 || payload.width > 200) {
    return { valid: false, error: "erase-partial: segment width must be between 0 and 200" };
  }

  if (!isFiniteNumber(payload.opacity) || payload.opacity < 0 || payload.opacity > 1) {
    return { valid: false, error: "erase-partial: segment opacity must be between 0 and 1" };
  }

  if ("filled" in payload && payload.filled !== undefined && typeof payload.filled !== "boolean") {
    return { valid: false, error: "erase-partial: segment filled flag must be boolean" };
  }

  if ("owner" in payload && payload.owner !== undefined && typeof payload.owner !== "string") {
    return { valid: false, error: "erase-partial: segment owner must be a string when provided" };
  }

  if ("selectedBy" in payload && payload.selectedBy !== undefined) {
    return { valid: false, error: "erase-partial: segment cannot include selection metadata" };
  }

  return { valid: true };
}

/**
 * Validate a staging zone payload
 */
export function validateStagingZone(value: unknown, context: string): ValidationResult {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  if (!isRecord(value)) {
    return { valid: false, error: `${context}: zone must be an object, null, or undefined` };
  }

  const zone = value as MessageRecord;

  if (!isFiniteNumber(zone.x) || !isFiniteNumber(zone.y)) {
    return { valid: false, error: `${context}: zone x/y must be finite numbers` };
  }
  if (!isFiniteNumber(zone.width) || !isFiniteNumber(zone.height)) {
    return { valid: false, error: `${context}: zone width/height must be finite numbers` };
  }

  if (Math.abs(zone.width as number) < 0.5 || Math.abs(zone.height as number) < 0.5) {
    return { valid: false, error: `${context}: zone width/height must be at least 0.5` };
  }

  if (
    "rotation" in zone &&
    zone.rotation !== undefined &&
    !isFiniteNumber(zone.rotation as number)
  ) {
    return { valid: false, error: `${context}: zone rotation must be a number when provided` };
  }

  return { valid: true };
}

/**
 * Validate a drawing payload structure
 */
export function validateDrawingPayload(drawing: unknown, context: string): ValidationResult {
  if (!isRecord(drawing)) {
    return { valid: false, error: `${context}: drawing must be an object` };
  }

  const payload = drawing as MessageRecord;

  if (payload.id !== undefined && typeof payload.id !== "string") {
    return { valid: false, error: `${context}: drawing id must be a string` };
  }

  if (typeof payload.type !== "string" || payload.type.length === 0) {
    return { valid: false, error: `${context}: drawing type must be a non-empty string` };
  }

  if (!Array.isArray(payload.points) || payload.points.length === 0) {
    return { valid: false, error: `${context}: drawing must include point coordinates` };
  }

  if (payload.points.length > MAX_SEGMENT_POINTS) {
    return {
      valid: false,
      error: `${context}: drawing exceeds point limit (max ${MAX_SEGMENT_POINTS})`,
    };
  }

  if (!payload.points.every((point) => isPoint(point))) {
    return { valid: false, error: `${context}: drawing points must contain finite coordinates` };
  }

  if (
    typeof payload.color !== "string" ||
    payload.color.length === 0 ||
    payload.color.length > 128
  ) {
    return { valid: false, error: `${context}: drawing color must be a non-empty string` };
  }

  if (!isFiniteNumber(payload.width) || payload.width <= 0 || payload.width > 200) {
    return { valid: false, error: `${context}: drawing width must be between 0 and 200` };
  }

  if (!isFiniteNumber(payload.opacity) || payload.opacity < 0 || payload.opacity > 1) {
    return { valid: false, error: `${context}: drawing opacity must be between 0 and 1` };
  }

  if ("filled" in payload && payload.filled !== undefined && typeof payload.filled !== "boolean") {
    return { valid: false, error: `${context}: drawing filled flag must be boolean` };
  }

  if ("owner" in payload && payload.owner !== undefined && typeof payload.owner !== "string") {
    return { valid: false, error: `${context}: drawing owner must be a string when provided` };
  }

  if ("selectedBy" in payload && payload.selectedBy !== undefined) {
    return { valid: false, error: `${context}: drawing cannot include selection metadata` };
  }

  return { valid: true };
}
