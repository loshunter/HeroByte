import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetDMMenuRequestsForTests,
  requestDMMenuTab,
  subscribeDMMenuRequests,
  takeDMMenuTabRequest,
} from "../menuRequest";

afterEach(() => __resetDMMenuRequestsForTests());

describe("menuRequest — 'Table settings…' asks the DM menu for a tab", () => {
  it("hands a live request to whoever takes it, once", () => {
    requestDMMenuTab("table", 1_000);
    expect(takeDMMenuTabRequest(1_500)).toBe("table");
    expect(takeDMMenuTabRequest(1_500)).toBeNull();
  });

  it("lets a request nobody took expire, so a later mount never opens at a stale tab", () => {
    requestDMMenuTab("table", 1_000);
    expect(takeDMMenuTabRequest(1_000 + 10_001)).toBeNull();
    // The expired request is gone, not merely skipped.
    expect(takeDMMenuTabRequest(1_100)).toBeNull();
  });

  it("still lands after a slow chunk load, right up to the lifetime", () => {
    requestDMMenuTab("table", 1_000);
    expect(takeDMMenuTabRequest(1_000 + 9_000)).toBe("table");
    requestDMMenuTab("table", 1_000);
    expect(takeDMMenuTabRequest(1_000 + 10_000)).toBe("table");
  });

  it("the newest request wins", () => {
    requestDMMenuTab("npcs", 1_000);
    requestDMMenuTab("table", 1_100);
    expect(takeDMMenuTabRequest(1_200)).toBe("table");
  });

  it("tells a mounted menu the moment a request is made, until it unsubscribes", () => {
    const heard = vi.fn();
    const unsubscribe = subscribeDMMenuRequests(heard);
    requestDMMenuTab("table");
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestDMMenuTab("table");
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
