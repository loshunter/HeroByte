import { vi } from "vitest";
import type { Entry, EscapeRoot, LayerOwner, ReadOwner } from "../escapeTypes";

export function rootAt(band: number) {
  const node = document.createElement("section");
  document.body.append(node);
  const root: EscapeRoot = { node: () => node, band: () => band };
  return { node, root };
}

export function layerAt(kind: LayerOwner["kind"], band: number, name: string = kind) {
  const { node, root } = rootAt(band);
  const handle = vi.fn();
  const owner: LayerOwner = { kind, name, root, anchor: node, active: true, handle };
  const read: ReadOwner = () => owner;
  const entry: Entry = { id: Symbol(name), owner };
  return { node, root, owner, read, entry, handle };
}

export function escapeFrom(target: EventTarget = document.body, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

export function inputIn(parent: HTMLElement) {
  const node = document.createElement("input");
  parent.append(node);
  return node;
}
