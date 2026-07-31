import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PublicTableNotice } from "../PublicTableNotice";
import { currentRoomId } from "../roomDirectory";

/**
 * The notice must appear on the default table and — more importantly — never on
 * a private one, where it would be a lie: private tables are not public and are
 * never auto-cleared.
 */
describe("PublicTableNotice", () => {
  const originalSearch = window.location.search;

  function setSearch(search: string) {
    window.history.replaceState({}, "", `${window.location.pathname}${search}`);
  }

  afterEach(() => {
    setSearch(originalSearch);
  });

  describe("gate variant", () => {
    it("states the rule conditionally, so it is true even once the table is claimed", () => {
      // The join screen renders BEFORE authentication, so there is no snapshot
      // to consult. Asserting "this table IS public" would be a guess; stating
      // "while it still uses that password" holds either way.
      render(<PublicTableNotice variant="gate" />);

      expect(screen.getByTestId("public-table-notice")).toBeInTheDocument();
      expect(screen.getByText(/while it still uses that password/i)).toBeInTheDocument();
      expect(screen.getByText(/wipes it once it has sat empty for an hour/i)).toBeInTheDocument();
    });

    it("names the way out, not just the warning", () => {
      render(<PublicTableNotice variant="gate" />);

      expect(screen.getByText(/Table Security/i)).toBeInTheDocument();
      expect(screen.getByText(/no longer public, and never auto-cleared/i)).toBeInTheDocument();
    });
  });

  describe("chip variant", () => {
    it("marks the table compactly and points at the claim path", () => {
      render(<PublicTableNotice variant="chip" />);

      const chip = screen.getByTestId("public-table-chip");
      expect(chip).toBeInTheDocument();
      expect(chip.textContent).toMatch(/PUBLIC TABLE/i);
      expect(chip.textContent).toMatch(/SET A PASSWORD TO KEEP IT/i);
      expect(chip.getAttribute("title")).toMatch(/Table Security/i);
    });
  });

  describe("which table is the public one", () => {
    it("treats a tab with no ?room= as the default table", () => {
      setSearch("");
      expect(currentRoomId()).toBeUndefined();
    });

    it("treats a ?room= tab as a private table, so the notice stays off", () => {
      setSearch("?room=table-k3f9x2");
      expect(currentRoomId()).toBe("table-k3f9x2");
    });

    it("falls back to the default table when the room code is malformed", () => {
      // A junk code never reaches a real private table, so the tab is still
      // pointed at the default one and should be labelled as such.
      setSearch("?room=not a valid code!");
      expect(currentRoomId()).toBeUndefined();
    });
  });
});
