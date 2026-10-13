import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says, what video-scripts.md captions, or what the app
// itself said during the capture (the restore confirm is a browser dialog no page recording sees,
// so its text is shown here as the capture logged it).
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath8: LessonScript = {
  slug: "dm-path-8-backups-and-keeping-your-work",
  title: "BACKUPS",
  subtitle: "DM path 8: keeping your work",
  outro: {
    headline: "YOUR CAMPAIGN IS SAFE!",
    next: "That's the DM path. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Three kinds of file",
      beats: [
        { kind: "title", from: 0.2, to: say("makes three kinds", -0.2), text: "MONTHS TO BUILD", sub: "one bad afternoon to lose", y: 420, sfx: "ping.wav" },
        {
          kind: "ways",
          from: say("makes three kinds"),
          to: say("A table backup is", -0.2),
          dock: say("A table backup is", -0.3),
          ways: ["🗄️ TABLE BACKUP", "🧙 CHARACTER FILE", "🗺️ EDITABLE MAP"],
          active: [say("A table backup is"), say("A character file is"), say("An editable map is")],
        },
        { kind: "sticker", from: say("each picker tells you"), to: say("A table backup is", -0.2), text: "EACH PICKER SAYS WHAT IT WAS HANDED", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("under Table", 0.6), to: say("A character file is", -0.2), target: t("Backups") },
        { kind: "ring", from: say("that character's settings", -0.2), to: say("An editable map is", -0.2), target: t("Save character") },
        { kind: "ring", from: say("in the Map Library", -0.2), to: say("Map Library.", 1.4, true), target: t("editable map") },
      ],
    },
    {
      title: "Download a table backup",
      beats: [
        { kind: "ring", from: say("Download Table Backup saves", -0.1), to: mark("Download table backup", 0.8), target: t("Download table backup") },
        {
          kind: "chips",
          to: say("Private rolls", -0.2),
          pos: { x: 600, y: 860 },
          items: [
            { text: "TOKENS", at: say("Tokens,") },
            { text: "CHARACTERS", at: say("characters,") },
            { text: "NPCS", at: say("NPCs,") },
            { text: "DRAWINGS", at: say("drawings,") },
            { text: "EVERY SAVED MAP", at: say("every saved map") },
            { text: "IMAGES", at: say("uploaded images") },
          ],
        },
        { kind: "sticker", from: say("Private rolls"), to: say("It still holds", -0.2), text: "PRIVATE ROLLS AND WHISPERS: LEFT OUT", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("It still holds"), to: say("to yourself.", 1.4, true), icon: "🔒", title: "IT'S A DM FILE", lines: ["Secret doors, hidden NPCs, your notes", "Keep it to yourself"], lineAt: [say("It still holds"), say("Keep it to yourself")], pos: { x: 600, y: 300 }, width: 560 },
      ],
    },
    {
      title: "Restore one",
      split: { from: say("Players keep their own", -0.3), labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "ring", from: say("Restore Table Backup replaces", -0.1), to: say("Read the confirmation", -0.2), target: t("Restore table backup") },
        {
          kind: "popup",
          from: say("Read the confirmation"),
          to: say("Players keep their own", -0.4),
          icon: "❓",
          title: "RESTORE TABLE BACKUP?",
          lines: ["This REPLACES the map, NPCs, props and drawings for everyone connected.", "It cannot be undone."],
          lineAt: [say("Read the confirmation"), say("become the files")],
          pos: { x: 600, y: 360 },
          width: 640,
        },
        { kind: "sticker", from: say("Players keep their own"), to: say("Hand it the wrong", -0.2), text: "PLAYERS KEEP THEIR CHARACTERS · DM STATUS STAYS", pos: { x: 960, y: 260 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("by name", -0.2), to: say("If the table would", -0.2), target: t("refusal") },
        { kind: "popup", from: say("If the table would"), to: say("changes nothing.", 1.4, true), icon: "📏", title: "TOO BIG?", lines: ["It refuses, says why,", "and changes nothing"], pos: { x: 960, y: 300 }, width: 480 },
      ],
    },
    {
      title: "How big a campaign can get",
      zooms: [{ from: say("The line beside", -0.3), to: say("Delete a map", -0.2), target: t("Room for more maps"), scale: 1.8 }],
      beats: [
        { kind: "popup", from: say("A backup has to restore"), to: say("The line beside", -0.2), icon: "📦", title: "ONE BACKUP, ONE GO", lines: ["So a table has a size limit"], pos: { x: 600, y: 300 }, width: 480 },
        {
          kind: "chips",
          to: say("Its tooltip", -0.2),
          pos: { x: 600, y: 860 },
          items: [
            { text: "ROOM FOR MORE MAPS", at: say("Room for more maps") },
            { text: "NEARLY FULL", at: say("nearly full") },
            { text: "FULL", at: say("full,", 0) },
            { text: "TOO BIG TO RESTORE", at: say("too big to restore") },
          ],
        },
        { kind: "sticker", from: say("Its tooltip"), to: say("Delete a map", -0.2), text: "TOOLTIP: CAMPAIGN 0.00 MB OF 0.75 MB", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("Delete a map"), to: say("make room.", 1.4, true), text: "🗑️ DELETE A MAP TO MAKE ROOM", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Habits that save campaigns",
      beats: [
        { kind: "title", from: 0.2, to: say("The file name", -0.2), text: "EVERY SESSION", sub: "download a backup at the end", y: 300 },
        { kind: "popup", from: say("The file name"), to: say("Download one before", -0.2), icon: "📅", title: "DATED FOR YOU", lines: ["table-backup-20261012T151425Z.json"], pos: { x: 600, y: 300 }, width: 560 },
        { kind: "sticker", from: say("Download one before"), to: say("On free hosting", -0.2), text: "BEFORE ANYTHING RISKY", pos: { x: 600, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "popup", from: say("On free hosting"), to: say("Building on the main hall", -0.2), icon: "☁️", title: "FREE HOSTING CAN RESET", lines: ["Your downloads folder is", "what you can count on"], lineAt: [say("On free hosting"), say("The file in your downloads")], pos: { x: 600, y: 300 }, width: 520 },
        { kind: "popup", from: say("Building on the main hall"), to: say("shows how.", 1.4, true), icon: "🏰", title: "ON THE MAIN HALL?", lines: ["Save it as a private table", "before it clears", "DM lesson 1 shows how"], lineAt: [say("Save it as a private"), say("before it clears"), say("DM Lesson 1")], pos: { x: 600, y: 300 }, width: 520 },
      ],
    },
  ],
};
