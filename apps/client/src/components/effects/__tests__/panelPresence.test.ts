/**
 * `data-panels-open` is what lets CSS soften the CRT filter over panels while
 * leaving it at full strength over the map. The counter behaviour is the part
 * worth pinning: panels stack, so a boolean would clear on the first close
 * while another was still open.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { registerOpenPanel, openPanelCount, resetPanelPresence } from "../panelPresence";

const attr = () => document.documentElement.getAttribute("data-panels-open");

describe("panelPresence", () => {
  beforeEach(() => {
    resetPanelPresence();
  });

  it("publishes nothing when no panel is open", () => {
    expect(attr()).toBeNull();
    expect(openPanelCount()).toBe(0);
  });

  it("marks the document while a panel is open and clears on release", () => {
    const release = registerOpenPanel();
    expect(attr()).toBe("1");

    release();
    expect(attr()).toBeNull();
  });

  it("keeps the mark until the LAST stacked panel closes", () => {
    const releaseA = registerOpenPanel();
    const releaseB = registerOpenPanel();
    expect(attr()).toBe("2");

    releaseA();
    // The DM menu is still open behind the settings window.
    expect(attr()).toBe("1");

    releaseB();
    expect(attr()).toBeNull();
  });

  it("ignores a double release rather than going negative", () => {
    const release = registerOpenPanel();
    registerOpenPanel();

    release();
    release(); // React strict mode can invoke a cleanup twice.

    expect(openPanelCount()).toBe(1);
    expect(attr()).toBe("1");
  });
});
