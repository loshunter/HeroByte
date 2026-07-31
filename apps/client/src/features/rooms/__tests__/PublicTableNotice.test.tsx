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
    it("names the space and says what happens to what you leave there", () => {
      render(<PublicTableNotice variant="gate" />);

      expect(screen.getByTestId("public-table-notice")).toBeInTheDocument();
      expect(screen.getByText(/PUBLIC TEST TABLE/i)).toBeInTheDocument();
      expect(screen.getByText(/deleted once the table sits empty/i)).toBeInTheDocument();
      // Points at the alternative rather than only warning.
      expect(screen.getByText(/create a private table/i)).toBeInTheDocument();
    });
  });

  describe("chip variant", () => {
    it("marks the table compactly, with the detail on hover", () => {
      render(<PublicTableNotice variant="chip" />);

      const chip = screen.getByTestId("public-table-chip");
      expect(chip).toBeInTheDocument();
      expect(chip.textContent).toMatch(/PUBLIC TEST TABLE/i);
      expect(chip.getAttribute("title")).toMatch(/private table/i);
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
