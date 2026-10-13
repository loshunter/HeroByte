import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath6: LessonScript = {
  slug: "dm-path-6-npcs-and-the-token-library",
  title: "NPCS AND THE TOKEN LIBRARY",
  subtitle: "DM path 6: fill your world",
  outro: {
    headline: "YOUR WORLD HAS INHABITANTS!",
    next: "Next: DM path 7, Run your first combat. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Add an NPC",
      zooms: [{ from: say("has a name", -0.3), to: say("Players can't", -0.2), target: t("Name"), scale: 1.6 }],
      beats: [
        { kind: "title", from: 0.2, to: say("Open the DM menu", -0.2), text: "A WORLD NEEDS INHABITANTS", y: 420, sfx: "ping.wav" },
        { kind: "chips", to: say("has a name", -0.3), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "DM MENU", at: say("Open the DM menu") }, { text: "NPCS & MONSTERS", at: say("then NPCs") }, { text: "+ ADD NPC", at: say("Press Add NPC") }] },
        {
          kind: "chips",
          to: say("Players can't", -0.2),
          pos: { x: 600, y: 860 },
          items: [
            { text: "NAME", at: say("has a name") },
            { text: "HP", at: say("HP,") },
            { text: "TEMP HP", at: say("Temp HP") },
            { text: "INIT MOD", at: say("an initiative modifier") },
            { text: "PORTRAIT", at: say("a portrait") },
            { text: "TOKEN ART", at: say("token art") },
          ],
        },
        { kind: "popup", from: say("Players can't"), to: say("move your NPCs.", 1.4, true), icon: "🛡️", title: "YOUR NPCS ARE YOURS", lines: ["Players can't rename,", "damage or move them"], pos: { x: 600, y: 300 }, width: 520 },
      ],
    },
    {
      title: "Place it and find it",
      beats: [
        { kind: "ring", from: say("Place on Map drops", -0.1), to: mark("Place on Map", 0.8), target: t("Place on Map") },
        { kind: "popup", from: say("top left corner"), to: say("It hasn't vanished", -0.2), icon: "📍", title: "THE MAP'S TOP-LEFT CORNER", lines: ["Not the middle of your view"], lineAt: [say("Not the middle")], pos: { x: 600, y: 300 }, width: 540 },
        { kind: "sticker", from: say("It hasn't vanished"), to: say("Press Focus", -0.2), text: "IT'S SULKING IN THE CORNER", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("Press Focus", -0.1), to: mark("Focus", 0.8), target: t("Focus") },
        { kind: "sticker", from: say("Pressing Place again"), to: say("second one.", 1.4, true), text: "PLACE AGAIN = BACK TO THE CORNER, NOT A SECOND TOKEN", pos: { x: 600, y: 260 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "A pack at once",
      beats: [
        { kind: "ring", from: say("Set the number field", -0.1), to: say("the button says", -0.1), target: t("how many") },
        { kind: "ring", from: say("the button says", -0.1), to: say("5 arrive", 0.5), target: t("Add 5 NPCs") },
        { kind: "title", from: say("5 arrive"), to: say("A second batch", -0.2), text: "FIVE, NUMBERED!", y: 300 },
        { kind: "sticker", from: say("A second batch"), to: say("Duplicate copies", -0.2), text: "THE NEXT BATCH CARRIES ON THE NUMBERING", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("Duplicate copies", -0.1), to: mark("Duplicate", 0.8), target: t("Duplicate") },
        {
          kind: "chips",
          to: say("next free number.", 1.4, true),
          pos: { x: 600, y: 860 },
          items: [
            { text: "HP", at: say("HP,", 0) },
            { text: "ART", at: say("Art,") },
            { text: "SIZE", at: say("Size,") },
            { text: "STANCE", at: say("Stance.") },
            { text: "NEXT FREE NUMBER", at: say("next free number") },
          ],
        },
      ],
    },
    {
      title: "The library",
      zooms: [{ from: say("Search matches", -0.3), to: say("Click a token", 0.6), target: t("Search"), scale: 1.6 }],
      beats: [
        { kind: "ring", from: say("Library opens", -0.1), to: mark("Library", 0.8), target: t("Library") },
        { kind: "title", from: say("244 tokens"), to: say("Monsters and townsfolk", 0.8), text: "244 TOKENS", y: 300 },
        { kind: "chips", to: say("Search matches", -0.2), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "MONSTERS", at: say("narrow it") }, { text: "FAMILY: GOBLINS", at: say("then family") }] },
        { kind: "sticker", from: say("Search matches"), to: say("Click a token", -0.2), text: "SEARCH MATCHES EVERY WORD", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "popup", from: say("arrives as a new"), to: say("It isn't on the map", -0.2), icon: "🎨", title: "A NEW NPC", lines: ["Name, art and portrait filled in", "At the right size"], lineAt: [say("With its name"), say("at the right size")], pos: { x: 600, y: 300 }, width: 540 },
        { kind: "ring", from: say("Press Place on Map", -0.1), to: mark("Place on Map", 0.8), target: t("Place on Map") },
        { kind: "ring", from: say("The number field", -0.1), to: say("here too.", 1.4, true), target: t("number field") },
      ],
    },
    {
      title: "Hide, stance and mimics",
      split: { from: say("The eye hides it", -0.3), labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "ring", from: say("The eye hides it", -0.2), to: mark("eye", 0.8), target: t("eye") },
        { kind: "sticker", from: say("Prep an ambush"), to: say("Stance as enemy", -0.2), text: "AMBUSH: HIDE NOW, REVEAL ON THE POUNCE", pos: { x: 1440, y: 260 }, tone: "gold", tilt: -2 },
        {
          kind: "chips",
          to: say("Mimics come in pairs", -0.2),
          pos: { x: 480, y: 860 },
          items: [
            { text: "ENEMY", at: say("enemy,") },
            { text: "NEUTRAL", at: say("neutral") },
            { text: "ALLY", at: say("or ally") },
          ],
        },
        { kind: "sticker", from: say("sets the card's"), to: say("Mimics come in pairs", -0.2), text: "THE CARD'S COLOUR. PLAYERS SEE IT", pos: { x: 480, y: 260 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("Mimics come in pairs"), to: say("reveal mimic.", 1.4, true), icon: "🎭", title: "MIMICS COME IN PAIRS", lines: ["Place the closed chest", "They touch it: Reveal mimic"], lineAt: [say("Place the closed chest"), say("press reveal mimic")], pos: { x: 480, y: 260 }, width: 500 },
        { kind: "ring", from: say("press reveal mimic", -0.1), to: mark("Reveal mimic", 0.8), target: t("Reveal mimic") },
      ],
    },
    {
      title: "Your own tokens",
      beats: [
        { kind: "ring", from: say("This Table shelf", -0.1), to: mark("This table", 0.8), target: t("This table") },
        {
          kind: "chips",
          to: say("Players never receive", -0.2),
          pos: { x: 600, y: 860 },
          items: [
            { text: "IMAGE", at: say("Add your own") },
            { text: "NAME", at: say("Give it a name") },
            { text: "TAGS", at: say("tags") },
            { text: "STANCE", at: say("a stance") },
          ],
        },
        { kind: "ring", from: say("it searches like", -0.1), to: mark("Add to library", 0.8), target: t("Add to library") },
        { kind: "sticker", from: say("Players never receive"), to: say("the shelf.", 1.4, true), text: "🔒 PLAYERS NEVER GET THE SHELF", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
  ],
};
