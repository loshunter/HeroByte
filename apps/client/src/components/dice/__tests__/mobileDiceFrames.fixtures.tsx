import type { ComponentProps, ReactNode } from "react";
import { act, fireEvent, screen, within, type RenderResult } from "@testing-library/react";
import { vi } from "vitest";
import { MobileDiceRoller } from "../MobileDiceRoller";
import type { RollLogEntry } from "../rollLogTypes";
import type { LayerOwner, ReadOwner } from "../../../features/interaction/escapeTypes";

export const serverRoll = (id = "mobile-answer"): RollLogEntry => ({
  id,
  playerUid: "me",
  playerName: "Me",
  formula: "d20",
  perDie: [{ tokenId: "t0", die: "d20", rolls: [17], subtotal: 17 }],
  total: 17,
  timestamp: 0,
});

export function rollerProps() {
  return {
    isConnected: true,
    onRoll: vi.fn(),
    onClose: vi.fn(),
    onEnterRoll: vi.fn(),
    onOverrideRoll: vi.fn(),
  };
}

// Mirrors the real display:contents mobile surface and its sibling viewing-roll mount.
// It supplies no synthetic ownership or copied interaction policy.
export function MobileDiceComposition({
  children,
  ...props
}: ComponentProps<typeof MobileDiceRoller> & { children?: ReactNode }) {
  return (
    <>
      <div style={{ display: "contents" }} data-mobile-surface="dice">
        <MobileDiceRoller {...props} />
      </div>
      {children}
    </>
  );
}

export function requestAndAnswer(view: RenderResult, ui: ReactNode) {
  const roller = within(screen.getByTestId("dice-roller"));
  fireEvent.click(roller.getByRole("button", { name: "Add d20" }));
  fireEvent.click(roller.getByRole("button", { name: "Roll dice" }));
  view.rerender(ui);
  act(() => vi.advanceTimersByTime(600));
}

export function readLayers(register: { mock: { calls: [ReadOwner][] } }) {
  return register.mock.calls
    .map(([read]) => read())
    .filter(
      (owner): owner is LayerOwner => owner.kind === "panel" && owner.name === "blocking-frame",
    );
}
