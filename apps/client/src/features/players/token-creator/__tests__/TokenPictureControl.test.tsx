/**
 * The settings windows' entry to the creator: the picture on file, the button
 * that opens the (lazy) creator, and Clear.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TokenPictureControl } from "../TokenPictureControl";

describe("TokenPictureControl", () => {
  it("shows the picture on file and clears it", () => {
    const onClear = vi.fn();
    render(<TokenPictureControl imageUrl="/assets/x" onApply={vi.fn()} onClear={onClear} />);
    expect(screen.getByAltText("Token preview")).toHaveAttribute("src", "/assets/x");
    fireEvent.click(screen.getByRole("button", { name: "Clear picture" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("offers no Clear and no preview without a picture", () => {
    render(<TokenPictureControl onApply={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByAltText("Token preview")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear picture" })).toBeNull();
  });

  it("opens the creator, and closing it changes nothing", async () => {
    const onApply = vi.fn();
    render(<TokenPictureControl name="Tristan" onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Token picture…" }));
    // The window is a lazy chunk: its first import compiles the creator, which a loaded
    // batch run can stretch well past findBy's default second.
    expect(
      await screen.findByText("🖼️ Token picture: Tristan", undefined, { timeout: 15_000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("🖼️ Token picture: Tristan")).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  }, 20_000);
});
