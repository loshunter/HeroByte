// Save & Go There: the fork hook's two jobs after the server says yes — seed the
// new table's password and name before the full navigation, and (U9) leave the
// note that this tab made it, so the host is shown their next steps on arrival.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ServerMessage } from "@herobyte/shared";
import { useForkTable } from "../useForkTable";
import { readRoomSecret } from "../roomDirectory";
import { readNewTable } from "../../table/newTableMarker";
import { installMemoryStorage } from "../../../test-utils/memoryStorage";

function mount() {
  const sendMessage = vi.fn();
  const navigate = vi.fn();
  let handler: ((message: ServerMessage) => void) | undefined;
  const hook = renderHook(() =>
    useForkTable(
      sendMessage,
      (register) => {
        handler = register;
      },
      navigate,
    ),
  );
  const reply = (message: Record<string, unknown>) =>
    act(() => handler?.(message as unknown as ServerMessage));
  return { ...hook, sendMessage, navigate, reply };
}

beforeEach(() => installMemoryStorage());
afterEach(() => vi.useRealTimers());

describe("useForkTable", () => {
  it("on success seeds the secret, marks the table as this tab's, then navigates", async () => {
    const { result, sendMessage, navigate, reply } = mount();

    let done: Promise<void>;
    act(() => {
      done = result.current({ name: "Sunday Game", roomPassword: "sundaypass" });
    });
    const sent = sendMessage.mock.calls[0]![0] as { t: string; roomId: string };
    expect(sent.t).toBe("fork-table");

    reply({ t: "table-forked", roomId: sent.roomId, name: "Sunday Game" });
    await done!;

    expect(readRoomSecret(sent.roomId)).toBe("sundaypass");
    expect(readNewTable(sent.roomId)).toBe(true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(sent.roomId);
  });

  it("on refusal leaves no note, seeds nothing and does not navigate", async () => {
    const { result, sendMessage, navigate, reply } = mount();

    let done: Promise<void>;
    act(() => {
      done = result.current({ name: "Sunday Game", roomPassword: "sundaypass" });
    });
    const sent = sendMessage.mock.calls[0]![0] as { roomId: string };
    reply({ t: "table-fork-failed", reason: "Too big" });

    await expect(done!).rejects.toThrow("Too big");
    expect(readNewTable(sent.roomId)).toBe(false);
    expect(readRoomSecret(sent.roomId)).toBe("");
    expect(navigate).not.toHaveBeenCalled();
  });
});
