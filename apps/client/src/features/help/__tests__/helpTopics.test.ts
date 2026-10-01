// The in-app glossary is a second home for user-facing copy, and correcting the
// user guide left it behind: it told players Recenter goes to "the middle of the
// map" long after the code settled on the origin. The file's own header asks for
// the two to be kept in step, and nothing checked.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SESSION_MINT_CEILING_BYTES } from "@herobyte/shared";
import { HELP_TOPICS } from "../helpTopics";
import { NEW_MAP_ALLOWANCE_BYTES } from "../../dm/components/map-controls/CampaignWeight";

const entry = (topicId: string, term: string) => {
  const topic = HELP_TOPICS.find((t) => t.id === topicId);
  expect(topic, `no help topic "${topicId}"`).toBeDefined();
  const found = topic!.entries?.find((e) => e.term === term);
  expect(found, `no "${term}" entry under "${topicId}"`).toBeDefined();
  return found!;
};

describe("helpTopics stays in step with the camera's behaviour", () => {
  it("describes Reset view as the origin, never the middle of the map", () => {
    // `reset` is applied as { x: 0, y: 0, scale: 1 } in useCameraControl — the
    // map's top-left corner at 1x, which is not its middle and is not where a
    // player arrives.
    const recenter = entry("moving", "🧭 Reset view");
    expect(recenter.detail).toMatch(/top-left/i);
    // The old copy read "Puts the camera back at the middle of the map." Match
    // the AFFIRMATIVE claim only — the current text names the middle to deny it.
    expect(recenter.detail).not.toMatch(/back at the middle/i);
  });
});

describe("helpTopics stays in step with the seat's rules", () => {
  it("the hold it quotes is the server's SESSION_TOKEN_GRACE_MS, read from its source", () => {
    const graceSource = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../../server/src/ws/auth/SessionTokenService.ts",
      ),
      "utf8",
    );
    const graceHours = Number(
      graceSource.match(/SESSION_TOKEN_GRACE_MS = (\d+) \* 60 \* 60 \* 1000/)?.[1],
    );
    expect(graceHours, "the grace window moved — update the seat help topic").toBe(6);
    expect(entry("seat", "Try Again").detail).toMatch(/up to six hours/);
    expect(entry("seat", "Try Again").detail).toMatch(/more retries will not shorten/);
  });

  it("a fresh session is described as what it costs: a new player, the old character left behind, DM powers gone", () => {
    const fresh = entry("seat", "Start a Fresh Session").detail;
    expect(fresh).toMatch(/new player/);
    expect(fresh).toMatch(/old character/);
    expect(fresh).toMatch(/DM password/);
  });

  it("the DM topic offers the seat's cleanup — REMOVE — and says it is not a ban", () => {
    const remove = entry("dm", "REMOVE (a player)").detail;
    expect(remove).toMatch(/not at the table/);
    expect(remove).toMatch(/[Nn]ot a ban/);
  });
});

describe("helpTopics stays in step with the Table (U9)", () => {
  const allText = () =>
    HELP_TOPICS.flatMap((topic) => topic.entries.map((e) => `${e.term}\n${e.detail}`)).join("\n");

  it("names no control by the labels it had before its move", () => {
    const text = allText();
    for (const gone of [
      "Player State",
      "Save Game State",
      "SAVE GAME STATE",
      "Load Game State",
      "Game Feel",
      "JUICE",
      "Table role",
      "EXIT DM MODE",
      "DM Menu → Session",
      "DM Menu → Players",
    ]) {
      expect(text, `help still says "${gone}"`).not.toContain(gone);
    }
  });

  it("Become the DM points at the Table button and Tools → Table, not at a character card", () => {
    const become = entry("dm", "Become the DM").detail;
    expect(become).toMatch(/Table button/);
    expect(become).toMatch(/Tools → Table/);
    expect(become).toMatch(/Enter DM mode/);
    expect(become).not.toMatch(/card's ⚙️|EDIT on your row/);
  });

  it("the player topic covers role, preferences and the character file, with the scope said", () => {
    const table = HELP_TOPICS.find((t) => t.id === "tablemenu");
    expect(table, "no Table menu topic").toBeDefined();
    const terms = table!.entries.map((e) => e.term);
    expect(terms).toEqual(
      expect.arrayContaining([
        "The Table button",
        "Enter DM mode",
        "Leave DM mode",
        "Preferences",
        "Save character / Load character",
      ]),
    );
    const file = entry("tablemenu", "Save character / Load character").detail;
    expect(file).toMatch(/one character/i);
    expect(file).toMatch(/a file that holds drawings replaces the drawings you have on the map/i);
    expect(file).toMatch(/one with none leaves yours alone/i);
    expect(file).toMatch(/someone else's character changes that character only/);
    expect(file).toMatch(/never the table/i);
    expect(file).toMatch(/Export editable map/);
  });

  it("the DM topic's backup entry names both halves and says automatic saving separately", () => {
    const backup = entry("dm", "Download table backup").detail;
    expect(backup).toMatch(/DM Menu → Table → Backups/);
    expect(backup).toMatch(/Restore table backup/);
    expect(backup).toMatch(/replaces the map, NPCs, props and drawings for everyone connected/);
    expect(backup).toMatch(/everyone with a seat here keeps their characters and tokens/i);
    expect(backup).toMatch(/one the file has and they no longer do comes back/);
    expect(backup).toMatch(/name, portrait, HP and conditions — comes back as the file had it/);
    expect(backup).toMatch(/a monster that is in both stays where it stands/);
    expect(backup).toMatch(/nobody's DM status changes/);
    expect(backup).toMatch(/saved between visits/);
  });

  it("the DM topic covers the new sections by task: invite, permissions, password", () => {
    expect(entry("dm", "Invite players").detail).toMatch(/never carries the table password/);
    expect(entry("dm", "Permissions").detail).toMatch(/BY HAND/);
    expect(entry("dm", "Table password & private copy").detail).toMatch(/Main Hall/);
  });

  it("the byte ceilings are in help, where the audit put them, not in the ordinary panel", () => {
    // IA-19: mint byte ceilings belong in Advanced/help. The 0.75 MB figure lives here.
    expect(entry("dm", "Download table backup").detail).toMatch(/0\.75 MB/);
  });

  it("How many maps fit carries the arithmetic the Map library's line leaves out", () => {
    const fit = entry("dm", "How many maps fit").detail;
    expect(fit).toMatch(/DM Menu → Maps → Map library/);
    // The four things the line says, by the words the line uses.
    for (const state of ["Room for more maps", "Nearly full", "Full", "Too big to restore"]) {
      expect(fit).toContain(state);
    }
    expect(fit).toMatch(/0\.75 MB/);
    expect(fit).toMatch(/1 MB/);
    // The two figures the line's behaviour comes from, read off the component's own allowance:
    // the most a new map can cost, and where "Nearly full" therefore begins.
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
    expect(fit).toContain(`about ${mb(NEW_MAP_ALLOWANCE_BYTES)} MB for a large warehouse`);
    expect(fit).toContain(
      `from about ${mb(SESSION_MINT_CEILING_BYTES - NEW_MAP_ALLOWANCE_BYTES)} MB`,
    );
    expect(fit).toMatch(/tooltip/);
    expect(fit).toMatch(/press DELETE/);
  });
});
