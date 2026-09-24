import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneratePanel } from "../GeneratePanel";

afterEach(cleanup);
describe("desktop Generate recovery", () => {
  it("announces uncertainty and separates refresh, inspection and a new generation", () => {
    const refresh = vi.fn(),
      acknowledge = vi.fn(),
      onGenerate = vi.fn();
    const recovery = { refreshing: false, canAcknowledge: false, refresh, acknowledge };
    const props = {
      params: { seed: 73, theme: "wood" as const, density: "low" as const },
      onChange: vi.fn(),
      onRerollSeed: vi.fn(),
      onGenerate,
      canGenerate: false,
      busy: false,
      region: { cols: 24, rows: 24 },
      hint: "Completion unconfirmed. Refresh this map and inspect the result before generating again.",
      feedback: { status: "failed" as const, recovery },
    };
    const view = render(<GeneratePanel {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("Completion unconfirmed");
    expect(screen.getByTestId("generate-seed")).toHaveTextContent("73");
    expect(screen.getByText("Region: 24 × 24 cells")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "I've checked the map" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh map" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(onGenerate).not.toHaveBeenCalled();
    view.rerender(
      <GeneratePanel
        {...props}
        feedback={{ status: "failed", recovery: { ...recovery, refreshing: true } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
    view.rerender(
      <GeneratePanel
        {...props}
        feedback={{ status: "failed", recovery: { ...recovery, canAcknowledge: true } }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "I've checked the map" }));
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "🎲 GENERATE" })).toBeDisabled();
  });
});
