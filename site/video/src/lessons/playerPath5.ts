import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath5: LessonScript = {
  slug: "player-path-5-draw-measure-and-ping",
  title: "DRAW, MEASURE AND PING",
  subtitle: "Player path 5",
  captionFixes: { "15-foot": "15 ft" },
  outro: {
    headline: "PLAN THAT BATTLE!",
    next: "Next: Player path 6, Fog, doors and what you can see. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Draw",
      zooms: [
        { from: say("The toolbox runs", -0.2), to: say("Settings has color", 1.2), target: t("toolbox"), scale: 1.5 },
        { from: say("A drawing reaches", -0.6), to: say("Press Move", -0.2), target: t("circle"), scale: 1.3 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("Press Draw", -0.2), text: "EVERY PLAN NEEDS A PICTURE", sub: "or at least a very confident arrow", y: 420 },
        { kind: "ring", from: say("Press Draw", -0.1), to: mark("Draw", 0.7), target: t("Draw") },
        { kind: "chips", to: say("Pick freehand", -0.2), pos: { x: 1250, y: 300 }, sep: "→", items: [{ text: "TOOL", at: say("Tool,") }, { text: "SETTINGS", at: say("then Settings") }, { text: "HISTORY", at: say("then History") }] },
        { kind: "chips", to: say("Settings has color", -0.2), pos: { x: 1250, y: 300 }, items: [{ text: "FREEHAND", at: say("Pick freehand") }, { text: "LINE", at: say("line,") }, { text: "RECTANGLE", at: say("rectangle") }, { text: "CIRCLE", at: say("or circle") }] },
        { kind: "sticker", from: say("can be filled"), to: say("Settings has color", -0.2), text: "▭ ⬤ CAN BE FILLED", pos: { x: 1250, y: 420 }, tone: "gold", tilt: -2 },
        { kind: "chips", to: say("A drawing reaches", -0.2), pos: { x: 1250, y: 300 }, tone: "blue", items: [{ text: "COLOUR", at: say("Settings has color") }, { text: "STROKE WIDTH", at: say("stroke width") }, { text: "OPACITY", at: say("and opacity") }] },
        { kind: "sticker", from: say("A drawing reaches"), to: say("Press Move", -0.2), text: "SENT WHEN YOU FINISH THE STROKE", pos: { x: 1250, y: 300 }, tone: "green", tilt: 2 },
        { kind: "ring", from: say("Press Move", -0.1), to: mark("Move", 0.7), target: t("Move") },
      ],
    },
    {
      title: "Undo and erase",
      zooms: [{ from: say("Erase drawings cuts", -0.2), to: say("You can erase", -0.2), target: t("erase arrow"), scale: 1.4 }],
      beats: [
        { kind: "sticker", from: 0.3, to: say("Ctrl", -0.2), text: "ONLY YOUR OWN DRAWINGS", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "key", from: say("Ctrl -Z"), to: say("Ctrl -Y", -0.1), label: "CTRL+Z", pos: { x: 1100, y: 420 }, sfx: "button-blip.wav" },
        { kind: "key", from: say("Ctrl -Y"), to: say("Erase drawings cuts", -0.2), label: "CTRL+Y", pos: { x: 1400, y: 420 }, sfx: "button-blip.wav" },
        { kind: "popup", from: say("Erase drawings cuts"), to: say("Other shapes go whole", -0.2), icon: "✂️", title: "ERASE", lines: ["Cuts through a freehand line"], target: t("erase arrow"), side: "right", width: 480 },
        { kind: "sticker", from: say("Other shapes go whole"), to: say("You can erase", -0.2), text: "OTHER SHAPES GO WHOLE", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 3 },
        { kind: "chips", to: say("anyone's.", 1.4, true), pos: { x: 1250, y: 860 }, items: [{ text: "YOURS", at: say("your own drawings") }, { text: "NO OWNER", at: say("no owner") }, { text: "DM: ANYONE'S", at: say("The DM can") }] },
      ],
    },
    {
      title: "Area templates",
      zooms: [
        { from: say("Drag out from", -0.4), to: say("Everyone sees it", -0.2), target: t("cone"), scale: 1.5 },
        { from: say("Everyone sees it"), to: say("standing in it.", 1.4, true), target: t("burst"), scale: 1.4 },
      ],
      beats: [
        { kind: "chips", to: say("Drag out from", -0.2), pos: { x: 1250, y: 300 }, items: [{ text: "BURST", at: say("Burst,") }, { text: "CONE", at: say("cone,") }, { text: "CUBE", at: say("cube,") }, { text: "BOLT", at: say("and bolt") }] },
        { kind: "popup", from: say("snaps to whole squares"), to: say("Everyone sees it", -0.2), icon: "🔺", title: "15 FT CONE", lines: ["Snaps to whole squares", "Labelled with its size"], lineAt: [say("snaps to whole squares"), say("labeled with its size")], target: t("cone"), side: "right", width: 460 },
        { kind: "sticker", from: say("Everyone sees it"), to: say("standing in it.", 1.4, true), text: "EVEN WHOEVER IS STANDING IN IT", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Measure",
      zooms: [{ from: say("Click a start point", -0.2), to: say("A third click", 0.6), target: t("distance"), scale: 1.4 }],
      beats: [
        { kind: "ring", from: say("Press measure", -0.1), to: mark("Measure", 0.7), target: t("Measure") },
        { kind: "chips", to: say("The whole table", -0.2), pos: { x: 1250, y: 300 }, sep: "→", items: [{ text: "CLICK: START", at: say("Click a start point") }, { text: "CLICK: FREEZE", at: say("Click again to freeze") }, { text: "CLICK: FRESH", at: say("A third click") }] },
        { kind: "sticker", from: say("The whole table"), to: say("Distance follows", -0.2), text: "EVERYONE SEES IT, WITH YOUR NAME", pos: { x: 1250, y: 420 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("Distance follows"), to: say("set by the DM.", 1.4, true), text: "THE TABLE'S DIAGONAL RULE", pos: { x: 1250, y: 420 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Ping",
      zooms: [{ from: say("Ping plants", -0.2), to: say("You can also", -0.2), target: t("ping"), scale: 1.5 }],
      beats: [
        { kind: "popup", from: say("colored burst"), to: say("You can also", -0.2), icon: "📍", title: "PING", lines: ["Your colour and your name", "Three seconds, with a chime"], lineAt: [say("colored burst"), say("three seconds")], target: t("ping"), side: "right", width: 480 },
        { kind: "sticker", from: say("double -click"), to: say("in any tool.", 1.4, true), text: "DOUBLE-CLICK EMPTY MAP = PING", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "On a phone",
      phone: { from: 0, label: "PHONE" },
      beats: [
        { kind: "chips", to: say("Hide Controls", -0.2), pos: { x: 560, y: 880 }, sep: "›", items: [{ text: "TOOLS", at: say("open Tools") }, { text: "DRAW", at: say("then draw") }] },
        { kind: "sticker", from: say("Hide Controls"), to: say("The small row", -0.2), text: "HIDE CONTROLS · THE TOOL STAYS ON", pos: { x: 560, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "chips", to: say("Double tap", -0.2), pos: { x: 560, y: 300 }, tone: "blue", items: [{ text: "UNDO", at: say("Undo,") }, { text: "REDO", at: say("Redo,") }, { text: "CANCEL", at: say("Cancel") }, { text: "DONE", at: say("and Done") }] },
        { kind: "sticker", from: say("Double tap"), to: say("to ping.", 1.4, true), text: "DOUBLE-TAP = PING", pos: { x: 560, y: 420 }, tone: "green", tilt: 2 },
      ],
    },
  ],
};
