import { useLayoutEffect } from "react";
import type { EscapeRoot } from "../escapeTypes";
import { useEscapeRootContext } from "../useEscapeOwner";

export function viewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
}

export function RootProbe({ capture }: { capture: (root: EscapeRoot) => void }) {
  const root = useEscapeRootContext();
  useLayoutEffect(() => {
    if (!root) throw new Error("Expected window root context");
    capture(root);
  });
  return null;
}
