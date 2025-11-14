// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================
// Centralized constants for validation limits and ranges

/**
 * Payload size limits for binary/base64 data
 */
export const PAYLOAD_LIMITS = {
  /** Maximum portrait size: 2MB */
  PORTRAIT_SIZE: 2 * 1024 * 1024,
  /** Maximum map background size: 10MB */
  MAP_SIZE: 10 * 1024 * 1024,
} as const;

/**
 * String length limits
 */
export const STRING_LIMITS = {
  /** Player name length: 1-50 characters */
  PLAYER_NAME_MIN: 1,
  PLAYER_NAME_MAX: 50,
  /** Character name length: 1-100 characters */
  CHARACTER_NAME_MIN: 1,
  CHARACTER_NAME_MAX: 100,
  /** Prop label length: 1-50 characters */
  PROP_LABEL_MIN: 1,
  PROP_LABEL_MAX: 50,
  /** Color string length: 1-128 characters */
  COLOR_MIN: 1,
  COLOR_MAX: 128,
  /** Image URL length: 1-2048 characters */
  IMAGE_URL_MIN: 1,
  IMAGE_URL_MAX: 2048,
  /** Secret/password length: 1-256 characters */
  SECRET_MIN: 1,
  SECRET_MAX: 256,
  /** Status effect label length: 1-64 characters */
  STATUS_EFFECT_MIN: 1,
  STATUS_EFFECT_MAX: 64,
} as const;

/**
 * Array length limits
 */
export const ARRAY_LIMITS = {
  /** Maximum status effects per player */
  STATUS_EFFECTS: 16,
  /** Maximum objects in multi-select operations */
  SELECTION_OBJECTS: 100,
  /** Maximum partial segments in erase operations (also in commonValidators) */
  PARTIAL_SEGMENTS: 50,
  /** Maximum synced drawings */
  SYNCED_DRAWINGS: 200,
  /** Maximum points per drawing segment (also in commonValidators) */
  SEGMENT_POINTS: 10_000,
} as const;

/**
 * Numeric range limits
 */
export const RANGE_LIMITS = {
  /** Grid size in pixels */
  GRID_SIZE_MIN: 10,
  GRID_SIZE_MAX: 500,
  /** Grid square size in feet */
  GRID_SQUARE_SIZE_MIN: 0.1,
  GRID_SQUARE_SIZE_MAX: 100,
  /** Object scale multiplier (non-staging zones) */
  OBJECT_SCALE_MIN: 0.1,
  OBJECT_SCALE_MAX: 10,
  /** Staging zone minimum size (absolute value of width/height) */
  STAGING_ZONE_SIZE_MIN: 0.5,
  /** Mic level range */
  MIC_LEVEL_MIN: 0,
  MIC_LEVEL_MAX: 1,
} as const;
