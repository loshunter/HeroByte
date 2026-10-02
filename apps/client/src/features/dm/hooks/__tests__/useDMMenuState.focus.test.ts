// Which opens of the DM menu ask for focus: only the ones a request caused (the Table
// menu's "Table settings…"), and the ask is forgotten when the menu closes.
import { afterEach, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDMMenuState } from "../useDMMenuState";
import { __resetDMMenuRequestsForTests, requestDMMenuTab } from "../../../table/menuRequest";

afterEach(() => __resetDMMenuRequestsForTests());

const mount = () => renderHook(() => useDMMenuState({ isDM: true, characters: [] }));

it("asks for focus when a request opens it, and again for each later request", () => {
  const { result } = mount();
  expect(result.current.focusTabRequest).toBe(0);
  act(() => requestDMMenuTab("table"));
  expect(result.current.focusTabRequest).toBe(1);
  act(() => requestDMMenuTab("table"));
  expect(result.current.focusTabRequest).toBe(2);
});

it("asks for focus when a request was waiting at mount (the phone's DM screen)", () => {
  requestDMMenuTab("table");
  expect(mount().result.current.focusTabRequest).toBe(1);
});

it("does not ask when the launcher opens it", () => {
  const { result } = mount();
  act(() => result.current.toggleOpen());
  expect(result.current.open).toBe(true);
  expect(result.current.focusTabRequest).toBe(0);
});

it("forgets the ask when the menu closes, so the launcher's next open does not take focus", () => {
  const { result } = mount();
  act(() => requestDMMenuTab("table"));
  act(() => result.current.setOpen(false));
  expect(result.current.focusTabRequest).toBe(0);
  act(() => result.current.toggleOpen());
  expect(result.current.focusTabRequest).toBe(0);
});
