/**
 * Test-only mock CanvasRenderingContext2D: records every method call and
 * property set, in order, so draw sequences can be asserted call-for-call.
 */
export type RecordedCall = [op: string, ...args: unknown[]];

export function createRecordingContext() {
  const calls: RecordedCall[] = [];
  const context: Record<string, unknown> = {};
  for (const method of [
    "fillRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "save",
    "restore",
    "setTransform",
    "rect",
    "clip",
    "clearRect",
    "drawImage",
  ]) {
    context[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
    };
  }
  for (const property of ["fillStyle", "strokeStyle", "lineWidth", "globalAlpha"]) {
    Object.defineProperty(context, property, {
      set: (value: unknown) => {
        calls.push([`set:${property}`, value]);
      },
    });
  }
  return { context, calls };
}

/** True when `calls` contains `first` immediately followed by `second`. */
export function hasCallPair(
  calls: RecordedCall[],
  first: RecordedCall,
  second: RecordedCall,
): boolean {
  return calls.some(
    (call, index) =>
      JSON.stringify(call) === JSON.stringify(first) &&
      JSON.stringify(calls[index + 1]) === JSON.stringify(second),
  );
}
