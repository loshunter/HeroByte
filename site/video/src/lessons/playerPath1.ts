import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath1: LessonScript = {
  slug: "player-path-1-join-a-table",
  title: "JOIN A TABLE",
  subtitle: "Player path 1",
  captionFixes: { Herobyte: "HeroByte", "Enter,": "Enter" },
  outro: {
    headline: "YOU'RE IN!",
    next: "Next: Player path 2, The table at a glance. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "The join screen",
      zooms: [
        { from: say("connection status line", -0.3), to: say("Type the table password", -0.2), target: t("Connection status"), scale: 1.9 },
        { from: say("Type the table password", -0.2), to: say("On a built map", -0.3), target: t("Table password"), scale: 1.6 },
        { from: say("the view starts", -0.2), to: say("your token.", 1.4, true), target: t("your token"), scale: 1.6 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("Use Chrome", -0.3), text: "FIRST, GET IN", sub: "before the dice come out", y: 420 },
        { kind: "chips", to: say("Phones get", -0.2), pos: { x: 1250, y: 300 }, items: [{ text: "CHROME", at: say("Chrome") }, { text: "EDGE", at: say("Edge") }, { text: "FIREFOX", at: say("Firefox") }] },
        { kind: "sticker", from: say("Phones get"), to: say("First, the connection", -0.2), text: "📱 PHONES: THEIR OWN TOUCH LAYOUT", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("It should say"), to: say("Type the table password", -0.3), icon: "🟢", tone: "green", title: "CONNECTED", lines: ["The connection status line"], target: t("Connection status"), side: "right", width: 480 },
        { kind: "ring", from: say("press Enter", -0.1), to: mark("ENTER TABLE", 0.7), target: t("ENTER TABLE") },
        { kind: "popup", from: say("Get it wrong"), to: say("Passwords are case", -0.2), icon: "❌", tone: "red", title: "WRONG PASSWORD", lines: ["The error shows in red", "What you typed stays"], lineAt: [say("Get it wrong"), say("What you typed stays")], target: t("error"), side: "right", width: 480 },
        { kind: "sticker", from: say("Passwords are case"), to: say("On a built map", -0.2), text: "Aa ≠ aA · CASE-SENSITIVE", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -3 },
        { kind: "popup", from: say("On a built map"), to: say("your token.", 1.4, true), icon: "🧙", title: "ONE CHARACTER?", lines: ["The view starts on your token"], target: t("your token"), side: "right", width: 480 },
      ],
    },
    {
      title: "Switching tables, codes, forgetting",
      zooms: [
        { from: say("A table picker appears", -0.2), to: say("Have a code", -0.2), target: t("Table picker"), scale: 1.6 },
        { from: say("Have a code"), to: say("Forget this table", -0.2), target: t("Table code"), scale: 1.7 },
        { from: say("Forget this table"), to: say("remembers up to", -0.2), target: t("Forget this table"), scale: 1.7 },
      ],
      beats: [
        { kind: "popup", from: say("A table picker appears"), to: say("Have a code", -0.2), icon: "🗂️", title: "TABLE PICKER", lines: ["Choose the table", "Type its password, enter"], lineAt: [say("Choose the table"), say("type its password")], target: t("Table picker"), side: "right", width: 480 },
        { kind: "popup", from: say("Paste it in"), to: say("Forget this table", -0.2), icon: "🔑", title: "A CODE INSTEAD?", lines: ["Paste it in the table code box", "Then press Join"], lineAt: [say("Paste it in"), say("Then press Join")], target: t("Table code"), side: "right", width: 520 },
        { kind: "popup", from: say("Forget this table"), to: say("remembers up to", -0.2), icon: "🧹", title: "FORGET THIS TABLE", lines: ["Drops it from this browser's list", "You'll need its code to get back"], lineAt: [say("Forget this table"), say("You'll need its code")], target: t("Forget this table"), side: "right", width: 560 },
        { kind: "sticker", from: say("remembers up to"), to: say("The server publishes", -0.2), text: "UP TO 12 TABLES", pos: { x: 1300, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("The server publishes"), to: say("keep your codes.", 1.4, true), text: "NO PUBLIC LIST · KEEP YOUR CODES", pos: { x: 1300, y: 420 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "It remembers you",
      zooms: [{ from: say("You'll see reconnecting", -0.3), to: say("In this browser", -0.2), target: t("Reconnecting"), scale: 2.2 }],
      beats: [
        { kind: "sticker", from: say("a reload drops you"), to: say("If your connection", -0.2), text: "🔄 RELOAD = STRAIGHT BACK IN", pos: { x: 960, y: 420 }, tone: "green", tilt: -2 },
        { kind: "chips", to: say("In this browser", -0.2), pos: { x: 960, y: 300 }, sep: "→", items: [{ text: "RECONNECTING…", at: say("You'll see reconnecting") }, { text: "RE-AUTHENTICATING…", at: say("then re authenticating") }] },
        { kind: "popup", from: say("In this browser"), to: say("DM password again.", 1.4, true), icon: "🪑", title: "SAME PERSON", lines: ["Your seat is held six hours", "Then a DM re-enters the DM password"], lineAt: [say("Your seat is held"), say("After that")], pos: { x: 960, y: 420 }, width: 600 },
      ],
    },
    {
      title: "One tab, one device",
      split: { from: 0, labels: ["NEW TAB", "OLD TAB"] },
      beats: [
        { kind: "sticker", from: 0.3, to: say("Open the same table", -0.2), text: "ONE LIVE CONNECTION PER BROWSER", pos: { x: 960, y: 140 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("Open the same table"), to: mark("ENTER TABLE", 0.8, "dm"), target: t("ENTER TABLE", "dm") },
        { kind: "popup", from: say("older tab pauses"), to: say("Press Reclaim", -0.2), icon: "⏸️", title: "OPENED IN ANOTHER TAB", lines: ["The older tab pauses"], target: t("paused"), side: "below", width: 480 },
        { kind: "ring", from: say("Press Reclaim", -0.1), to: mark("RECLAIM THIS TAB", 0.8), target: t("RECLAIM THIS TAB") },
        { kind: "sticker", from: say("A different device"), to: say("Sometimes this browser", -0.2), text: "ANOTHER DEVICE = A NEW PLAYER", pos: { x: 960, y: 140 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("Held in another window"), to: say("Try again once", -0.2), icon: "🔒", title: "HELD IN ANOTHER WINDOW", lines: ["Your seat stays held"], target: t("Held", "dm"), side: "below", width: 520 },
        { kind: "ring", from: say("Try again once", -0.1), to: mark("TRY AGAIN", 0.8, "dm"), target: t("TRY AGAIN", "dm") },
        { kind: "popup", from: say("That makes you"), to: say("last resort.", 1.4, true), icon: "⚠️", tone: "red", title: "START A FRESH SESSION", lines: ["A new player", "Your old character stays behind", "A last resort"], lineAt: [say("That makes you"), say("You can't get back"), say("last resort")], target: t("START A FRESH SESSION", "dm"), side: "above", width: 560 },
      ],
    },
    {
      title: "The Main Hall",
      zooms: [
        { from: say("It's a public test table", -0.2), to: say("You'll see the public", -0.4), target: t("public test table"), scale: 1.6 },
        { from: say("You'll see the public", -0.2), to: say("anything there.", 1.4, true), target: t("marker"), scale: 1.6 },
      ],
      beats: [
        { kind: "title", from: say("Every server starts"), to: say("It's a public test table", -0.2), text: "THE MAIN HALL", sub: "every server's first table", y: 300 },
        { kind: "chips", to: say("You'll see the public", -0.2), pos: { x: 960, y: 860 }, items: [{ text: "PUBLIC", at: say("It's a public test table") }, { text: "FIXED PASSWORDS", at: say("passwords are fixed") }, { text: "WIPES AFTER AN HOUR EMPTY", at: say("wipes itself") }] },
        { kind: "sticker", from: say("Build freely"), to: say("anything there.", 1.4, true), text: "BUILD FREELY · KEEP NOTHING", pos: { x: 960, y: 520 }, tone: "gold", tilt: -2 },
      ],
    },
  ],
};
