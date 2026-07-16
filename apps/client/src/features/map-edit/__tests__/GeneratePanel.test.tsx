import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeneratePanel } from "../GeneratePanel";
import type { GenerateParams } from "../mapEditTypes";

const params: GenerateParams = {
  theme: "stone",
  density: "medium",
  seed: 4242,
};

function renderPanel(overrides: Partial<Parameters<typeof GeneratePanel>[0]> = {}) {
  const props = {
    params,
    onChange: vi.fn(),
    onRerollSeed: vi.fn(),
    onGenerate: vi.fn(),
    canGenerate: true,
    busy: false,
    region: { cols: 24, rows: 18 },
    ...overrides,
  };
  render(<GeneratePanel {...props} />);
  return props;
}

describe("GeneratePanel", () => {
  it("asks for a drag before a region exists", () => {
    renderPanel({ region: null, canGenerate: false });

    expect(screen.getByText(/Drag a region/i)).toBeInTheDocument();
  });

  it("shows the dragged region's size so the DM knows what they aimed at", () => {
    renderPanel();

    expect(screen.getByText("Region: 24 × 18 cells")).toBeInTheDocument();
  });

  it("shows the seed — the same seed rebuilds the same dungeon", () => {
    renderPanel();

    expect(screen.getByTestId("generate-seed")).toHaveTextContent("4242");
  });

  it("fires the recipe", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(props.onGenerate).toHaveBeenCalledTimes(1);
  });

  it("disables GENERATE until a region is aimed at", () => {
    renderPanel({ canGenerate: false });

    expect(screen.getByRole("button", { name: /generate/i })).toBeDisabled();
  });

  it("shows the queue's pending state rather than looking idle mid-build", () => {
    renderPanel({ busy: true, canGenerate: false });

    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
  });

  it("changes the theme", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /wood/i }));

    expect(props.onChange).toHaveBeenCalledWith({ ...params, theme: "wood" });
  });

  it("changes the density", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "high" }));

    expect(props.onChange).toHaveBeenCalledWith({ ...params, density: "high" });
  });

  it("says out loud that generated dungeons have no secret doors", () => {
    // There is no secret-door dial (a generated secret is readable off the
    // player's own terrain — see the server's dungeonGeometry.emitDoors). Its
    // absence must be STATED: a DM who assumes a generated door might be hidden
    // and builds a session on it is exactly who this note protects.
    renderPanel();

    expect(screen.getByTestId("generate-secret-note")).toHaveTextContent(/no secret doors/i);
    expect(screen.queryByRole("button", { name: "None" })).toBeNull();
  });

  it("rerolls the seed", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "⟳" }));

    expect(props.onRerollSeed).toHaveBeenCalledTimes(1);
  });
});
