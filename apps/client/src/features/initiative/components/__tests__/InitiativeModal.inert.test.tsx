// While the initiative dialog is open the page behind it is inert (§3.4:
// dialog focus is contained and returned) — ALL of it: the app's #root and
// the windows that portal to <body> beside it (a character's ⚙ settings
// window, the Help popover). The dialog portals to <body> too, and stays live.
// Focus moves into the dialog, and back to what had it when the dialog closes.

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";
import { visible } from "../../../interaction/__tests__/focusFixtures";

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
let settingsWindow: HTMLElement;
let opener: HTMLButtonElement;
let mount: HTMLElement; // where React renders, inside #root beside the opener
beforeEach(() => {
  appRoot = document.createElement("main");
  appRoot.id = "root";
  // Laid out (jsdom has no layout): focus only returns to a visible control.
  opener = visible(document.createElement("button"));
  opener.textContent = "INIT";
  mount = document.createElement("div");
  appRoot.append(opener, mount);
  settingsWindow = document.createElement("div");
  settingsWindow.dataset.testid = "settings-window";
  document.body.append(appRoot, settingsWindow);
  opener.focus();
});
afterEach(() => {
  cleanup();
  appRoot.remove();
  settingsWindow.remove();
});

const overlay = () => document.querySelector("[data-modal-overlay]") as HTMLElement;

describe("InitiativeModal — the page behind it", () => {
  it("makes #root AND every other <body> window inert, never itself; restores both on close", () => {
    const view = render(<InitiativeModal {...base} />, { container: mount });

    expect(appRoot.hasAttribute("inert")).toBe(true);
    expect(settingsWindow.hasAttribute("inert")).toBe(true);
    expect(overlay().closest("[inert]")).toBeNull();

    view.unmount();
    expect(appRoot.hasAttribute("inert")).toBe(false);
    expect(settingsWindow.hasAttribute("inert")).toBe(false);
  });

  it("takes focus into the dialog, and gives it back to the opener on close", () => {
    const view = render(<InitiativeModal {...base} />, { container: mount });
    expect(overlay().contains(document.activeElement)).toBe(true);

    view.unmount();
    expect(document.activeElement).toBe(opener);
  });

  it("leaves a window that was already inert as it found it", () => {
    settingsWindow.setAttribute("inert", "");
    const view = render(<InitiativeModal {...base} />, { container: mount });
    view.unmount();
    expect(settingsWindow.hasAttribute("inert")).toBe(true);
    expect(appRoot.hasAttribute("inert")).toBe(false);
  });
});
