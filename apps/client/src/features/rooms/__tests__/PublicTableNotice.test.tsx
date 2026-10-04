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
    // The client cannot see the server's settings, so the notice states neither the
    // published password nor a fixed hour as fact: the guides' wording, word for word.
    it("says the password is the server's fixed setting and the wipe is the default", () => {
      render(<PublicTableNotice variant="gate" />);

      const notice = screen.getByTestId("public-table-notice");
      expect(notice).toHaveTextContent(
        "Its password is the server's setting — the one in the setup docs unless the host changed it — and cannot be changed here, and by default the server wipes the table once it has sat empty for an hour.",
      );
      expect(notice).not.toHaveTextContent(
        /published in the setup docs|always stays open|\(an hour by default\)/,
      );
    });

    it("names the way to keep your work, not just the warning", () => {
      render(<PublicTableNotice variant="gate" />);

      expect(screen.getByText(/save the table as a private table/i)).toBeInTheDocument();
    });

    it("names the control where it now lives: Table → Security, not the old Session tab", () => {
      render(<PublicTableNotice variant="gate" />);

      const notice = screen.getByTestId("public-table-notice");
      expect(notice).toHaveTextContent("DM Menu → Table → Security → Save as a Private Table");
      expect(notice).not.toHaveTextContent(/Session/);
    });
  });

  describe("chip variant", () => {
    it("marks the table compactly and points at the way to keep it", () => {
      render(<PublicTableNotice variant="chip" />);

      const chip = screen.getByTestId("public-table-chip");
      expect(chip).toBeInTheDocument();
      expect(chip.textContent).toMatch(/PUBLIC TEST TABLE/i);
      expect(chip.textContent).toMatch(/SAVE IT TO KEEP IT/i);
      expect(chip.getAttribute("title")).toMatch(/private table/i);
    });

    it("its tooltip gives the same path, to Table → Security", () => {
      render(<PublicTableNotice variant="chip" />);

      const title = screen.getByTestId("public-table-chip").getAttribute("title") ?? "";
      expect(title).toContain("DM Menu → Table → Security → Save as a Private Table");
      expect(title).not.toMatch(/Session/);
      expect(title).toContain(
        "Anyone with the Main Hall password can join this table, and by default it is wiped once it has sat empty for an hour.",
      );
      expect(title).not.toMatch(/published|\(an hour by default\)/);
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
