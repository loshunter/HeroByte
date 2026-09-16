/** The CRT toggle must survive a reload and remain usable without storage. */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCrtPreferenceForTests } from "../crtPreference";
import { useCrtPreference } from "../useCrtPreference";

const KEY = "herobyte:crt";
const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage")!;
let values: Map<string, string>;
let getItem: ReturnType<typeof vi.fn>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(() => {
  values = new Map();
  getItem = vi.fn((key: string) => values.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => values.set(key, value));
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem, setItem },
  });
  __resetCrtPreferenceForTests();
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "localStorage", originalStorage);
  __resetCrtPreferenceForTests();
});

describe("useCrtPreference", () => {
  it("reads a saved true preference without writing on mount", () => {
    values.set(KEY, "true");
    __resetCrtPreferenceForTests();

    const { result } = renderHook(useCrtPreference);
    expect(result.current[0]).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each([null, "false", "invalid"])("defaults to off for %s without creating a key", (stored) => {
    if (stored !== null) values.set(KEY, stored);
    __resetCrtPreferenceForTests();

    const { result } = renderHook(useCrtPreference);
    expect(result.current[0]).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("writes only changes and restores both on and off after a fresh read", () => {
    for (const enabled of [true, false]) {
      const mounted = renderHook(useCrtPreference);
      act(() => mounted.result.current[1](enabled));
      expect(mounted.result.current[0]).toBe(enabled);
      expect(setItem).toHaveBeenLastCalledWith(KEY, String(enabled));
      const writeCount = setItem.mock.calls.length;
      act(() => mounted.result.current[1](enabled));
      expect(setItem).toHaveBeenCalledTimes(writeCount);
      mounted.unmount();

      __resetCrtPreferenceForTests();
      const reloaded = renderHook(useCrtPreference);
      expect(reloaded.result.current[0]).toBe(enabled);
      expect(setItem).toHaveBeenCalledTimes(writeCount);
      reloaded.unmount();
    }
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it("reads storage once and shares changes across consumers and layout remounts", () => {
    getItem.mockClear();
    const first = renderHook(useCrtPreference);
    const second = renderHook(useCrtPreference);
    act(() => first.result.current[1](true));
    expect(second.result.current[0]).toBe(true);
    first.rerender();
    first.unmount();
    second.unmount();
    const remounted = renderHook(useCrtPreference);
    expect(remounted.result.current[0]).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it.each(["read", "write", "accessor"])("still toggles when storage %s throws", (failure) => {
    const blocked = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    if (failure === "read") getItem.mockImplementation(blocked);
    if (failure === "write") setItem.mockImplementation(blocked);
    if (failure === "accessor") {
      Object.defineProperty(window, "localStorage", { configurable: true, get: blocked });
    }
    __resetCrtPreferenceForTests();

    const { result } = renderHook(useCrtPreference);
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });
});
