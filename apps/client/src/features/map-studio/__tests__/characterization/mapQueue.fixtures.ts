import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, StrictMode, useEffect, type PropsWithChildren } from "react";
import { afterEach, vi } from "vitest";
import { createMapDocument, type ClientMessage, type MapDocument } from "@herobyte/shared";
import * as uuid from "../../../../utils/uuid";
import { useMapStudio } from "../../useMapStudio";
import type { GenerateInput, MapStudioServerMessage } from "../../types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

export type QueueMessage = Extract<
  ClientMessage,
  { t: "map-studio-command" | "map-studio-generate" }
>;
export const generation: GenerateInput = {
  recipe: "dungeon",
  seed: 42,
  bounds: { x: 0, y: 0, cols: 24, rows: 20 },
  params: { theme: "stone", density: "medium" },
};

export function mapDocument(id = "doc-a", revision = 3): MapDocument {
  return {
    ...createMapDocument({ id, name: id, width: 2000, height: 2000, timestamp: 1 }),
    revision,
  };
}

export function wireId(message: QueueMessage): string {
  return message.t === "map-studio-command" ? message.command.commandId : message.commandId;
}

function EffectReplayProbe({
  children,
  lifecycle,
}: PropsWithChildren<{ lifecycle: { setup: () => void; cleanup: () => void } }>) {
  useEffect(() => {
    lifecycle.setup();
    return lifecycle.cleanup;
  }, [lifecycle]);
  return children;
}

export function queueHarness(
  initialDocument: MapDocument | null = mapDocument(),
  options: { strictMode?: boolean } = {},
) {
  let sequence = 0;
  const mint = vi.spyOn(uuid, "generateUUID").mockImplementation(() => `wire-${++sequence}`);
  const send = vi.fn<(message: ClientMessage) => void>();
  const effectLifecycle = { setup: vi.fn(), cleanup: vi.fn() };
  const wrapper = options.strictMode
    ? function StrictModeWrapper({ children }: PropsWithChildren) {
        return createElement(
          StrictMode,
          null,
          createElement(EffectReplayProbe, { lifecycle: effectLifecycle }, children),
        );
      }
    : undefined;
  const hook = renderHook(({ connected }) => useMapStudio(send, undefined, connected), {
    initialProps: { connected: true },
    wrapper,
  });
  const receive = (message: MapStudioServerMessage) => {
    act(() => hook.result.current.handleServerMessage(message));
  };
  const documentFrame = (document: MapDocument, appliedCommandId?: string) => {
    receive({ t: "map-studio-document", document, appliedCommandId });
  };
  const commands = () =>
    send.mock.calls
      .map(([message]) => message)
      .filter(
        (message): message is QueueMessage =>
          message.t === "map-studio-command" || message.t === "map-studio-generate",
      );
  const command = (index = 0): QueueMessage => {
    const message = commands()[index];
    if (!message) throw new Error(`No queued wire message at index ${index}`);
    return message;
  };
  const refuse = (
    commandId: string,
    documentId = "doc-a",
    code: Extract<MapStudioServerMessage, { t: "map-studio-error" }>["code"] = "command-rejected",
    reason = "Rejected by server",
  ) => receive({ t: "map-studio-error", commandId, documentId, code, reason });
  const open = (document: MapDocument) => {
    act(() => hook.result.current.openDocument(document.id));
    documentFrame(document);
  };
  if (initialDocument) documentFrame(initialDocument);
  return {
    ...hook,
    mint,
    send,
    effectLifecycle,
    receive,
    documentFrame,
    commands,
    command,
    refuse,
    open,
    connection: (connected: boolean) => hook.rerender({ connected }),
  };
}
