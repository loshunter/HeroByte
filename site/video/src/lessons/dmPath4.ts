import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath4: LessonScript = {
  slug: "dm-path-4-build-your-first-room-live",
  title: "BUILD YOUR FIRST ROOM",
  subtitle: "DM path 4: live on the table",
  outro: {
    headline: "ONE ROOM DOWN!",
    next: "Next: DM path 5, Doors, walls and fog. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Start a live map",
      zooms: [{ from: say("The live badge", -0.3), to: say("The tools are grouped", -0.3), target: t("LIVE"), scale: 1.8 }],
      beats: [
        { kind: "title", from: 0.2, to: say("The map editor", -0.2), text: "ONE ROOM", sub: "every dungeon starts here", y: 420, sfx: "ping.wav" },
        { kind: "sticker", from: say("Players see each edit"), to: say("Press Build Map", -0.2), text: "PLAYERS SEE EVERY EDIT LIVE", pos: { x: 960, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("Press Build Map", -0.1), to: mark("Build map", 0.7), target: t("Build map") },
        { kind: "ring", from: say("then Start Live Map", -0.1), to: mark("START LIVE MAP", 0.7), target: t("START LIVE MAP") },
        { kind: "popup", from: say("That makes a fresh map"), to: say("The live badge", -0.2), icon: "🗺️", title: "A FRESH MAP", lines: ["Bound to the table"], pos: { x: 960, y: 300 }, width: 480 },
        { kind: "sticker", from: say("You'll see saving"), to: say("The tools are grouped", -0.2), text: "SAVING… FLICKERS AS EDITS LAND", pos: { x: 960, y: 760 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("The tools are grouped", -0.1), to: say("and Generate.", 1.4, true), target: t("Tool group") },
        {
          kind: "chips",
          to: say("and Generate.", 1.4, true),
          pos: { x: 1100, y: 860 },
          items: [
            { text: "TERRAIN", at: say("Terrain") },
            { text: "STRUCTURES", at: say("Structures") },
            { text: "OBJECTS", at: say("Objects") },
            { text: "LIGHTING", at: say("Lighting") },
            { text: "GENERATE", at: say("Generate") },
          ],
        },
      ],
    },
    {
      title: "Pick a floor and walls",
      zooms: [{ from: say("The brush deck", -0.3), to: say("Wall ring picks", -0.3), target: t("brush deck"), scale: 1.5 }],
      beats: [
        { kind: "ring", from: say("pick room", -0.1), to: mark("Room", 0.7), target: t("Room") },
        { kind: "popup", from: say("The brush deck"), to: say("Wall ring picks", -0.2), icon: "🧱", title: "THE BRUSH DECK PICKS THE FLOOR", lines: ["Choose a shelf", "or search by name"], lineAt: [say("Choose a shelf"), say("search by name")], pos: { x: 1250, y: 300 }, width: 560 },
        { kind: "ring", from: say("Wall ring picks", -0.1), to: say("None leaves", -0.2), target: t("Wall ring") },
        {
          kind: "chips",
          to: say("None leaves", -0.2),
          pos: { x: 1100, y: 860 },
          items: [
            { text: "NONE", at: say("None,") },
            { text: "STONE", at: say("stone,") },
            { text: "BRICK", at: say("brick,") },
            { text: "TIMBER", at: say("timber") },
            { text: "DARK", at: say("or dark") },
          ],
        },
        { kind: "sticker", from: say("None leaves"), to: say("blocks sight.", 1.4, true), text: "NONE STILL BLOCKS SIGHT", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Drag out the room",
      zooms: [{ from: say("The preview shows", -0.3), to: say("Let go", -0.2), target: t("preview"), scale: 1.4 }],
      beats: [
        { kind: "popup", from: say("The preview shows"), to: say("Let go", -0.2), icon: "📐", title: "THE PREVIEW", lines: ["The real floor", "A size in cells"], lineAt: [say("the real floor"), say("a size in cells")], pos: { x: 560, y: 300 }, width: 460 },
        {
          kind: "chips",
          to: say("That whole room", -0.2),
          pos: { x: 1100, y: 860 },
          items: [
            { text: "FLOOR", at: say("You get floor") },
            { text: "WALL BAND", at: say("a wall band") },
            { text: "BLOCKING WALLS", at: say("blocking walls") },
          ],
        },
        { kind: "sticker", from: say("That whole room"), to: say("step to undo.", 1.4, true), text: "ONE ROOM = ONE UNDO", pos: { x: 960, y: 300 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "Undo, redo and Escape",
      beats: [
        { kind: "ring", from: say("Undo Map and Redo Map", -0.1), to: say("Ctrl -Z", -0.1), target: t("Undo map") },
        { kind: "key", from: say("Ctrl -Z"), to: say("Ctrl -Y", -0.1), label: "CTRL+Z", pos: { x: 1100, y: 420 }, sfx: "button-blip.wav" },
        { kind: "key", from: say("Ctrl -Y"), to: say("Each drag", -0.1), label: "CTRL+Y", pos: { x: 1400, y: 420 }, sfx: "button-blip.wav" },
        { kind: "sticker", from: say("Each drag"), to: say("Mid -drag", -0.2), text: "EACH DRAG = ONE STEP", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "key", from: say("Escape cancels it"), to: say("Press Escape again", -0.1), label: "ESC", pos: { x: 1250, y: 420 }, sfx: "button-blip.wav" },
        { kind: "key", from: say("Press Escape again"), to: say("The map stays live", -0.1), label: "ESC", pos: { x: 1250, y: 420 }, sfx: "button-blip.wav" },
        { kind: "sticker", from: say("The map stays live"), to: say("Open Build Map again", -0.2), text: "THE MAP STAYS LIVE", pos: { x: 960, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("Open Build Map again", -0.1), to: mark("Build map", 0.8), target: t("Build map") },
        { kind: "popup", from: say("One edit goes"), to: say("Think of it", -0.2), icon: "⏳", title: "ONE EDIT AT A TIME", lines: ["Still saving the last change.", "Draw it again.", "Nothing was half-applied"], lineAt: [say("Still saving the last change"), say("Draw it again"), say("Nothing was half")], pos: { x: 960, y: 360 }, width: 600 },
        { kind: "title", from: say("Think of it"), to: say("at a time.", 1.4, true), text: "ONE BRICK AT A TIME", y: 300 },
      ],
    },
    {
      title: "What your players see",
      split: { from: 0, labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "sticker", from: say("The room appeared"), to: say("Players don't see walls", -0.2), text: "IT APPEARED AS YOU BUILT IT", pos: { x: 1440, y: 260 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("Players don't see walls"), to: say("To check from your side", -0.2), icon: "🌫", title: "PLAYERS DON'T SEE WALLS", lines: ["They feel them", "through fog and movement"], lineAt: [say("Players don't see walls"), say("They act through")], pos: { x: 1440, y: 300 }, width: 520 },
        { kind: "ring", from: say("press player view", -0.1), to: mark("Player View", 0.8), target: t("Player View") },
        { kind: "sticker", from: say("You keep building"), to: say("while it's on.", 1.4, true), text: "👁 KEEP BUILDING WHILE IT'S ON", pos: { x: 480, y: 260 }, tone: "gold", tilt: -2 },
      ],
    },
  ],
};
