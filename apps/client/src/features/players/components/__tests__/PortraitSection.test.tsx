import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PortraitSection } from "../PortraitSection";

describe("PortraitSection", () => {
  it("renders a token-colored call-to-action placeholder and triggers change callback", () => {
    const handleRequestChange = vi.fn();
    const tokenColor = "#336699";

    render(
      <PortraitSection
        isEditable
        portrait={undefined}
        onRequestChange={handleRequestChange}
        tokenColor={tokenColor}
      />,
    );

    const button = screen.getByRole("button", { name: /change portrait/i });
    expect(button).not.toBeDisabled();
    const placeholder = within(button).getByTestId("portrait-placeholder");
    expect(placeholder).toHaveStyle(`background-color: ${tokenColor}`);
    expect(screen.getByText(/\+ add portrait/i)).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleRequestChange).toHaveBeenCalledTimes(1);
  });

  it("shows the portrait image when provided", () => {
    render(<PortraitSection portrait="https://example.com/portrait.png" />);

    const image = screen.getByRole("img", { name: /player portrait/i });
    expect(image).toBeVisible();
  });

  it("disables changes when not editable", () => {
    const handleRequestChange = vi.fn();
    render(<PortraitSection portrait={undefined} isEditable={false} onRequestChange={handleRequestChange} />);

    const button = screen.getByRole("button", { name: /player portrait/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleRequestChange).not.toHaveBeenCalled();
  });
});
