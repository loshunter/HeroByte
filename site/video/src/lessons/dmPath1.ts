import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath1: LessonScript = {
  slug: "dm-path-1-create-a-private-table",
  title: "CREATE A PRIVATE TABLE",
  subtitle: "DM path 1",
  captionFixes: { "main": "Main", "hall": "Hall", "hall.": "Hall.", "hall?": "Hall?", "hall's": "Hall's" },
  outro: {
    headline: "YOUR TABLE IS READY!",
    next: "Next: DM path 2, Become the DM and invite players. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Main Hall or private table",
      zooms: [
        { from: say("starts with the", -0.2), to: say("For a real game", -0.2), target: t("Main Hall"), scale: 1.6 },
        { from: say("For a real game"), to: say("need to be a DM.", 1.4, true), target: t("New Table"), scale: 1.8 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("Every server starts", -0.2), text: "EVERY CAMPAIGN NEEDS A HOME", y: 420 },
        { kind: "chips", to: say("For a real game", -0.2), pos: { x: 1300, y: 300 }, items: [{ text: "PUBLIC", at: say("public test table") }, { text: "FIXED PASSWORDS", at: say("passwords are fixed") }, { text: "WIPES WHEN EMPTY", at: say("wipes itself") }] },
        { kind: "chips", to: say("Anyone can make one", -0.2), pos: { x: 1300, y: 420 }, tone: "blue", items: [{ text: "ITS OWN PASSWORDS", at: say("its own passwords") }, { text: "NEVER CLEARED", at: say("never cleared") }] },
        { kind: "sticker", from: say("Anyone can make one"), to: say("need to be a DM.", 1.4, true), text: "NO DM NEEDED TO MAKE ONE", pos: { x: 1300, y: 540 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "The NEW TABLE form",
      zooms: [{ from: say("A name helps", -0.3), to: say("Press Create Private", 0.6), target: t("Table name"), scale: 1.6 }],
      beats: [
        { kind: "ring", from: say("Press New Table", -0.1), to: mark("NEW TABLE", 0.7), target: t("NEW TABLE") },
        { kind: "popup", from: say("A name helps"), to: say("The table password", -0.2), icon: "🏷️", title: "A NAME", lines: ["To find it in your list"], target: t("Table name"), side: "right", width: 440 },
        { kind: "popup", from: say("The table password"), to: say("The DM password", -0.2), icon: "🔑", title: "TABLE PASSWORD", lines: ["What your players type", "6+ characters"], lineAt: [say("what your players type"), say("Six characters")], target: t("Table password"), side: "right", width: 460 },
        { kind: "popup", from: say("The DM password"), to: say("Press Create Private", -0.2), icon: "👑", title: "DM PASSWORD", lines: ["Optional, 8+ characters", "Skip it: the first to enter DM mode sets it"], lineAt: [say("The DM password"), say("If you skip it")], target: t("DM password"), side: "right", width: 560 },
        { kind: "ring", from: say("Press Create Private", -0.1), to: mark("CREATE PRIVATE TABLE", 0.8), target: t("CREATE PRIVATE TABLE") },
        { kind: "chips", to: say("ordinary player.", 1.4, true), pos: { x: 960, y: 860 }, items: [{ text: "🎲 A RANDOM TABLE CODE", at: say("random table code") }, { text: "🧑 AN ORDINARY PLAYER", at: say("ordinary player") }] },
      ],
    },
    {
      title: "Finding it again",
      zooms: [
        { from: 0, to: say("Forget this table", -0.2), target: t("Table picker"), scale: 1.7 },
        { from: say("Forget this table"), to: say("code to return.", 1.4, true), target: t("Forget this table"), scale: 1.8 },
      ],
      beats: [
        { kind: "popup", from: say("table picker lists"), to: say("Forget this table", -0.2), icon: "🗂️", title: "TABLE PICKER", lines: ["Your tables, by name", "Up to 12 in this browser"], lineAt: [say("table picker lists"), say("remembers up to")], target: t("Table picker"), side: "right", width: 480 },
        { kind: "sticker", from: say("no public list"), to: say("Forget this table", -0.2), text: "NOTE YOUR TABLE'S CODE", pos: { x: 1300, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "popup", from: say("Forget this table"), to: say("code to return.", 1.4, true), icon: "🧹", title: "FORGET THIS TABLE", lines: ["Removes it from this browser", "The code brings you back"], lineAt: [say("Forget this table"), say("You'll need the code")], target: t("Forget this table"), side: "right", width: 520 },
      ],
    },
    {
      title: "Keeping a Main Hall build",
      zooms: [
        { from: say("then Security", -0.4), to: say("press Save and go there", 1.0), target: t("Security"), scale: 1.4 },
      ],
      beats: [
        { kind: "sticker", from: 0.3, to: say("In the DM menu", -0.2), text: "COPY IT TO A TABLE OF YOUR OWN", pos: { x: 700, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "chips", to: say("Give it a name", -0.2), pos: { x: 700, y: 860 }, sep: "›", items: [{ text: "DM MENU", at: say("In the DM menu") }, { text: "TABLE", at: say("open Table") }, { text: "SECURITY", at: say("then Security") }, { text: "SAVE AS A PRIVATE TABLE", at: say("Save as a Private") }] },
        { kind: "ring", from: say("press Save and go there", -0.1), to: mark("SAVE & GO THERE", 0.8), target: t("SAVE & GO THERE") },
        { kind: "chips", to: say("carries on as before.", 1.4, true), pos: { x: 960, y: 300 }, items: [{ text: "MAP", at: say("the map") }, { text: "TOKENS", at: say("tokens") }, { text: "NPCS", at: say("NPCs") }, { text: "DRAWINGS", at: say("drawings") }, { text: "IMAGES", at: say("and images") }] },
        { kind: "sticker", from: say("carries on"), to: say("carries on as before.", 1.4, true), text: "THE MAIN HALL CARRIES ON", pos: { x: 960, y: 420 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "Changing the password",
      zooms: [
        { from: say("has change table password", -0.3), to: say("Reset to default", -0.2), target: t("Change table password"), scale: 1.7 },
        { from: say("Reset to default"), to: say("wide open.", 1.4, true), target: t("Reset to default"), scale: 1.7 },
      ],
      beats: [
        { kind: "popup", from: say("has change table password"), to: say("Change it if", -0.2), icon: "🔑", title: "CHANGE TABLE PASSWORD", lines: ["People already in stay", "New joiners need the new one"], lineAt: [say("People already in"), say("New joiners")], target: t("Change table password"), side: "left", width: 520 },
        { kind: "chips", to: say("Reset to default", -0.2), pos: { x: 700, y: 300 }, items: [{ text: "A CODE LEAKED", at: say("if a code leaks") }, { text: "AFTER A ONE-SHOT", at: say("after a one") }] },
        { kind: "popup", from: say("Reset to default"), to: say("Don't use it", -0.2), icon: "⚠️", tone: "red", title: "RESET TO DEFAULT", lines: ["The Main Hall's password", "Anyone with your code could join"], lineAt: [say("Reset to default"), say("Anyone with your code")], target: t("Reset to default"), side: "left", width: 560 },
        { kind: "sticker", from: say("Don't use it"), to: say("wide open.", 1.4, true), text: "🚪 YOUR FRONT DOOR, WIDE OPEN", pos: { x: 700, y: 300 }, tone: "gold", tilt: -3 },
      ],
    },
  ],
};
