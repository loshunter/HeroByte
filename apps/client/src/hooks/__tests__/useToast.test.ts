// A toast call hands back the id it minted, so a sticky toast (duration 0)
// can be dismissed by whoever raised it when its moment passes.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useToast } from "../useToast";

describe("useToast", () => {
  it("returns the minted id, which dismiss() removes — a sticky toast has no auto-dismiss", () => {
    const { result } = renderHook(() => useToast());
    let id = "";
    act(() => {
      id = result.current.info("🚪 Kicking in the door…", 0);
    });
    expect(id).toMatch(/^toast-\d+$/);
    expect(result.current.messages).toEqual([
      { id, type: "info", message: "🚪 Kicking in the door…", duration: 0 },
    ]);
    act(() => result.current.dismiss(id));
    expect(result.current.messages).toEqual([]);
  });

  it("mints a distinct id per call across every kind", () => {
    const { result } = renderHook(() => useToast());
    const ids: string[] = [];
    act(() => {
      ids.push(result.current.success("a"), result.current.error("b"), result.current.warning("c"));
    });
    expect(new Set(ids).size).toBe(3);
  });
});
