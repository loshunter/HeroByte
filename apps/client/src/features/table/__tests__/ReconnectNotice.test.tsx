import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReconnectNotice, ReconnectNoticeDock } from "../ReconnectNotice";
import { ReconnectPhaseContext, type ReconnectPhase } from "../reconnectPhase";

const renderWith = (phase: ReconnectPhase) =>
  render(
    <ReconnectPhaseContext.Provider value={phase}>
      <ReconnectNotice />
    </ReconnectPhaseContext.Provider>,
  );

describe("ReconnectNotice", () => {
  it("says nothing while the table is answering, and nothing with no gate above it at all", () => {
    const { container, unmount } = renderWith(null);
    expect(container).toBeEmptyDOMElement();
    unmount();
    const bare = render(<ReconnectNotice />);
    expect(bare.container).toBeEmptyDOMElement();
  });

  it("says Reconnecting… while the socket is away", () => {
    renderWith("reconnecting");
    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting…");
  });

  it("says Re-authenticating… once the socket is back and the seat is being proven again", () => {
    renderWith("reauthenticating");
    expect(screen.getByRole("status")).toHaveTextContent("Re-authenticating…");
  });
});

describe("ReconnectNoticeDock — where a desktop puts it", () => {
  const dockWith = (phase: ReconnectPhase, top: number) =>
    render(
      <ReconnectPhaseContext.Provider value={phase}>
        <ReconnectNoticeDock top={top} />
      </ReconnectPhaseContext.Provider>,
    );

  it("holds the notice `top` pixels from the screen's top edge, and nothing while the table answers", () => {
    const { container, unmount } = dockWith(null, 128);
    expect(container.querySelector(".reconnect-notice-dock")).toBeNull();
    unmount();

    const shown = dockWith("reconnecting", 128);
    const dock = shown.container.querySelector<HTMLElement>(".reconnect-notice-dock")!;
    expect(dock.style.top).toBe("128px");
    expect(dock).toContainElement(screen.getByTestId("reconnect-notice"));
  });
});
