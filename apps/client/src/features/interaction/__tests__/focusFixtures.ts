import { vi } from "vitest";

export function frameQueue() {
  let next = 0;
  const queued = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    queued.set(++next, callback);
    return next;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    queued.delete(id);
  });
  return {
    count: () => queued.size,
    flush() {
      const callbacks = [...queued.values()];
      queued.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

export function visible<T extends HTMLElement>(node: T): T {
  const rect = new DOMRect(0, 0, 44, 44);
  const rectangles = {
    0: rect,
    length: 1,
    item: (index: number) => (index === 0 ? rect : null),
    [Symbol.iterator]: () => [rect].values(),
  };
  const measuredNode: HTMLElement = node;
  vi.spyOn(measuredNode, "getClientRects").mockReturnValue(rectangles);
  return node;
}

export function launcher(parent = document.body) {
  const button = visible(document.createElement("button"));
  button.textContent = "Open";
  parent.append(button);
  return button;
}

export function panel() {
  const frame = document.createElement("section");
  const input = document.createElement("input");
  frame.append(input);
  document.body.append(frame);
  input.focus();
  return { frame, input };
}
