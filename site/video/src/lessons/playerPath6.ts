import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath6: LessonScript = {
  slug: "player-path-6-fog-doors-and-what-you-can-see",
  title: "FOG AND DOORS",
  subtitle: "Player path 6: what you can see",
  captionFixes: { Marks: "marks" },
  outro: {
    headline: "MIND THE DARK!",
    next: "More lessons and the full guides: herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Fog follows your tokens",
      zooms: [{ from: say("Vision comes from", -0.2), to: say("Move and your view", -0.2), target: t("token"), scale: 1.4 }],
      beats: [
        { kind: "title", from: 0.2, to: say("When your DM runs", -0.2), text: "THE DARK", sub: "where all the interesting things hide", y: 420 },
        { kind: "sticker", from: say("fog of war hides"), to: say("Vision comes from", -0.2), text: "FOG HIDES WHAT YOU CAN'T SEE", pos: { x: 960, y: 220 }, tone: "gold", tilt: -2 },
        { kind: "chips", to: say("Move and your view", -0.2), pos: { x: 960, y: 860 }, items: [{ text: "👁 YOUR OWN TOKENS", at: say("Vision comes from") }, { text: "🧱 WALLS BLOCK IT", at: say("Walls and closed doors") }] },
        { kind: "sticker", from: say("Move and your view"), to: say("with you.", 1.4, true), text: "YOUR VIEW MOVES WITH YOU", pos: { x: 960, y: 220 }, tone: "green", tilt: 2 },
      ],
    },
    {
      title: "Sight limits",
      zooms: [{ from: say("Past it", -0.3), to: say("Nicely.", 1.2, true), target: t("sight limit"), scale: 1.3 }],
      beats: [
        { kind: "chips", to: say("Past it", -0.2), pos: { x: 960, y: 220 }, items: [{ text: "🔥 A TORCH", at: say("like a torch") }, { text: "🌙 DARKVISION", at: say("or darkvision") }] },
        { kind: "popup", from: say("Past it"), to: say("There's no player", -0.2), icon: "🚫", title: "PAST IT, NOTHING", lines: ["Even down an open corridor"], lineAt: [say("even down")], pos: { x: 1300, y: 300 }, width: 480 },
        { kind: "sticker", from: say("There's no player"), to: say("Nicely.", 1.2, true), text: "ASK YOUR DM. NICELY.", pos: { x: 1300, y: 420 }, tone: "gold", tilt: -3 },
      ],
    },
    {
      title: "Places you have been",
      beats: [
        { kind: "sticker", from: say("stays dimly lit"), to: say("It's only a memory", -0.2), text: "SEEN BEFORE = DIMLY LIT", pos: { x: 960, y: 220 }, tone: "blue", tilt: -2 },
        { kind: "popup", from: say("It's only a memory"), to: say("Dim means remembered", -0.2), icon: "🗺️", title: "ONLY A MEMORY", lines: ["Of the ground", "What walked in since stays hidden"], lineAt: [say("memory of the ground"), say("Anything that walked in")], pos: { x: 1300, y: 300 }, width: 520 },
        { kind: "sticker", from: say("Dim means remembered"), to: say("The memory lives", -0.2), text: "DIM = REMEMBERED, NOT SAFE", pos: { x: 960, y: 220 }, tone: "gold", tilt: 2 },
        { kind: "sticker", from: say("The memory lives"), to: say("this map.", 1.4, true), text: "KEPT IN YOUR BROWSER", pos: { x: 960, y: 220 }, tone: "blue", tilt: -2 },
      ],
    },
    {
      title: "Doors",
      zooms: [
        { from: say("Click a door", -0.3), to: say("A small gold square", -0.6), target: t("door"), scale: 1.6 },
        { from: say("A small gold square", -0.4), to: say("When your DM turns", -0.2), target: t("locked door"), scale: 2.0 },
      ],
      beats: [
        { kind: "sticker", from: say("Everyone hears it"), to: say("A small gold square", -0.3), text: "🔊 EVERYONE HEARS IT", pos: { x: 1300, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("A small gold square"), to: say("Secret doors exist", -0.2), icon: "🔒", tone: "gold", title: "LOCKED", lines: ["A small gold square", "Only the DM can open it"], lineAt: [say("A small gold square"), say("Only the DM can open")], target: t("locked door"), side: "right", width: 480 },
        { kind: "popup", from: say("Secret doors exist"), to: say("When your DM turns", -0.2), icon: "🤫", title: "SECRET DOOR", lines: ["Until it's revealed: a wall"], target: t("secret door"), side: "right", width: 480 },
        { kind: "popup", from: say("When your DM turns"), to: say("what you can see.", 1.4, true), icon: "🕯️", title: "DARKER LIGHT", lines: ["Torches and braziers glow", "Only the look: not what you see"], lineAt: [say("torches and braziers"), say("That's only the look")], pos: { x: 1300, y: 300 }, width: 560 },
      ],
    },
    {
      title: "The world map",
      zooms: [{ from: say("You are here", -0.3), to: say("Door and stair", -0.2), target: t("you are here"), scale: 1.8 }],
      beats: [
        { kind: "ring", from: say("World opens", -0.1), to: mark("WORLD", 0.7), target: t("WORLD") },
        { kind: "sticker", from: say("every place your party"), to: say("You are here", -0.2), text: "EVERY PLACE YOUR PARTY HAS FOUND", pos: { x: 960, y: 220 }, tone: "gold", tilt: -2 },
        { kind: "popup", from: say("Door and stair"), to: say("travels together.", 1.4, true), icon: "🚪", title: "DOORS AND STAIRS", lines: ["Lead somewhere else", "The DM opens them; the table travels together"], lineAt: [say("Door and stair"), say("Your DM opens them")], pos: { x: 960, y: 420 }, width: 620 },
      ],
    },
  ],
};
