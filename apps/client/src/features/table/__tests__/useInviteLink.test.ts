import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInviteLink } from "../useInviteLink";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("useInviteLink — what the link to this table carries", () => {
  it("points the page at this table's room code", () => {
    window.history.replaceState(null, "", "/?room=table-abc123");
    const { result } = renderHook(() => useInviteLink());
    expect(new URL(result.current.link).searchParams.get("room")).toBe("table-abc123");
    expect(result.current.roomId).toBe("table-abc123");
  });

  it("never carries this tab's pinned identity: an invitee must not be handed the host's uid", () => {
    // `?sessionUid=` pins a tab's uid (the e2e and two-client-review setups do it). A link
    // copied from such a tab would give every invitee the host's id — "Held in another
    // window" for them, and the host's seat once its grace window ran out.
    window.history.replaceState(null, "", "/?room=table-abc123&sessionUid=host-pin");
    const { result } = renderHook(() => useInviteLink());
    const url = new URL(result.current.link);
    expect(url.searchParams.get("room")).toBe("table-abc123");
    expect(url.searchParams.has("sessionUid")).toBe(false);
    expect(result.current.link).not.toContain("host-pin");
  });

  it("keeps the server address a LAN table needs", () => {
    window.history.replaceState(
      null,
      "",
      "/?room=table-abc123&sessionUid=host-pin&ws=ws%3A%2F%2F192.168.1.5%3A8787",
    );
    const { result } = renderHook(() => useInviteLink());
    expect(new URL(result.current.link).searchParams.get("ws")).toBe("ws://192.168.1.5:8787");
  });
});
