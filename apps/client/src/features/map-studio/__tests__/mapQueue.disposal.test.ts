import { createElement, StrictMode, useEffect, useRef, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@herobyte/shared";
import { useMapStudioQueue } from "../useMapStudioQueue";
import type { MapOperationHandle } from "../mapOperation";
import { generation, mapDocument } from "./characterization/mapQueue.fixtures";

afterEach(cleanup);

describe("queue construction and disposal", () => {
  it("a builder that fails before the sender runs returns a terminal unsent handle", async () => {
    const sendMessage = vi.fn();
    const activeDocumentRef = { current: mapDocument() };
    const options = { sendMessage, activeDocumentRef, setSaving: vi.fn(), setError: vi.fn() };
    const h = renderHook(() => useMapStudioQueue(options));
    let handle!: MapOperationHandle;
    act(() => {
      handle = h.result.current.applyMessage(() => {
        throw new Error("Cannot construct edit");
      });
    });
    await expect(handle.completion).resolves.toMatchObject({
      status: "failed",
      kind: "cancelled-before-send",
      reason: "Cannot construct edit",
    });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(options.setSaving).toHaveBeenLastCalledWith(false);
  });

  it("StrictMode preserves an entry enqueued during the first mount effect, then real unmount settles it", async () => {
    const sendMessage = vi.fn<(message: ClientMessage) => void>();
    const activeDocumentRef = { current: mapDocument() };
    const options = { sendMessage, activeDocumentRef, setSaving: vi.fn(), setError: vi.fn() };
    let handle!: MapOperationHandle;
    const finish = vi.fn();
    const h = renderHook(
      () => {
        const queue = useMapStudioQueue(options);
        const started = useRef(false);
        useEffect(() => {
          if (started.current) return;
          started.current = true;
          handle = queue.applyMessage((document, commandId) => ({
            ...generation,
            t: "map-studio-generate",
            documentId: document.id,
            commandId,
          }));
          void handle.completion.then(finish);
        }, [queue]);
        return queue;
      },
      { wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children) },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(finish).not.toHaveBeenCalled();
    h.unmount();
    await expect(handle.completion).resolves.toMatchObject({
      status: "failed",
      kind: "completion-unavailable",
    });
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
