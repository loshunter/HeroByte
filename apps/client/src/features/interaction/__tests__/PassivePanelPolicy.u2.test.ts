import { afterEach, describe, expect, it } from "vitest";
import { createEscapeRegistry } from "../escapeRegistry";
import type { EscapeRoot, LayerOwner } from "../escapeTypes";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0).reverse()) close();
});

function fixture() {
  const rootNode = document.createElement("section");
  const dice = document.createElement("div");
  const lower = document.createElement("input");
  const result = document.createElement("div");
  const upper = document.createElement("input");
  dice.append(lower, result);
  result.append(upper);
  rootNode.append(dice);
  document.body.append(rootNode);
  const root: EscapeRoot = { node: () => rootNode, band: () => 1000 };
  const registry = createEscapeRegistry(() => undefined);
  const register = (anchor: HTMLElement, localBand: number, kind: LayerOwner["kind"] = "panel") => {
    const close = registry.register(() => ({
      kind,
      name: `test-${kind}`,
      active: true,
      root,
      anchor,
      localBand,
    }));
    cleanups.push(close);
    return close;
  };
  cleanups.push(() => rootNode.remove());
  register(dice, 0);
  return { rootNode, dice, lower, result, upper, root, registry, register };
}

describe("same-root passive content panels preserve the Escape ladder", () => {
  it("a higher passive panel blocks retained local editors/history below it, not its own input", () => {
    const { registry, register, result, lower, upper, root } = fixture();
    expect(registry.isForeground({ root, anchor: lower })).toBe(true);
    const close = register(result, 1001);
    const escape = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    expect(registry.canHandleLocalEscape(escape, { root, anchor: lower })).toBe(false);
    expect(registry.isForeground({ root, anchor: lower })).toBe(false);
    expect(registry.isForeground({ root, anchor: upper })).toBe(true);
    close();
    expect(registry.isForeground({ root, anchor: lower })).toBe(true);
  });

  it("a live gesture cancels before the idle passive panel consumes a later Escape", () => {
    const { registry, register, result } = fixture();
    let pending = true;
    let calls = 0;
    cleanups.push(
      registry.register(() => ({
        kind: "gesture",
        name: "held-stroke",
        active: pending,
        order: 20,
        handle: () => {
          pending = false;
          calls += 1;
        },
      })),
    );
    register(result, 1001);
    expect(calls).toBe(0);
    expect(registry.dispatch(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("handled");
    expect(calls).toBe(1);
    expect(registry.dispatch(new KeyboardEvent("keydown", { key: "Escape" }))).toBe("handled");
    expect(calls).toBe(1);
  });

  it.each(["modal", "popover"] as const)(
    "%s keeps first priority over same-root panels",
    (kind) => {
      const { registry, register, result, rootNode, lower, upper, root } = fixture();
      register(result, 1001);
      const blocker = document.createElement("div");
      const blockerInput = document.createElement("input");
      blocker.append(blockerInput);
      rootNode.append(blocker);
      register(blocker, 10, kind);
      expect(registry.isForeground({ root, anchor: lower })).toBe(false);
      expect(registry.isForeground({ root, anchor: upper })).toBe(false);
      expect(registry.isForeground({ root, anchor: blockerInput })).toBe(true);
    },
  );

  it("equal-band passive panels use real DOM order rather than registration order", () => {
    const { registry, register, rootNode, result, upper, root } = fixture();
    const later = document.createElement("div");
    const laterInput = document.createElement("input");
    later.append(laterInput);
    rootNode.append(later);
    register(later, 1001);
    register(result, 1001);
    expect(registry.isForeground({ root, anchor: upper })).toBe(false);
    expect(registry.isForeground({ root, anchor: laterInput })).toBe(true);
  });

  it("an unresolved exact panel tie blocks local handling conservatively", () => {
    const { registry, register, result, upper, root } = fixture();
    register(result, 1001);
    register(result, 1001);
    expect(registry.isForeground({ root, anchor: upper })).toBe(false);
  });
});
