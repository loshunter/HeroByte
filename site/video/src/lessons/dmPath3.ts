import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath3: LessonScript = {
  slug: "dm-path-3-three-ways-to-get-a-map-on-the-table",
  title: "GET A MAP ON THE TABLE",
  subtitle: "DM path 3: three ways",
  captionFixes: { Herobite: "HeroByte", "press.": "press" },
  outro: {
    headline: "THE TABLE HAS A MAP!",
    next: "Next: DM path 4, Build your first room live. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Three ways",
      beats: [
        {
          kind: "ways",
          from: say("three ways"),
          to: say("One rule", -0.2),
          dock: say("Bring your own art", -0.3),
          ways: ["🖼️ BRING YOUR OWN ART", "🏗️ BUILD IT HERE", "🚪 KICK IN A DOOR"],
          active: [say("Bring your own art"), say("build it here"), say("kick in a door")],
        },
        { kind: "sticker", from: say("switch between them"), to: say("One rule", -0.2), text: "SWITCH MID-SESSION", pos: { x: 960, y: 520 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("One rule"), to: say("lovely it is.", 1.4, true), icon: "📏", tone: "gold", title: "ONE RULE", lines: ["Fog and the kicked-in door", "need a live map", "A picture alone isn't one"], lineAt: [say("Fog and the"), say("need a live map"), say("A picture on its own")], pos: { x: 960, y: 420 }, width: 560 },
      ],
    },
    {
      title: "A: bring your own art",
      zooms: [
        { from: say("upload your image", -0.3), to: say("paste a link", -0.2), target: t("UPLOAD IMAGE"), scale: 1.5 },
        { from: say("Click two opposite", -0.3), to: say("Press Apply", -0.2), target: t("corner 1"), scale: 2.2 },
      ],
      beats: [
        { kind: "chips", to: say("Everything we need", -0.2), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "DM MENU", at: say("Open the DM menu") }, { text: "MAPS", at: say("then Maps") }] },
        { kind: "popup", from: say("upload your image"), to: say("paste a link", -0.2), icon: "🖼️", title: "MAP BACKGROUND", lines: ["Upload your image", "Stored with your table"], lineAt: [say("upload your image"), say("stored with your table")], target: t("UPLOAD IMAGE"), side: "left", width: 480 },
        { kind: "popup", from: say("paste a link"), to: say("Now match the grid", -0.2), icon: "🔗", title: "OR A LINK", lines: ["The image's host must allow it", "Nothing appears? Upload it"], lineAt: [say("host must allow"), say("If nothing appears")], target: t("paste a link"), side: "left", width: 520 },
        { kind: "popup", from: say("starts locked"), to: say("press Start Alignment", -0.2), icon: "🔒", title: "A NEW MAP STARTS LOCKED", lines: ["Unlock it to align it"], target: t("MAP LOCKED"), side: "left", width: 520 },
        { kind: "ring", from: say("press Start Alignment", -0.1), to: mark("START ALIGNMENT", 0.8), target: t("START ALIGNMENT") },
        { kind: "sticker", from: say("Click two opposite"), to: say("Press Apply", -0.2), text: "TWO OPPOSITE CORNERS OF ONE SQUARE", pos: { x: 600, y: 200 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("Press Apply", -0.1), to: mark("APPLY ALIGNMENT", 0.8), target: t("APPLY ALIGNMENT") },
        { kind: "chips", to: say("lock the map again.", 1.4, true), pos: { x: 600, y: 860 }, items: [{ text: "SQUARE SIZE IN FEET", at: say("Set Square Size") }, { text: "🔒 LOCK IT AGAIN", at: say("lock the map again") }] },
      ],
    },
    {
      title: "B: build it here",
      zooms: [{ from: say("The live badge", -0.3), to: say("from here.", 1.2, true), target: t("LIVE"), scale: 1.8 }],
      beats: [
        { kind: "chips", to: say("Open build map", -0.2), pos: { x: 960, y: 300 }, items: [{ text: "WALLS BLOCK SIGHT", at: say("Walls block sight") }, { text: "DOORS OPEN", at: say("doors open") }, { text: "FOG REVEALS", at: say("fog reveals") }] },
        { kind: "ring", from: say("Open build map", -0.1), to: mark("Build map", 0.7), target: t("Build map") },
        { kind: "ring", from: say("Start live map", -0.1), to: mark("START LIVE MAP", 0.7), target: t("START LIVE MAP") },
        { kind: "sticker", from: say("Lesson four"), to: say("from here.", 1.2, true), text: "LESSON 4 BUILDS A ROOM", pos: { x: 960, y: 300 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "C: kick in a door",
      zooms: [{ from: say("name already filled", -0.3), to: say("Seconds later", -0.4), target: t("name"), scale: 1.6 }],
      beats: [
        { kind: "title", from: 0.2, to: say("Close the editor", -0.2), text: "THEY ALWAYS DO", sub: "somewhere you never prepped", y: 420, sfx: "ping.wav" },
        { kind: "chips", to: say("The panel has", -0.2), pos: { x: 960, y: 300 }, sep: "›", items: [{ text: "CLOSE THE EDITOR", at: say("Close the editor") }, { text: "CLICK THE MAP", at: say("click the map") }, { text: "G", at: say("press G") }] },
        { kind: "key", from: say("press G"), to: say("The panel has", -0.1), label: "G", pos: { x: 960, y: 520 }, sfx: "button-blip.wav", shake: true },
        { kind: "chips", to: say("Press generate", -0.2), pos: { x: 960, y: 860 }, items: [{ text: "DUNGEON", at: say("Dungeon") }, { text: "TAVERN", at: say("a tavern") }, { text: "SHOP", at: say("shop,") }, { text: "WAREHOUSE", at: say("warehouse") }, { text: "HOUSE", at: say("or house") }] },
        { kind: "ring", from: say("Press generate", -0.1), to: say("Seconds later", -0.4), target: t("Generate & enter") },
        { kind: "sticker", from: say("Reroll only"), to: say("Seconds later", -0.4), text: "REROLL = A NEW SEED", pos: { x: 960, y: 300 }, tone: "blue", tilt: -2 },
        { kind: "title", from: say("Seconds later"), to: say("Fog is on", -0.2), text: "SOMEWHERE NEW!", y: 300 },
        { kind: "chips", to: say("A door sprite", -0.2), pos: { x: 960, y: 860 }, items: [{ text: "🌫 FOG ON", at: say("Fog is on") }, { text: "🧍 PARTY AT THE ENTRANCE", at: say("the party stands") }] },
        { kind: "popup", from: say("A door sprite"), to: say("as you left it.", 1.4, true), icon: "🚪", title: "THE WAY BACK", lines: ["A door sprite leads back", "Click, confirm: the old scene returns"], lineAt: [say("A door sprite"), say("Click it, confirm")], pos: { x: 960, y: 300 }, width: 600 },
      ],
    },
    {
      title: "Mixing them",
      beats: [
        { kind: "popup", from: say("Want fog on"), to: say("A kicked in place", -0.2), icon: "🖼️", title: "FOG ON YOUR OWN ART", lines: ["Upload it, start a live map", "Draw only walls and doors over it", "Walls are invisible to players"], lineAt: [say("Upload it"), say("draw only walls"), say("Walls are invisible")], pos: { x: 960, y: 300 }, width: 620 },
        { kind: "sticker", from: say("A kicked in place"), to: say("Every map can join", -0.2), text: "A KICKED-IN PLACE IS AN ORDINARY MAP", pos: { x: 960, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "ring", from: say("World tab", -0.3), to: say("World tab.", 1.6, true), target: t("World") },
      ],
    },
  ],
};
