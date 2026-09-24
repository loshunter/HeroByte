// MouseEvent('pointerdown') is a synthetic jsdom stand-in, NOT trusted touch evidence.
import { act, cleanup, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  at,
  expectCommit,
  expectNoCommands,
  expectPreviewCleared,
  kinds,
  label,
  mountDock,
} from "./mobileCancel.fixtures";

afterEach(cleanup);
describe.each(kinds)("real %s driver and real five-slot mobile dock", (kind) => {
  it("a second-pointer press with no click cancels immediately and preserves the slot, tool and next commit", () => {
    const mounted = mountDock(kind);
    const { result, button, dock } = mounted;
    expect(button).toHaveAccessibleName(label(kind));
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Stop");
    expect(button.textContent?.replace("⨯", "").trim()).toBe("Stop");
    expect(button.style.minWidth).toBe("44px");
    expect(button.style.minHeight).toBe("44px");
    expect(within(dock).getAllByRole("button")).toHaveLength(5);

    act(() => result.current.map.onMouseDown(at(100, 100), "touch"));
    act(() => result.current.map.onMouseMove(at(200, 100), "touch"));
    expect(button).toBeEnabled();
    expectNoCommands(mounted);
    if (kind === "wall") expect(result.current.map.previewDrag).not.toBeNull();
    if (kind === "place") expect(result.current.map.placementGhost).not.toBeNull();
    if (kind === "terrain" || kind === "erase")
      expect(result.current.map.strokeCells.length).toBeGreaterThan(0);

    const press = new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true });
    fireEvent(button, press); // The original canvas finger remains held; no click is dispatched.
    expect(press.defaultPrevented).toBe(true);
    expect(button).toBeDisabled();
    expect(button).toBeInTheDocument();
    expect(within(dock).getAllByRole("button")[4]).toBe(button);
    expect(within(dock).getAllByRole("button")).toHaveLength(5);
    expectPreviewCleared(mounted);
    expect(result.current.tool.activeTool).toBe("map-edit");
    expect(result.current.selectedObjectId).toBe("token:owned");
    act(() => {
      result.current.map.onMouseMove(at(240, 140), "touch");
      result.current.map.onMouseUp("touch");
      result.current.map.onMouseUp("touch");
    });
    expectNoCommands(mounted);

    // Positive control, including a late compatibility click from the old press.
    act(() => result.current.map.onMouseDown(at(300, 300), "touch"));
    expect(button).toBeEnabled();
    fireEvent.click(button, { detail: 1 });
    expect(button).toBeEnabled();
    act(() => result.current.map.onMouseMove(at(400, 300), "touch"));
    act(() => result.current.map.onMouseUp("touch"));
    expectCommit(mounted, kind);
    expect(button).toBeDisabled();
    expect(within(dock).getAllByRole("button")[4]).toBe(button);
  });

  it("keyboard click detail 0 cancels through the same live owner, and right-button press does not", () => {
    const mounted = mountDock(kind);
    const { result, button } = mounted;
    act(() => result.current.map.onMouseDown(at(100, 100), "touch"));
    act(() => result.current.map.onMouseMove(at(200, 100), "touch"));
    fireEvent(
      button,
      new MouseEvent("pointerdown", { button: 2, bubbles: true, cancelable: true }),
    );
    expect(button).toBeEnabled();
    fireEvent.click(button, { detail: 0 });
    expect(button).toBeDisabled();
    expectPreviewCleared(mounted);
    act(() => {
      result.current.map.onMouseMove(at(240, 140), "touch");
      result.current.map.onMouseUp("touch");
    });
    expectNoCommands(mounted);
  });
});

it("the pending label comes from the real gesture rather than the dock's stale fallback", () => {
  const mounted = mountDock("terrain", "wall");
  expect(mounted.button).toHaveAccessibleName("Cancel placement");
  act(() => mounted.result.current.map.onMouseDown(at(100, 100), "touch"));
  expect(mounted.button).toHaveAccessibleName("Cancel stroke");
  fireEvent.click(mounted.button, { detail: 0 });
  expect(mounted.button).toHaveAccessibleName("Cancel placement");
  expect(mounted.button).toBeDisabled();
});
