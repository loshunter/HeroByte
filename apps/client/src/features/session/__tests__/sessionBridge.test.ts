// The bridge holds one waiter for the server's backup reply (a file or a refusal). A
// stale unsubscribe must leave a newer waiter alone, and a current one must clear both.

import { describe, expect, it, vi } from "vitest";
import { awaitSessionFile, deliverSessionFile, deliverSessionRefusal } from "../sessionBridge";
import type { SessionFile } from "@herobyte/shared";

describe("sessionBridge", () => {
  it("clears the refusal handler with the file handler, and only its own", () => {
    const first = { file: vi.fn(), refused: vi.fn() };
    const second = { file: vi.fn(), refused: vi.fn() };
    const stopFirst = awaitSessionFile(first.file, first.refused);
    const stopSecond = awaitSessionFile(second.file, second.refused);

    stopFirst(); // stale: a re-render replaced it already
    deliverSessionRefusal("too big");
    expect(second.refused).toHaveBeenCalledWith("too big");
    expect(first.refused).not.toHaveBeenCalled();

    stopSecond();
    deliverSessionRefusal("again");
    deliverSessionFile({} as SessionFile);
    expect(second.refused).toHaveBeenCalledTimes(1);
    expect(second.file).not.toHaveBeenCalled();
  });
});
