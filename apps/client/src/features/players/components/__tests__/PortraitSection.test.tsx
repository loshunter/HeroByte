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
        statusEffects={[]}
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
    render(<PortraitSection portrait="https://example.com/portrait.png" statusEffects={[]} />);

    const image = screen.getByRole("img", { name: /player portrait/i });
    expect(image).toBeVisible();
  });

  it("disables changes when not editable", () => {
    const handleRequestChange = vi.fn();
    render(
      <PortraitSection
        portrait={undefined}
        isEditable={false}
        onRequestChange={handleRequestChange}
        statusEffects={[]}
      />,
    );

    const button = screen.getByRole("button", { name: /player portrait/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(handleRequestChange).not.toHaveBeenCalled();
  });

  describe("Status Effects Display", () => {
    it("shows sword icon when no status effects are active", () => {
      render(<PortraitSection portrait={undefined} statusEffects={[]} />);

      const statusButton = screen.getByRole("button", { name: /status effects/i });
      expect(statusButton).toHaveTextContent("⚔️");
    });

    it("displays up to 3 status effect emojis", () => {
      render(
        <PortraitSection portrait={undefined} statusEffects={["poisoned", "burning", "frozen"]} />,
      );

      const statusButton = screen.getByRole("button", { name: /status effects/i });
      expect(statusButton).toHaveAttribute("title", "Poisoned, Burning, Frozen");
      expect(statusButton).toHaveTextContent("🤢");
      expect(statusButton).toHaveTextContent("🔥");
      expect(statusButton).toHaveTextContent("❄️");
    });

    it("shows overflow indicator when more than 3 status effects", () => {
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={["poisoned", "burning", "frozen", "stunned", "paralyzed"]}
        />,
      );

      const statusButton = screen.getByRole("button", { name: /status effects/i });
      expect(statusButton).toHaveAttribute("title", "Poisoned, Burning, Frozen, +2 more");
      expect(statusButton).toHaveTextContent("+2");
    });

    it("handles unknown status effects gracefully", () => {
      render(<PortraitSection portrait={undefined} statusEffects={["custom-unknown-effect"]} />);

      const statusButton = screen.getByRole("button", { name: /status effects/i });
      expect(statusButton).toHaveAttribute("title", "custom-unknown-effect");
    });

    it("calls onFocusToken when status icon is clicked", () => {
      const handleFocusToken = vi.fn();
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={["poisoned"]}
          onFocusToken={handleFocusToken}
        />,
      );

      const statusButton = screen.getByRole("button", { name: /focus camera on token/i });
      fireEvent.click(statusButton);

      expect(handleFocusToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("Initiative Badge", () => {
    it("renders initiative value when provided", () => {
      render(<PortraitSection portrait={undefined} statusEffects={[]} initiative={18} />);

      expect(screen.getByText(/Init: 18/)).toBeInTheDocument();
    });

    it("renders modifier when provided", () => {
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={[]}
          initiative={14}
          initiativeModifier={2}
        />,
      );

      expect(screen.getByText("(+2)")).toBeInTheDocument();
    });

    it("applies highlight styles when it's the current turn", () => {
      render(
        <PortraitSection portrait={undefined} statusEffects={[]} initiative={12} isCurrentTurn />,
      );

      const portraitButton = screen.getByRole("button", { name: /player portrait/i });
      expect(portraitButton).toHaveStyle("border-color: var(--jrpg-gold)");
    });
  });
});
