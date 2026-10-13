import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath2: LessonScript = {
  slug: "dm-path-2-become-the-dm-and-invite-players",
  title: "BECOME THE DM",
  subtitle: "DM path 2: and invite players",
  captionFixes: { "dialogue": "dialog", "great": "greyed", "doc's": "dock's" },
  outro: {
    headline: "THE SCREEN IS YOURS!",
    next: "Next: DM path 3, Three ways to get a map on the table. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Enter DM mode",
      zooms: [
        { from: say("Under your role", -0.2), to: say("A wrong password", -0.4), target: t("Your role"), scale: 1.6 },
        { from: say("A wrong password", -0.2), to: say("15 seconds.", 1.2, true), target: t("the reason"), scale: 1.8 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("DM mode belongs", -0.2), text: "BEHIND THE SCREEN", sub: "and today it's you", y: 420 },
        { kind: "sticker", from: say("DM mode belongs"), to: say("Press the table button", -0.2), text: "DM MODE BELONGS TO THE TABLE", pos: { x: 960, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("Press the table button", -0.1), to: mark("Table button", 0.7), target: t("Table button") },
        { kind: "popup", from: say("A wrong password"), to: say("After five wrong", -0.2), icon: "❌", tone: "red", title: "WRONG PASSWORD", lines: ["The dialog stays open, with the reason", "You stay a player"], lineAt: [say("A wrong password"), say("you stay a player")], target: t("the reason"), side: "right", width: 560 },
        { kind: "sticker", from: say("After five wrong"), to: say("15 seconds.", 1.2, true), text: "5 WRONG TRIES = LOCKED 15 S", pos: { x: 960, y: 300 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "First DM on a new table",
      zooms: [{ from: say("offers to set one", -0.3), to: say("it's saved.", 1.2, true), target: t("set one"), scale: 1.6 },],
      beats: [
        { kind: "popup", from: say("offers to set one"), to: say("it's saved.", 1.2, true), icon: "👑", title: "SET THE DM PASSWORD", lines: ["No DM password yet?", "The first try sets one"], lineAt: [say("This table was made"), say("offers to set one")], target: t("set one"), side: "right", width: 520 },
        { kind: "sticker", from: say("You become the DM"), to: say("it's saved.", 1.2, true), text: "DM THE MOMENT IT'S SAVED", pos: { x: 960, y: 200 }, tone: "green", tilt: -2 },
      ],
    },
    {
      title: "What you get",
      zooms: [{ from: 0, to: say("The DM menu sits", -0.2), target: t("Build map"), scale: 1.5 }],
      beats: [
        { kind: "chips", to: say("The DM menu sits", -0.2), pos: { x: 960, y: 300 }, items: [{ text: "🏗️ BUILD MAP", at: say("Build Map") }, { text: "👁 PLAYER VIEW", at: say("and Player View") }] },
        { kind: "ring", from: say("The DM menu sits", -0.1), to: mark("DM MENU", 0.8), target: t("DM MENU") },
        { kind: "sticker", from: say("six tabs"), to: say("On a phone", -0.2), text: "SIX TABS", pos: { x: 700, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "sticker", from: say("On a phone"), to: say("The Table menu now", -0.2), text: "📱 PHONE: RESET BECOMES ♛ DM", pos: { x: 700, y: 300 }, tone: "blue", tilt: -2 },
        { kind: "popup", from: say("Table Settings"), to: say("Table tab.", 1.2, true), icon: "⚙️", title: "TABLE SETTINGS…", lines: ["Opens the DM Menu on its Table tab"], target: t("Table tab"), side: "left", width: 520 },
      ],
    },
    {
      title: "Invite players",
      zooms: [
        { from: 0, to: say("Any time later", -0.2), target: t("Invite players (greyed)"), scale: 1.6 },
        { from: say("Any time later"), to: say("by hand.", 1.4, true), target: t("Invite"), scale: 1.5 },
      ],
      beats: [
        { kind: "popup", from: say("Invite players on the"), to: say("Clicking it harder", -0.2), icon: "🔒", title: "GREYED UNTIL YOU'VE BEEN THE DM", target: t("Invite players (greyed)"), side: "below", width: 560 },
        { kind: "sticker", from: say("Clicking it harder"), to: say("Now it works", -0.2), text: "CLICKING HARDER DOESN'T HELP", pos: { x: 960, y: 520 }, tone: "blue", tilt: -3 },
        { kind: "ring", from: say("Now it works"), to: mark("Invite players", 0.8), target: t("Invite players") },
        { kind: "chips", to: say("The link carries", -0.2), pos: { x: 700, y: 300 }, sep: "›", items: [{ text: "DM MENU", at: say("DM Menu") }, { text: "TABLE", at: say("Table") }, { text: "INVITE", at: say("Invite", 0, false) }] },
        { kind: "popup", from: say("The link carries"), to: say("On a plain", -0.2), icon: "🔗", title: "NO PASSWORD IN THE LINK", lines: ["Send the password another way"], lineAt: [say("Send the password")], target: t("Copy invite link"), side: "left", width: 520 },
        { kind: "sticker", from: say("On a plain"), to: say("by hand.", 1.4, true), text: "COPY BLOCKED? THE LINK SHOWS IN A BOX", pos: { x: 700, y: 300 }, tone: "gold", tilt: 2 },
      ],
    },
    {
      title: "Who is at the table",
      zooms: [
        { from: 0, to: say("Remove appears", -0.2), target: t("Players at this table"), scale: 1.5 },
        { from: say("Remove appears"), to: say("There's no undo", 1.2), target: t("REMOVE"), scale: 1.8 },
      ],
      beats: [
        { kind: "popup", from: say("Select All grabs"), to: say("Remove appears", -0.2), icon: "🖱️", title: "SELECT ALL", lines: ["Every unlocked token a player owns"], target: t("Select All"), side: "left", width: 520 },
        { kind: "popup", from: say("Remove appears"), to: say("It's not a ban", -0.2), icon: "🧹", tone: "red", title: "REMOVE", lines: ["Only for someone not at the table", "Seat, characters and tokens", "Locked tokens stay, and pass to you"], lineAt: [say("Remove appears"), say("It clears their seat"), say("A locked token stays")], target: t("REMOVE"), side: "left", width: 560 },
        { kind: "sticker", from: say("There's no undo"), to: say("The password", -0.2), text: "NO UNDO", pos: { x: 700, y: 300 }, tone: "gold", tilt: -3 },
        { kind: "sticker", from: say("It's not a ban"), to: say("As a new player.", 1.4, true), text: "NOT A BAN", pos: { x: 700, y: 420 }, tone: "green", tilt: -2 },
      ],
    },
    {
      title: "Stepping down, co-DMs",
      beats: [
        { kind: "ring", from: say("Leave DM Mode", -0.1), to: mark("LEAVE DM MODE", 0.7), target: t("LEAVE DM MODE") },
        { kind: "chips", to: say("Share the DM password", -0.2), pos: { x: 960, y: 300 }, items: [{ text: "YOU KEEP YOUR CHARACTER", at: say("You keep your character") }, { text: "THE PASSWORD BRINGS IT BACK", at: say("The password brings") }] },
        { kind: "popup", from: say("Share the DM password"), to: say("DM powers.", 1.4, true), icon: "👥", title: "CO-DM", lines: ["Share the DM password", "Both hold DM powers"], lineAt: [say("Share the DM password"), say("you can both hold")], pos: { x: 960, y: 420 }, width: 480 },
      ],
    },
  ],
};
