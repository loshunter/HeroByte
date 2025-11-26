/**
 * Feature flag helpers for incremental rollouts.
 * All flags default to enabled unless explicitly set to "false".
 */

function isEnabled(envVar: string | undefined): boolean {
  if (envVar === undefined) {
    return true;
  }
  return envVar.toLowerCase() !== "false";
}

export function isDeltaChannelEnabled(): boolean {
  return isEnabled(process.env.FEATURE_FLAG_DELTAS);
}

export function isCommandAckEnabled(): boolean {
  return isEnabled(process.env.FEATURE_FLAG_ACKS);
}

export function isDragPreviewEnabled(): boolean {
  return isEnabled(process.env.FEATURE_FLAG_DRAG_PREVIEWS);
}
