// While the initiative dialog is open the page behind it is inert (§3.4:
// dialog focus is contained): no Tab can reach another card's INIT or the DM
// menu's controls, and no Enter pressed on one can act behind the dialog. The
// dialog portals to <body>, outside the app's #root, so it stays live.

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;
const base = {
  character: hero,
  onClose: vi.fn(),
  onSetInitiative: vi.fn(),
  onRollInitiative: vi.fn(),
  combatActive: true,
};

let appRoot: HTMLElement;
beforeEach(() => {
  appRoot = document.createElement("main");
  appRoot.id = "root";
  document.body.appendChild(appRoot);
});
afterEach(() => {
  cleanup();
  appRoot.remove();
});

describe("InitiativeModal — the page behind it", () => {
  it("is inert while the dialog is open, and live again when it closes", () => {
    const view = render(<InitiativeModal {...base} />);
    expect(appRoot.hasAttribute("inert")).toBe(true);
    expect(document.querySelector("[data-modal-overlay]")?.closest("[inert]")).toBeNull();

    view.unmount();
    expect(appRoot.hasAttribute("inert")).toBe(false);
  });

  it("leaves a root that was already inert as it found it", () => {
    appRoot.setAttribute("inert", "");
    const view = render(<InitiativeModal {...base} />);
    view.unmount();
    expect(appRoot.hasAttribute("inert")).toBe(true);
  });
});
