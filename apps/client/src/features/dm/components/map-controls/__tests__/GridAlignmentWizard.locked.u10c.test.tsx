// Locking the grid collapses the alignment wizard, and a collapsed section is out of reach (U10c):
// without this, locking the grid mid-alignment would hide Cancel and Apply from everyone.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GridAlignmentWizard } from "../GridAlignmentWizard";

afterEach(cleanup);

const wizard = (overrides: Partial<Parameters<typeof GridAlignmentWizard>[0]> = {}) =>
  render(
    <GridAlignmentWizard
      alignmentModeActive={false}
      alignmentPoints={[]}
      alignmentSuggestion={null}
      gridLocked
      onAlignmentStart={vi.fn()}
      onAlignmentReset={vi.fn()}
      onAlignmentCancel={vi.fn()}
      onAlignmentApply={vi.fn()}
      {...overrides}
    />,
  );

describe("GridAlignmentWizard and the grid lock", () => {
  it("is out of reach while the grid is locked and no alignment is under way", () => {
    wizard();
    expect(screen.queryByRole("button", { name: /Start alignment/i })).toBeNull();
  });

  it("stays reachable, Cancel included, while an alignment is under way", () => {
    wizard({ alignmentModeActive: true });
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("is reachable when the grid is not locked", () => {
    wizard({ gridLocked: false });
    expect(screen.getByRole("button", { name: /Start alignment/i })).toBeInTheDocument();
  });
});
