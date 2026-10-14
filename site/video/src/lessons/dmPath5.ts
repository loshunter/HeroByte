import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath5: LessonScript = {
  slug: "dm-path-5-walls-doors-and-fog",
  title: "WALLS, DOORS AND FOG",
  subtitle: "DM path 5: good walls make good secrets",
  captionFixes: { "Pinwall's": "Pin walls", "site": "sight" },
  outro: {
    headline: "THE DUNGEON KEEPS ITS SECRETS!",
    next: "Next: DM path 6, NPCs and the token library. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Walls",
      zooms: [{ from: say("Drag from point", -0.3), to: say("Players never see", -0.2), target: t("wall"), scale: 1.5 }],
      beats: [
        { kind: "title", from: 0.2, to: say("Wall draws one", -0.2), text: "GOOD WALLS", sub: "make good secrets", y: 420, sfx: "ping.wav" },
        { kind: "ring", from: say("Wall draws one", -0.1), to: mark("Wall", 0.7), target: t("Wall") },
        { kind: "popup", from: say("Players never see a wall"), to: say("While you edit", -0.2), icon: "🧱", title: "PLAYERS NEVER SEE IT", lines: ["It only stops movement and sight"], lineAt: [say("It only stops")], pos: { x: 1250, y: 300 }, width: 520 },
        { kind: "sticker", from: say("While you edit"), to: say("keeps it after", -0.2), text: "SEE-THROUGH WHILE YOU EDIT", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("keeps it after", -0.6), to: say("you leave.", 1.4, true), target: t("Pin walls overlay") },
      ],
    },
    {
      title: "Doors",
      split: { from: say("At the table", -0.2), labels: ["DM", "THE PLAYER'S SCREEN"] },
      zooms: [{ from: say("leave a gap", -0.3), to: say("Doors start closed", -0.2), target: t("door"), scale: 1.5 }],
      beats: [
        { kind: "chips", to: say("The drag sets", -0.2), pos: { x: 1100, y: 860 }, sep: "›", items: [{ text: "LEAVE A GAP", at: say("leave a gap") }, { text: "🚪 DOOR", at: say("then drag the door") }, { text: "DRAG ACROSS IT", at: say("across the gap") }] },
        { kind: "sticker", from: say("The drag sets"), to: say("Doors start closed", -0.2), text: "THE DRAG SETS LENGTH AND ANGLE", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "sticker", from: say("Doors start closed"), to: say("At the table", -0.3), text: "DOORS START CLOSED", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("anyone can click"), to: say("open or close it.", 1.4, true), icon: "🚪", title: "ANYONE CAN CLICK A DOOR", lines: ["Open or close"], pos: { x: 1440, y: 260 }, width: 480 },
      ],
    },
    {
      title: "Locked and secret",
      split: { from: say("small gold square", -0.6), labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "chips", to: say("Closed, Open", -0.2), pos: { x: 1100, y: 860 }, sep: "›", items: [{ text: "👆 SELECT", at: say("pick it with Select") }, { text: "🔍 INSPECT", at: say("Inspect") }, { text: "STATE", at: say("Choose its state") }, { text: "SAVE CHANGES", at: say("Save changes") }] },
        { kind: "ring", from: say("Save changes", -0.1), to: mark("Save changes", 0.7), target: t("Save changes") },
        {
          kind: "chips",
          to: say("small gold square", -0.7),
          pos: { x: 1100, y: 860 },
          items: [
            { text: "CLOSED", at: say("Closed,") },
            { text: "OPEN", at: { say: "Open,", nth: 2, off: 0, end: false } }, // the 1st "Open" is "Open Inspect"
            { text: "🔒 LOCKED", at: say("Locked,") },
            { text: "SECRET", at: say("Secret.") },
          ],
        },
        { kind: "popup", from: say("small gold square"), to: say("A secret door", -0.2), icon: "🔒", title: "LOCKED", lines: ["A small gold square", "A click says it's locked", "You can still open it"], lineAt: [say("small gold square"), say("a click tells them"), say("You can still open it")], pos: { x: 1440, y: 610 }, width: 480 },
        { kind: "popup", from: say("A secret door"), to: say("At the table", -0.2), icon: "🤫", title: "SECRET", lines: ["Invisible to players", "You see a dashed seam"], lineAt: [say("A secret door"), say("dashed seam")], pos: { x: 480, y: 260 }, width: 480 },
        { kind: "key", from: say("At the table", 0.4), to: say("reveal it.", 1.4, true), label: "ALT + CLICK", pos: { x: 480, y: 300 }, sfx: "button-blip.wav" },
        { kind: "sticker", from: say("reveal it", -0.2), to: say("reveal it.", 1.4, true), text: "REVEALED!", pos: { x: 1440, y: 300 }, tone: "green", tilt: -2 },
      ],
    },
    {
      title: "Turn on fog",
      split: { from: say("Players then see", -0.3), labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "chips", to: say("It needs a built map", -0.2), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "DM MENU", at: say("in the DM menu") }, { text: "MAPS", at: say("under Maps") }, { text: "🌫 FOG OF WAR", at: say("under Maps", 0.6) }] },
        { kind: "popup", from: say("It needs a built map"), to: say("Players then see", -0.3), icon: "🏗️", title: "FOG NEEDS A BUILT MAP", lines: ["With walls and doors"], pos: { x: 600, y: 300 }, width: 520 },
        { kind: "ring", from: say("Players then see", -0.4), to: mark("FOG", 0.8), target: t("FOG") },
        { kind: "sticker", from: say("Players then see"), to: say("You still see", -0.2), text: "ONLY WHAT THEIR TOKENS SEE", pos: { x: 1440, y: 260 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("You still see"), to: say("Tokens, monsters", -0.2), text: "YOU SEE EVERYTHING", pos: { x: 480, y: 260 }, tone: "gold", tilt: -2 },
        { kind: "popup", from: say("Tokens, monsters"), to: say("darkens it.", 1.4, true), icon: "📡", title: "WHAT FOG KEEPS BACK", lines: ["Tokens, monsters, props: never sent", "The map is sent. Fog darkens it"], lineAt: [say("Tokens, monsters"), say("The map itself")], pos: { x: 1440, y: 300 }, width: 500 },
      ],
    },
    {
      title: "Make it dark",
      split: { from: say("Set 30 feet", -0.3), labels: ["DM", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "ring", from: say("Table Sight Default", -0.1), to: say("Set 30 feet", -0.3), target: t("Table Sight Default") },
        { kind: "ring", from: say("Set 30 feet", -0.1), to: mark("30 ft", 0.8), target: t("30 ft") },
        { kind: "sticker", from: say("a corridor becomes"), to: say("A single token", -0.2), text: "A CORRIDOR TO WALK DOWN", pos: { x: 1440, y: 260 }, tone: "blue", tilt: 2 },
        { kind: "chips", to: say("30, 60 or 120", -0.3), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "THE TOKEN'S ROW", at: say("A single token") }, { text: "⚙ TOKEN SETTINGS", at: say("token settings") }] },
        {
          kind: "chips",
          to: say("A token you set", -0.2),
          pos: { x: 600, y: 860 },
          items: [
            { text: "30", at: say("30, 60") },
            { text: "60", at: say("60 or") },
            { text: "120 FT", at: say("120 feet") },
            { text: "BLIND", at: say("blind") },
            { text: "ANY NUMBER", at: say("any number") },
          ],
        },
        { kind: "ring", from: say("120 feet", -0.1), to: mark("120 ft", 0.8), target: t("120 ft") },
        { kind: "popup", from: say("A token you set"), to: say("table default.", 1.4, true), icon: "👁", title: "THE TOKEN'S OWN RADIUS WINS", lines: ["Over the table default"], pos: { x: 600, y: 300 }, width: 520 },
      ],
    },
    {
      title: "Check it",
      split: { from: 0, labels: ["YOUR PLAYER VIEW", "THE PLAYER'S SCREEN"] },
      beats: [
        { kind: "ring", from: say("Player view shows", -0.1), to: mark("Player View", 0.8), target: t("Player View") },
        {
          kind: "chips",
          to: say("Use it while", -0.2),
          pos: { x: 960, y: 860 },
          items: [
            { text: "🌫 FOG", at: say("Fog,") },
            { text: "HIDDEN DOORS", at: say("hidden doors") },
            { text: "NO DM OVERLAYS", at: say("no DM overlays") },
          ],
        },
        { kind: "title", from: say("It's the difference"), to: say("and it is.", 1.4, true), text: "\"I THINK IT'S HIDDEN\" vs IT IS", y: 300 },
      ],
    },
  ],
};
