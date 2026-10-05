// Help sentences the U10c review found false or incomplete against the app. Each assertion is
// on the text a newcomer reads, so a later edit that reverts one turns it red.
import { describe, expect, it } from "vitest";
import { DM_HELP_TOPIC } from "../dmHelpTopic";
import { HELP_TOPICS } from "../helpTopics";

const entry = (topic: { entries: { term: string; detail: string }[] }, term: RegExp) => {
  const found = topic.entries.find((e) => term.test(e.term));
  if (!found) throw new Error(`no help entry matching ${term}`);
  return found.detail;
};
const everything = JSON.stringify([HELP_TOPICS, DM_HELP_TOPIC]);

describe("help text, after the U10c review", () => {
  it("sends the DM to the Lighting group for ambient light, not to an opacity that no longer exists", () => {
    const build = entry(DM_HELP_TOPIC, /Build map/);
    expect(build).toMatch(/Ambient light \(Dark → Daylight\) is a slider in the Lighting group/);
    expect(everything).not.toMatch(/Lighting opacity/);
  });

  it("says Player View is desktop only", () => {
    expect(entry(DM_HELP_TOPIC, /Player View/)).toMatch(/Desktop only: a phone has no Player View/);
  });

  it("says Place on map replaces the token (it does not move it)", () => {
    const place = entry(DM_HELP_TOPIC, /PLACE ON MAP/);
    expect(place).not.toMatch(/moves that same token/);
    expect(place).toMatch(/replaces the old token with a fresh one/);
    expect(place).toMatch(/size and sight radius reset/);
  });

  it("warns that erasing a whole shape cannot be undone", () => {
    const drawing = HELP_TOPICS.find((t) => t.id === "drawing")!;
    expect(entry(drawing, /Undo/)).toMatch(/Erasing a whole line or shape cannot be undone/);
  });

  // The routes that exist: the selection's Unlock, DM only — the desktop toolbar's
  // 🔓 Unlock (MultiSelectToolbar) and the phone's selection sheet (MobileSelectionSheet,
  // reached with TOOLS → □ Select) — and Token Lock in a player character's settings,
  // which the phone's ◉ PARTY → ⚙️ EDIT sheet also gets (MobileEntitiesList), and an NPC's
  // settings' 🔒 Locked button (NpcSettingsMenu, DM only).
  it("names the real unlock routes, the phone's included", () => {
    const tokens = HELP_TOPICS.find((t) => t.id === "tokens")!;
    const locked = entry(tokens, /Locked/);
    expect(locked).toMatch(
      /The DM selects it and presses 🔓 Unlock \(on a phone: TOOLS → □ Select, tap it, then 🔓 Unlock\)/,
    );
    expect(locked).toMatch(
      /The DM can also unlock a player character's token from its ⚙️ settings → Token Lock \(on a phone: ◉ PARTY → ⚙️ EDIT\), and an NPC's from its settings' 🔒 Locked button/,
    );
    expect(locked).not.toMatch(/On a computer|Unlocking is desktop only|map element/);
    // The lock is enforced on every move and delete message (pieceLock, server; the
    // gizmo, group drag, keys and eraser, client): no move, resize or delete, for anyone,
    // until the DM unlocks it. Bulk deletes keep locked pieces; table-wide changes (a
    // restore, travel) still win, and a locked drawing has no badge (LockIndicator is on
    // tokens and props only).
    expect(locked).toMatch(
      /Set by the DM\. A locked token or prop shows a 🔒 badge; a locked drawing shows none\. No one can move, resize or delete a locked piece, the DM included, until the DM unlocks it\./,
    );
    expect(locked).toMatch(
      /🗑️ Clear all drawings keeps locked drawings, and REMOVE keeps locked tokens \(they pass to the DM\)\. Table-wide changes still win: Restore table backup… puts back the file's props, drawings and NPCs, locked or not \(seated players keep their tokens as they are\), and travelling to another map takes the party's tokens along\./,
    );
    expect(locked).not.toMatch(
      /players cannot move it|Every other delete|replaces the whole table|Pinned/,
    );
  });

  it("tells a phone player how to do what a desktop key or log does (U10d)", () => {
    const character = HELP_TOPICS.find((t) => t.id === "character")!;
    expect(entry(character, /^HP$/)).toMatch(/Temp HP is the number on the line below/);
    expect(entry(character, /^HP$/)).toMatch(/On a phone, tap a number on your row/);
    const tokens = HELP_TOPICS.find((t) => t.id === "tokens")!;
    expect(entry(tokens, /^Delete$/)).toMatch(/A phone has no Delete key/);
    expect(entry(tokens, /^Delete$/)).toMatch(/Erase drawings/);
    const dice = HELP_TOPICS.find((t) => t.id === "dice")!;
    expect(entry(dice, /Correct a roll/)).toMatch(/THAT'S NOT WHAT I ROLLED/);
    expect(entry(dice, /Correct a roll/)).not.toMatch(/ENTER A ROLL BY HAND/);
    expect(entry(dice, /Correct a roll/)).toMatch(/older roll from the log is desktop only/);
    expect(entry(tokens, /^Delete$/)).toMatch(/A player's own token cannot be deleted on a phone/);
    expect(entry(tokens, /^Delete$/)).toMatch(/ask the DM to remove it, or use a computer/);
    expect(entry(tokens, /^Delete$/)).toMatch(/Props are deleted in the Props panel/);
    expect(entry(tokens, /^Delete$/)).toMatch(/Undo drawing/);
    const table = HELP_TOPICS.find((t) => t.id === "table")!;
    expect(entry(table, /^INIT$/)).toMatch(
      /Clear Initiative \(on a phone: ⚙️ EDIT → Clear Initiative\)/,
    );
  });

  it("names the NPC tab the way the tab is named", () => {
    expect(everything).not.toMatch(/DM Menu → NPCs(?! & Monsters)/);
  });

  it("gives a phone path for every Table-tab entry that starts from the desktop DM Menu", () => {
    for (const term of [
      /Download table backup/,
      /Invite players/,
      /Permissions/,
      /Table password/,
      /REMOVE/,
    ]) {
      expect(entry(DM_HELP_TOPIC, term), String(term)).toMatch(/on a phone: ♛ DM → Table/);
    }
  });
});
