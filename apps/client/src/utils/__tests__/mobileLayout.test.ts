/**
 * The layout predicate, tested at the sizes where the two old copies of it
 * disagreed. DraggableWindow's `innerWidth < 768` and App.tsx's media query
 * gave different answers on a landscape phone, on a tablet, and on a narrowed
 * desktop window — so those three are the cases that matter here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isLayoutForced, isMobileLayout, MOBILE_LAYOUT_QUERY } from "../mobileLayout";

const originalMatchMedia = window.matchMedia;

/** Pose as a device: viewport size plus whether the pointer is coarse. */
function poseAs({
  width,
  height,
  coarsePointer = false,
  search = "",
}: {
  width: number;
  height: number;
  coarsePointer?: boolean;
  search?: string;
}) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
  window.history.replaceState({}, "", `/${search}`);

  // jsdom's matchMedia never evaluates a query, so the whole media half of the
  // rule is invisible without this — a stub that returned false throughout
  // would let a tablet read as desktop and the test would still pass.
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === MOBILE_LAYOUT_QUERY && (width <= 700 || (coarsePointer && width <= 1024)),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("isMobileLayout", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("is true on a portrait phone", () => {
    poseAs({ width: 375, height: 812, coarsePointer: true });
    expect(isMobileLayout()).toBe(true);
  });

  it("is true on a LANDSCAPE phone, which is wider than 768", () => {
    // The case DraggableWindow got wrong: 812 > 768, so it rendered its desktop
    // dress inside the phone shell, with a 24px close button.
    poseAs({ width: 812, height: 375, coarsePointer: true });
    expect(isMobileLayout()).toBe(true);
  });

  it("is true on a tablet, which is wider still", () => {
    poseAs({ width: 1024, height: 768, coarsePointer: true });
    expect(isMobileLayout()).toBe(true);
  });

  it("is false on a desktop window narrowed past 768", () => {
    // The disagreement in the other direction: MainLayout stayed, while the
    // window went full-screen mobile over the top of it.
    poseAs({ width: 750, height: 900, coarsePointer: false });
    expect(isMobileLayout()).toBe(false);
  });

  it("is false on a full desktop", () => {
    poseAs({ width: 1440, height: 900, coarsePointer: false });
    expect(isMobileLayout()).toBe(false);
  });

  it("is true on a short viewport a fine pointer would otherwise keep on desktop", () => {
    poseAs({ width: 900, height: 500, coarsePointer: false });
    expect(isMobileLayout()).toBe(true);
  });

  describe("the ?mobile override", () => {
    it("forces mobile on a desktop viewport", () => {
      poseAs({ width: 1440, height: 900, search: "?mobile=true" });
      expect(isMobileLayout()).toBe(true);
      expect(isLayoutForced()).toBe(true);
    });

    it("forces desktop on a phone viewport", () => {
      poseAs({ width: 375, height: 812, coarsePointer: true, search: "?mobile=false" });
      expect(isMobileLayout()).toBe(false);
      expect(isLayoutForced()).toBe(true);
    });

    it("ignores any other value and is not treated as forced", () => {
      poseAs({ width: 375, height: 812, coarsePointer: true, search: "?mobile=yes" });
      expect(isMobileLayout()).toBe(true);
      expect(isLayoutForced()).toBe(false);
    });
  });

  it("falls back to the size rules where matchMedia does not exist", () => {
    poseAs({ width: 375, height: 812 });
    // @ts-expect-error — deliberately removing it, which is the environment
    // the `typeof window.matchMedia === "function"` guard exists for.
    window.matchMedia = undefined;
    expect(isMobileLayout()).toBe(true);
  });
});
