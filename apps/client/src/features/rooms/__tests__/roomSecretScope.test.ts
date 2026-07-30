/**
 * The stashed room password is scoped PER TABLE.
 *
 * It used to live under one flat sessionStorage key. Because switching tables
 * is a same-tab navigation, the auth gate would then auto-submit the PREVIOUS
 * table's password against the new room — so clicking a chip under "Your
 * tables" or "Back to Main Hall" landed you on a red "Invalid room password"
 * you never caused, having typed nothing.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ROOM_SECRET_STORAGE_KEY,
  stashRoomSecret,
  readRoomSecret,
  clearRoomSecret,
} from "../roomDirectory";

describe("room secret scoping", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("does not hand one table's password to another", () => {
    stashRoomSecret("dragons-pw", "dragons-den");
    stashRoomSecret("keep-pw", "the-keep");

    expect(readRoomSecret("dragons-den")).toBe("dragons-pw");
    expect(readRoomSecret("the-keep")).toBe("keep-pw");
  });

  it("returns nothing for a table that has no stashed password", () => {
    stashRoomSecret("dragons-pw", "dragons-den");

    // The bug: this used to return "dragons-pw" and auto-submit it.
    expect(readRoomSecret("never-visited")).toBe("");
  });

  it("keeps the default table on the unsuffixed key", () => {
    stashRoomSecret("main-hall-pw", undefined);

    expect(sessionStorage.getItem(ROOM_SECRET_STORAGE_KEY)).toBe("main-hall-pw");
    expect(readRoomSecret(undefined)).toBe("main-hall-pw");
  });

  it("clears only the table it was asked to clear", () => {
    stashRoomSecret("dragons-pw", "dragons-den");
    stashRoomSecret("keep-pw", "the-keep");

    clearRoomSecret("dragons-den");

    expect(readRoomSecret("dragons-den")).toBe("");
    expect(readRoomSecret("the-keep")).toBe("keep-pw");
  });
});
