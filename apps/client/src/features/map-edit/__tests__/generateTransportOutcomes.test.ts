import { useEffect } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMapDocument, type ClientMessage, type ServerMessage } from "@herobyte/shared";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useMapStudio } from "../../map-studio/useMapStudio";
import { useGenerate } from "../useGenerate";
import {
  installTransportEnvironment,
  restoreTransportEnvironment,
  TransportSocket,
} from "../../../services/__tests__/characterization/transport.fixtures";
import { vi } from "vitest";

beforeEach(installTransportEnvironment);
afterEach(() => {
  cleanup();
  restoreTransportEnvironment();
});

function setup() {
  const h = renderHook(() => {
    const network = useWebSocket({ url: "ws://localhost:8787", uid: "outcome-dm" });
    const controller = useMapStudio(
      network.send,
      network.getAuthCredentials,
      network.isConnected,
      network.registerCommandDelivery,
    );
    useEffect(
      () =>
        network.registerServerEventHandler((message) => {
          if (!("t" in message)) return;
          if (
            message.t === "map-studio-document" ||
            message.t === "map-studio-documents" ||
            message.t === "map-studio-error" ||
            message.t === "map-studio-deleted"
          )
            controller.handleServerMessage(message);
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the two bound methods the effect calls
      [network.registerServerEventHandler, controller.handleServerMessage],
    );
    return { network, controller, generate: useGenerate(controller, true, "generate", true) };
  });
  const socket = TransportSocket.instances[0]!;
  act(() => {
    socket.open();
    h.result.current.network.authenticate("test", "outcome-room");
    socket.receive({ t: "auth-ok" });
  });
  const document = createMapDocument({
    id: "transport-map",
    name: "Transport map",
    width: 2000,
    height: 2000,
    timestamp: 1,
  });
  act(() => socket.receive({ t: "map-studio-document", document }));
  act(() => {
    h.result.current.generate.setParams({ seed: 42, theme: "stone", density: "medium" });
    h.result.current.generate.onRegionDragged({ x: 0, y: 0, width: 1200, height: 1000 });
  });
  const requests = () =>
    socket
      .generationFrames()
      .map((raw) => JSON.parse(raw) as { commandId: string; documentId: string; seed: number });
  const refusal = (
    code: "command-not-applied" | "command-rejected" = "command-not-applied",
  ): Extract<ServerMessage, { t: "map-studio-error" }> => ({
    t: "map-studio-error",
    documentId: document.id,
    commandId: requests()[0]!.commandId,
    code,
    reason: "Walls are locked",
  });
  const receive = async (message: ServerMessage) => {
    await act(async () => socket.receive(message));
  };
  const generate = () => act(() => h.result.current.generate.onGenerate());
  return { ...h, socket, document, requests, refusal, receive, generate };
}

describe("Generate uses its own outcome through the real hook, service and controller", () => {
  it("a lost post-apply error followed by an uncertain cached replay never marks Built", async () => {
    const h = setup();
    h.generate();
    await h.receive({ t: "ack", commandId: h.requests()[0]!.commandId });
    act(() => vi.advanceTimersByTime(500));
    expect(h.requests()).toHaveLength(2);
    expect(h.requests()[1]).toEqual(h.requests()[0]);
    await h.receive({
      ...h.refusal("command-rejected"),
      reason:
        "This generation already affected the document, but its completion cannot be confirmed.",
    });
    expect(h.result.current.generate.hint).toMatch(/Completion unconfirmed/);
    expect(h.result.current.generate.hint).not.toMatch(/Built/);
    expect(h.result.current.generate.canGenerate).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(h.requests()).toHaveLength(2);
  });

  it("the successful same-ID replay refreshes the campaign weight after a lost first frame", async () => {
    const h = setup();
    await h.receive({ t: "map-studio-documents", documents: [], exportBytes: 100 });
    expect(h.result.current.controller.exportBytes).toBe(100);
    h.generate();
    await h.receive({ t: "ack", commandId: h.requests()[0]!.commandId });
    act(() => vi.advanceTimersByTime(500));
    expect(h.requests()).toHaveLength(2);
    expect(h.requests()[1]).toEqual(h.requests()[0]);
    await h.receive({
      t: "map-studio-document",
      document: { ...h.document, revision: 1 },
      appliedCommandId: h.requests()[0]!.commandId,
      exportBytes: 900,
    });
    expect(h.result.current.controller.exportBytes).toBe(900);
    expect(h.result.current.generate.feedback.status).toBe("succeeded");
  });
  it("a transport refusal without an application reply settles as uncertain", async () => {
    const h = setup();
    h.generate();
    await h.receive({
      t: "nack",
      commandId: h.requests()[0]!.commandId,
      reason: "Request refused",
    });
    expect(h.result.current.generate.feedback.status).toBe("failed");
    expect(h.result.current.generate.hint).toMatch(/Completion unconfirmed/);
    expect(h.result.current.generate.canGenerate).toBe(false);
    act(() => vi.advanceTimersByTime(10000));
    expect(h.requests()).toHaveLength(1);
  });
  it("retains dials after a fresh refusal, stops the old retry, and records Built only on the new matching application reply", async () => {
    const h = setup();
    h.generate();
    expect(h.result.current.generate.feedback.status).toBe("pending");
    expect(h.result.current.generate.hint).not.toMatch(/Built/);
    await h.receive({ t: "ack", commandId: h.requests()[0]!.commandId });
    expect(h.result.current.generate.feedback.status).toBe("pending");
    await h.receive(h.refusal());
    expect(h.result.current.generate.feedback.status).toBe("failed");
    expect(h.result.current.generate.hint).toMatch(/Failed.*Walls are locked/);
    expect(h.result.current.generate.canGenerate).toBe(true);
    expect(h.result.current.generate.params).toEqual({
      seed: 42,
      theme: "stone",
      density: "medium",
    });
    expect(h.result.current.generate.region).toEqual({ cols: 24, rows: 20 });
    act(() => vi.advanceTimersByTime(500));
    expect(h.requests()).toHaveLength(1);
    h.generate();
    expect(h.requests()).toHaveLength(2);
    expect(h.requests()[1]!.commandId).not.toBe(h.requests()[0]!.commandId);
    await h.receive({
      t: "map-studio-document",
      document: h.document,
      appliedCommandId: h.requests()[0]!.commandId,
    });
    expect(h.result.current.generate.feedback.status).toBe("pending");
    await h.receive({
      t: "map-studio-document",
      document: { ...h.document, revision: 1 },
      appliedCommandId: h.requests()[1]!.commandId,
    });
    expect(h.result.current.generate.feedback.status).toBe("succeeded");
    expect(h.result.current.generate.hint).toMatch(/Built here already/);
    expect(h.result.current.generate.canGenerate).toBe(false);
  });

  it("observes timed replay before a positive refusal, then requires refresh and explicit inspection without auto-generating", async () => {
    const h = setup();
    h.generate();
    act(() => vi.advanceTimersByTime(500));
    expect(h.requests()).toHaveLength(2);
    expect(h.requests()[1]).toEqual(h.requests()[0]);
    await h.receive(h.refusal());
    expect(h.result.current.generate.hint).toMatch(/Completion unconfirmed/);
    expect(h.result.current.generate.canGenerate).toBe(false);
    h.generate();
    expect(h.requests()).toHaveLength(2);
    act(() => h.result.current.generate.feedback.recovery!.acknowledge());
    expect(h.result.current.generate.canGenerate).toBe(false);
    act(() => h.result.current.generate.feedback.recovery!.refresh());
    expect(h.socket.sent.map((raw) => JSON.parse(raw))).toContainEqual(
      expect.objectContaining({ t: "map-studio-get", documentId: h.document.id }),
    );
    await h.receive({ t: "map-studio-document", document: { ...h.document, revision: 7 } });
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(false);
    const refresh = h.socket.sent
      .map((raw) => JSON.parse(raw) as ClientMessage)
      .reverse()
      .find((message) => message.t === "map-studio-get");
    if (refresh?.t !== "map-studio-get" || !refresh.requestId)
      throw new Error("Recovery must send a correlated GET");
    await h.receive({
      t: "map-studio-document",
      document: { ...h.document, revision: 7 },
      requestId: refresh.requestId,
    });
    expect(h.result.current.generate.feedback.recovery?.canAcknowledge).toBe(true);
    expect(h.result.current.generate.hint).not.toMatch(/Built/);
    act(() => h.result.current.generate.feedback.recovery!.acknowledge());
    expect(h.requests()).toHaveLength(2);
    expect(h.result.current.generate.canGenerate).toBe(true);
    h.generate();
    expect(h.requests()).toHaveLength(3);
    expect(h.requests()[2]!.commandId).not.toBe(h.requests()[0]!.commandId);
  });

  it("never calls another edit Generating, and refuses a same-turn double activation", () => {
    const h = setup();
    act(() => h.result.current.controller.updateGrid({ size: 50 }));
    expect(h.result.current.generate.feedback.status).toBe("idle");
    expect(h.result.current.generate.canGenerate).toBe(false);
    const command = h.socket.sent
      .map((raw) => JSON.parse(raw))
      .find((message) => message.t === "map-studio-command");
    act(() =>
      h.socket.receive({
        t: "map-studio-document",
        document: h.document,
        appliedCommandId: command.command.commandId,
      }),
    );
    act(() => {
      h.result.current.generate.onGenerate();
      h.result.current.generate.onGenerate();
    });
    expect(h.requests()).toHaveLength(1);
  });

  it("settles exhausted transport tracking as uncertain and ignores late success", async () => {
    const h = setup();
    h.generate();
    await act(async () => vi.advanceTimersByTime(7500));
    expect(h.requests()).toHaveLength(4);
    expect(h.result.current.generate.feedback.status).toBe("failed");
    expect(h.result.current.generate.hint).toMatch(/Completion unconfirmed/);
    await h.receive({
      t: "map-studio-document",
      document: { ...h.document, revision: 1 },
      appliedCommandId: h.requests()[0]!.commandId,
    });
    expect(h.result.current.generate.feedback.status).toBe("failed");
    expect(h.result.current.generate.hint).not.toMatch(/Built/);
  });

  it("does not stay pending forever when receipt arrives but the application result is lost", async () => {
    const h = setup();
    h.generate();
    const request = h.requests()[0]!;
    await h.receive({ t: "ack", commandId: request.commandId });
    expect(h.result.current.generate.feedback.status).toBe("pending");
    await act(async () => vi.advanceTimersByTime(7500));
    expect(h.requests()).toEqual(Array(4).fill(request));
    expect(h.result.current.generate.feedback.status).toBe("failed");
    expect(h.result.current.generate.hint).toMatch(/Completion unconfirmed/);
    expect(h.result.current.generate.feedback.recovery).not.toBeNull();
    expect(h.result.current.generate.canGenerate).toBe(false);
  });

  it("keeps generic legacy-server errors ambiguous even before any retry", async () => {
    const h = setup();
    h.generate();
    await h.receive(h.refusal("command-rejected"));
    expect(h.result.current.generate.feedback.recovery).not.toBeNull();
    expect(h.result.current.generate.canGenerate).toBe(false);
  });
});
