// A player whose view was a moment stale (the DM had just locked the door) clicked it
// as if it were shut but free: the sprite could not see the lock, the server refused,
// and the refusal reached only the console. The server now says `door-refused` to the
// one who tried, and the switchboard answers it as the sprite would have.

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@herobyte/shared";
import { useServerEventHandlers } from "../useServerEventHandlers.js";
import { sfxEngine } from "../../features/juice/sfxEngine";

describe("door-refused events", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toasts the locked-door words and rattles the latch", () => {
    vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
    const registerServerEventHandler = vi.fn();
    const toast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
      messages: [],
    };
    renderHook(() =>
      useServerEventHandlers({ registerServerEventHandler, toast, sendMessage: vi.fn() }),
    );
    const handler = registerServerEventHandler.mock.calls[0][0] as (m: ServerMessage) => void;
    act(() => handler({ t: "door-refused", doorId: "door-1" } as ServerMessage));
    expect(toast.error).toHaveBeenCalledWith("This door is locked. Only the DM can open it.", 4000);
    expect(sfxEngine.play).toHaveBeenCalledWith("doorClunk", expect.anything());
  });
});
