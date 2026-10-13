import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath3: LessonScript = {
  slug: "player-path-3-your-character-card",
  title: "YOUR CHARACTER CARD",
  subtitle: "Player path 3",
  captionFixes: { "2": "to", centers: "centres" },
  outro: {
    headline: "YOUR HERO, YOUR WAY!",
    next: "Next: Player path 4, Roll dice. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Open your card",
      zooms: [
        { from: say("The party lists"), to: say("Select your row", -0.2), target: t("Party"), scale: 1.6 },
        { from: say("card opens", -0.3), to: say("Escape", -0.1), target: t("card"), scale: 1.5 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("The party lists", -0.3), text: "A NAME, A FACE…", sub: "…and a place to count the bruises", y: 420 },
        { kind: "popup", from: say("characters, not players"), to: say("Select your row", -0.2), icon: "📋", title: "THE PARTY", lines: ["One row per character", "Not per player"], target: t("Party"), side: "above", width: 520 },
        { kind: "ring", from: say("Select your row", -0.1), to: mark("your row", 0.7), target: t("your row") },
        { kind: "popup", from: say("card opens"), to: say("Escape", -0.2), icon: "🃏", title: "YOUR CARD", lines: ["Opens beside the rows"], target: t("card"), side: "left", width: 460 },
        { kind: "key", from: say("Escape"), to: say("Select another row", -0.2), label: "ESC", pos: { x: 960, y: 420 }, sfx: "button-blip.wav" },
        { kind: "ring", from: say("Select another row", -0.1), to: mark("Bram's row", 0.6), target: t("Bram's row") },
        { kind: "ring", from: say("Cards shows", -0.1), to: mark("Cards", 0.8), target: t("Cards") },
        { kind: "sticker", from: mark("Cards", 0.4), to: mark("Roster", -0.1), text: "EVERY CARD AT ONCE", pos: { x: 960, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Name, HP and temp HP",
      zooms: [
        { from: 0, to: say("drag along the bar", -0.2), target: t("max HP"), scale: 1.7 },
        { from: say("drag along the bar"), to: say("Temp HP is", -0.2), target: t("HP bar down"), scale: 1.8 },
        { from: say("Temp HP is"), to: say("used up before", 0.4), target: t("Temp HP"), scale: 1.8 },
        { from: say("sword button", -0.3), to: say("token.", 1.4), target: t("⚔️"), scale: 1.7 },
      ],
      beats: [
        { kind: "popup", from: say("Click the name"), to: say("Click either", -0.2), icon: "✏️", title: "RENAME", lines: ["Click the name"], target: t("name"), side: "left", width: 420 },
        {
          kind: "popup",
          from: say("Click either"),
          to: say("drag along the bar", -0.2),
          icon: "❤️",
          tone: "red",
          title: "HIT POINTS",
          lines: ["Click a number, type", "Enter or click away saves"],
          lineAt: [say("Click either"), say("enter or click away")],
          target: t("max HP"),
          side: "left",
          width: 520,
        },
        {
          kind: "chips",
          to: say("Temp HP is", -0.2),
          pos: { x: 960, y: 220 },
          items: [
            { text: "🟢 GREEN", at: say("green") },
            { text: "🟠 AMBER", at: say("amber") },
            { text: "🔴 RED", at: say("red") },
          ],
        },
        { kind: "popup", from: say("Temp HP is"), to: say("The sword button", -0.2), icon: "🛡️", tone: "blue", title: "TEMP HP", lines: ["A separate pool", "Used up first"], lineAt: [say("separate pool"), say("used up before")], target: t("Temp HP"), side: "left", width: 460 },
        { kind: "ring", from: say("sword button", -0.1), to: mark("⚔️", 0.8), target: t("⚔️") },
        { kind: "popup", from: say("sword button"), to: say("token.", 1.4), icon: "⚔️", title: "FIND MY TOKEN", lines: ["Centres the map on it"], target: t("⚔️"), side: "left", width: 460 },
      ],
    },
    {
      title: "Portrait and token art",
      zooms: [
        { from: say("The gear opens", -0.2), to: say("Your portrait", -0.2), target: t("⚙️"), scale: 1.8 },
        { from: say("Your portrait"), to: say("a PNG", -0.2), target: t("Portrait Image URL"), scale: 1.5 },
        { from: say("a PNG"), to: say("paste a link", -0.2), target: t("UPLOAD IMAGE (token)"), scale: 1.5 },
        { from: say("paste a link"), to: say("Other sites are", -0.2), target: t("Token Image URL"), scale: 1.6 },
      ],
      beats: [
        { kind: "ring", from: say("The gear opens", -0.1), to: mark("⚙️", 0.7), target: t("⚙️") },
        { kind: "sticker", from: say("one window per character"), to: say("Your portrait", -0.2), text: "ONE WINDOW PER CHARACTER", pos: { x: 1300, y: 300 }, tone: "blue", tilt: 2 },
        {
          kind: "chips",
          to: say("There are two ways", -0.2),
          pos: { x: 1300, y: 900 },
          sep: "≠",
          items: [
            { text: "🖼️ PORTRAIT", at: say("Your portrait") },
            { text: "🪙 TOKEN", at: say("your token are") },
          ],
        },
        {
          kind: "ways",
          from: say("There are two ways"),
          to: say("Clear takes", -0.2),
          ways: ["⬆ UPLOAD IMAGE", "🔗 PASTE A LINK + APPLY"],
          active: [say("Upload image sends"), say("paste a link")],
          dock: say("a PNG"),
        },
        { kind: "popup", from: say("a PNG"), to: say("paste a link", -0.2), icon: "📁", title: "UPLOAD", lines: ["PNG, JPEG, GIF or WebP", "Up to 5 MB"], lineAt: [say("a PNG"), say("megabytes")], target: t("UPLOAD IMAGE (token)"), side: "right", width: 480 },
        { kind: "popup", from: say("Links work from"), to: say("Clear takes", -0.2), icon: "🔗", title: "LINKS", lines: ["Imgur and Discord only", "Nothing shows? Upload it"], lineAt: [say("Links work from"), say("shows nothing")], target: t("links"), side: "right", width: 520 },
        { kind: "ring", from: say("Clear takes", -0.1), to: mark("Clear", 0.8), target: t("Clear") },
        { kind: "sticker", from: mark("Clear", 0.3), to: say("in your color", 1.2, true), text: "BACK TO A PLAIN SQUARE", pos: { x: 1300, y: 300 }, tone: "gold", tilt: -3 },
      ],
    },
    {
      title: "Conditions and size",
      zooms: [
        { from: 0, to: say("Up to three", -0.2), target: t("Status Effects"), scale: 1.5 },
        { from: say("Up to three"), to: say("Token size", -0.2), target: t("token conditions"), scale: 1.8 },
        { from: say("Token size runs"), to: say("gargantuan.", 1.2, true), target: t("Large"), scale: 1.6 },
      ],
      beats: [
        { kind: "popup", from: say("checklist", -0.3), to: say("Up to three", -0.3), icon: "🧾", title: "STATUS EFFECTS", lines: ["A checklist of conditions"], target: t("Status Effects"), side: "right", width: 480 },
        { kind: "sticker", from: say("Up to three"), to: say("plus bubble", 1.0), text: "3 SHOW · THE REST ROLL INTO +1", pos: { x: 1300, y: 260 }, tone: "gold", tilt: 2 },
        { kind: "chips", to: say("gargantuan.", 1.2, true), pos: { x: 1120, y: 880 }, sep: "→", items: [{ text: "TINY", at: say("tiny") }, { text: "GARGANTUAN", at: say("gargantuan") }] },
      ],
    },
    {
      title: "Your token on the map",
      zooms: [
        { from: 0, to: say("Your color is", -0.2), target: t("token"), scale: 1.8 },
        { from: say("Your color is"), to: say("Double click your token", -0.2), target: t("Colour"), scale: 1.6 },
        { from: say("Double click your token", -0.1), to: say("With TRANSFORM", -0.4), target: t("double-click token"), scale: 1.7 },
        { from: say("click a token", -0.2), to: say("A lock badge", -0.2), target: t("handles"), scale: 1.8 },
        { from: say("A lock badge"), to: say("unlock it.", 1.2, true), target: t("lock badge"), scale: 2.0 },
      ],
      beats: [
        { kind: "chips", to: say("Your color is", -0.2), pos: { x: 1300, y: 900 }, items: [{ text: "🏷️ NAME", at: say("wears its name") }, { text: "❤️ HEALTH BAR", at: say("health bar") }] },
        { kind: "sticker", from: say("yours alone"), to: say("Pick it in", -0.2), text: "NO TWO PLAYERS SHARE A COLOUR", pos: { x: 1300, y: 260 }, tone: "gold", tilt: -2 },
        {
          kind: "chips",
          to: say("striped patches", -0.2),
          pos: { x: 1250, y: 900 },
          sep: "or",
          items: [
            { text: "✋ DRAG & LET GO", at: say("drag the handle") },
            { text: "◌ TAP A DASHED RING", at: say("dashed ring") },
          ],
        },
        { kind: "popup", from: say("striped patches"), to: say("Double click your token", -0.2), icon: "🚫", tone: "red", title: "STRIPED = TAKEN", lines: ["Other players' colours", "The handle stops at the edge"], lineAt: [say("other player's"), say("stops at their edge")], target: t("striped patch"), side: "right", width: 560 },
        { kind: "sticker", from: say("Double click your token"), to: say("With a picture", -0.2), text: "DOUBLE-CLICK = RANDOM FREE COLOUR", pos: { x: 1250, y: 260 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("With a picture"), to: say("With TRANSFORM", -0.3), icon: "🖼️", title: "WITH A PICTURE", lines: ["Your name on the card", "The ring on your row"], lineAt: [say("your name on"), say("the ring on")], pos: { x: 1250, y: 420 }, width: 480 },
        { kind: "ring", from: say("With TRANSFORM", -0.1), to: mark("TRANSFORM", 0.7), target: t("TRANSFORM") },
        { kind: "popup", from: say("scale and rotate"), to: say("A lock badge", -0.3), icon: "🔄", title: "TRANSFORM", lines: ["Scale and rotate handles"], target: t("handles"), side: "right", width: 460 },
        { kind: "popup", from: say("A lock badge", 0.3), to: say("unlock it.", 1.2, true), icon: "🔒", tone: "gold", title: "LOCKED BY THE DM", lines: ["No one can move it", "Until the DM unlocks it"], lineAt: [say("No one can move"), say("until they unlock")], target: t("lock badge"), side: "right", width: 500 },
      ],
    },
    {
      title: "Save, load, add a character",
      zooms: [
        { from: 0, to: say("one character, never", -0.2), target: t("Save character"), scale: 1.6 },
        { from: say("One warning", -0.2), to: say("Add Character gives", -0.2), target: t("warning"), scale: 1.7 },
        { from: say("Up to five", -0.4), to: say("Up to five", 2.2, true), target: t("second row"), scale: 1.8 },
      ],
      beats: [
        { kind: "ring", from: say("Save Character downloads", -0.1), to: mark("Save character", 0.8), target: t("Save character") },
        { kind: "popup", from: say("Save Character downloads"), to: say("one character, never", -0.2), icon: "💾", title: "CHARACTER FILE", lines: ["Save: a file of this character", "Load: here or at another table"], lineAt: [say("Save Character downloads"), say("Load Character brings")], target: t("Save character"), side: "right", width: 560 },
        { kind: "sticker", from: say("one character, never"), to: say("One warning", -0.2), text: "ONE CHARACTER, NEVER THE WHOLE TABLE", pos: { x: 1250, y: 260 }, tone: "gold", tilt: 2 },
        { kind: "popup", from: say("One warning", 0.2), to: say("Add Character gives", -0.2), icon: "⚠️", tone: "red", title: "ONE WARNING", lines: ["A file with drawings", "replaces your drawings on the map"], target: t("warning"), side: "right", width: 560 },
        { kind: "ring", from: say("Add Character gives", -0.1), to: mark("Add Character", 0.8), target: t("Add Character") },
        { kind: "chips", to: say("Up to five", 2.2, true), pos: { x: 1250, y: 260 }, sep: "+", items: [{ text: "ROW", at: say("own row") }, { text: "CARD", at: say("card,") }, { text: "TOKEN", at: say("token,", 0, false) }, { text: "HP", at: say("and HP") }] },
        { kind: "sticker", from: say("Up to five"), to: say("Up to five", 2.2, true), text: "UP TO 5 EACH", pos: { x: 960, y: 560 }, tone: "green", tilt: -3 },
      ],
    },
    {
      title: "On a phone",
      phone: { from: 0, label: "PHONE" },
      beats: [
        { kind: "ring", from: say("open party", -0.1), to: mark("PARTY", 0.7, "phone"), target: t("PARTY", "phone") },
        { kind: "ring", from: say("Tap or drag", -0.1), to: mark("your HP", 0.8, "phone"), target: t("your HP", "phone") },
        { kind: "ring", from: say("Edit holds", -0.1), to: mark("EDIT", 0.8, "phone"), target: t("EDIT", "phone") },
        {
          kind: "chips",
          to: say("Double tap", -0.2),
          pos: { x: 560, y: 880 },
          items: [
            { text: "NAME", at: say("the name") },
            { text: "COLOUR", at: say("your color") },
            { text: "PORTRAIT", at: say("portrait") },
            { text: "SIZE", at: say("token size") },
            { text: "+ CHARACTER", at: say("add character") },
            { text: "💾 FILE", at: say("character file") },
          ],
        },
        { kind: "sticker", from: say("Double tap"), to: say("Token art is set", -0.2), text: "DOUBLE-TAP = NEW COLOUR", pos: { x: 560, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("Token art is set"), to: say("gave it there.", 1.4, true), icon: "🖥️", title: "TOKEN ART", lines: ["Set it on a computer", "The phone keeps it"], lineAt: [say("Token art is set"), say("The phone keeps")], pos: { x: 560, y: 420 }, width: 500 },
      ],
    },
  ],
};
