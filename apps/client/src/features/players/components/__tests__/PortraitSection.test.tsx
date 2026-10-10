import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PortraitSection } from "../PortraitSection";

describe("PortraitSection", () => {
  it("glows in the card's colour while speaking (C3), and the turn's gold still wins", () => {
    const { rerender } = render(
      <PortraitSection
        portrait={undefined}
        statusEffects={[]}
        tokenColor="#ffc2d3"
        micLevel={0.5}
      />,
    );
    const frame = () => screen.getByRole("button", { name: "Portrait" });
    expect(frame().style.boxShadow).toBe("0 0 12px rgba(255, 204, 218, 0.35)");
    rerender(
      <PortraitSection
        portrait={undefined}
        statusEffects={[]}
        tokenColor="#ffc2d3"
        micLevel={0.5}
        isCurrentTurn
      />,
    );
    expect(frame().style.boxShadow).toBe(
      "0 0 18px rgba(255, 215, 0, 0.85), 0 0 32px rgba(255, 215, 0, 0.35)",
    );
  });

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
    // IA-20: the instruction is short enough to fit the frame, in body type
    // rather than the global button rule's uppercase pixel font.
    expect(screen.getByText("Upload or paste a link")).toBeInTheDocument();
    expect(placeholder).toHaveStyle("text-transform: none");
    // A narrow card hides the line (a container query); the instruction stays
    // the frame's accessible description.
    expect(button).toHaveAccessibleDescription("Upload or paste a link");

    fireEvent.click(button);
    expect(handleRequestChange).toHaveBeenCalledTimes(1);
  });

  it("shows the portrait image when provided", () => {
    render(<PortraitSection portrait="https://example.com/portrait.png" statusEffects={[]} />);

    const image = screen.getByRole("img", { name: "Portrait" });
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

    // "Portrait", never "Player portrait": NPC and DM cards show this frame too.
    const button = screen.getByRole("button", { name: "Portrait" });
    expect(button).toBeDisabled();
    // Not "Portrait Pending": nothing is uploading; there simply is none.
    expect(screen.getByText("No portrait yet")).toBeInTheDocument();
    expect(screen.queryByText(/pending/i)).toBeNull();

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

  describe("Initiative Button", () => {
    it("renders initiative button with value when provided", () => {
      const handleInitiativeClick = vi.fn();
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={[]}
          initiative={18}
          onInitiativeClick={handleInitiativeClick}
        />,
      );

      const initiativeButton = screen.getByRole("button", { name: /set initiative/i });
      expect(initiativeButton).toHaveTextContent("18");
    });

    it("renders 'Init' text when no initiative value is set", () => {
      const handleInitiativeClick = vi.fn();
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={[]}
          onInitiativeClick={handleInitiativeClick}
        />,
      );

      const initiativeButton = screen.getByRole("button", { name: /set initiative/i });
      expect(initiativeButton).toHaveTextContent("Init");
    });

    it("calls onInitiativeClick when button is clicked", () => {
      const handleInitiativeClick = vi.fn();
      render(
        <PortraitSection
          portrait={undefined}
          statusEffects={[]}
          initiative={14}
          onInitiativeClick={handleInitiativeClick}
        />,
      );

      const initiativeButton = screen.getByRole("button", { name: /set initiative/i });
      fireEvent.click(initiativeButton);

      expect(handleInitiativeClick).toHaveBeenCalledTimes(1);
    });

    it("applies highlight styles when it's the current turn", () => {
      render(
        <PortraitSection portrait={undefined} statusEffects={[]} initiative={12} isCurrentTurn />,
      );

      const portraitButton = screen.getByRole("button", { name: "Portrait" });
      expect(portraitButton).toHaveStyle("border-color: var(--jrpg-gold)");
    });
  });
});
