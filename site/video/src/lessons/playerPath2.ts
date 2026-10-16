import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath2: LessonScript = {
  slug: "player-path-2-the-table-at-a-glance",
  title: "THE TABLE AT A GLANCE",
  subtitle: "Player path 2",
  captionFixes: { roles: "Rolls", Herobyte: "HeroByte" },
  outro: {
    headline: "YOU KNOW YOUR WAY AROUND!",
    next: "Next: Player path 3, Your character card. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Toolbar, map, Party",
      zooms: [
        { from: say("two groups", -0.2), to: say("Hover any button", -0.2), target: t("Play tools"), scale: 1.4 },
        { from: say("Tools take turns", -0.2), to: say("The map is shared", -0.3), target: t("Draw"), scale: 1.6 },
        { from: say("The party at the bottom"), to: say("also holds World", 1.6), target: t("Party"), scale: 1.4 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("Along the top", -0.3), text: "A QUICK TOUR", sub: "before anything tries to eat you", y: 420 },
        {
          kind: "chips",
          to: say("Hover any button", -0.2),
          pos: { x: 960, y: 300 },
          sep: "+",
          items: [
            { text: "PLAY TOOLS", at: say("play tools") },
            { text: "PANELS & SETTINGS", at: say("panels and settings") },
          ],
        },
        { kind: "sticker", from: say("Hover any button"), to: say("Tools take turns", -0.2), text: "HOVER = TOOLTIP", pos: { x: 960, y: 300 }, tone: "blue", tilt: -2 },
        { kind: "popup", from: say("Tools take turns"), to: say("The map is shared", -0.3), icon: "🔀", title: "ONE TOOL AT A TIME", lines: ["Picking one turns the last off", "Move (or click it again) = off"], lineAt: [say("Picking one"), say("Press move")], target: t("Measure"), side: "below", width: 560 },
        { kind: "sticker", from: say("The map is shared"), to: say("What you see", -0.2), text: "WHAT YOU CHANGE, EVERYONE SEES", pos: { x: 960, y: 420 }, tone: "gold", tilt: 2 },
        { kind: "sticker", from: say("What you see"), to: say("The party at the bottom", -0.2), text: "YOUR FOG IS YOURS", pos: { x: 960, y: 520 }, tone: "blue", tilt: -2 },
        {
          kind: "chips",
          to: say("Cards shows", -0.2),
          pos: { x: 960, y: 400 },
          items: [
            { text: "THE PARTY", at: say("The party, the") },
            { text: "THE DM'S", at: say("the DMs") },
            { text: "NPCS YOU CAN SEE", at: say("any NPCs") },
          ],
        },
        { kind: "ring", from: say("Cards shows", -0.1), to: mark("Cards", 0.7), target: t("Cards") },
        { kind: "ring", from: say("Hide party folds", -0.1), to: mark("Hide party", 0.7), target: t("Hide party") },
        { kind: "ring", from: say("also holds World"), to: say("also holds World", 2.2), target: t("WORLD") },
      ],
    },
    {
      title: "The Table menu",
      zooms: [
        { from: 0, to: say("It opens a menu", -0.2), target: t("Table button"), scale: 2.0 },
        { from: say("Your role is here", -0.3), to: say("Preferences are", -0.2), target: t("Your role"), scale: 1.6 },
        { from: say("Preferences are"), to: say("volume.", 1.2, true), target: t("Preferences"), scale: 1.4 },
      ],
      beats: [
        { kind: "ring", from: say("Top left is"), to: say("It opens a menu", -0.2), target: t("Table button") },
        { kind: "chips", to: say("It opens a menu", -0.2), pos: { x: 960, y: 300 }, items: [{ text: "🟢 ONLINE", at: say("Green online") }, { text: "🔴 OFFLINE", at: say("red offline") }] },
        { kind: "sticker", from: say("Preferences are"), to: say("CRT add", -0.2), text: "YOURS ALONE", pos: { x: 1200, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("CRT add"), to: say("Sound and motion", -0.2), icon: "📺", title: "CRT", lines: ["Scanlines and a monitor frame", "Only you see it"], target: t("CRT"), side: "right", width: 520 },
        { kind: "popup", from: say("Sound and motion"), to: say("volume.", 1.2, true), icon: "🔊", title: "SOUND & MOTION", lines: ["Animation · sound effects · volume"], target: t("Sound & motion"), side: "right", width: 540 },
      ],
    },
    {
      title: "Moving around the map",
      zooms: [{ from: say("Reset puts the view", -0.2), to: say("To find your token", -0.2), target: t("Reset"), scale: 1.5 }],
      beats: [
        { kind: "sticker", from: say("Drag empty map space"), to: say("Middle mouse", -0.2), text: "DRAG EMPTY SPACE = PAN", pos: { x: 960, y: 300 }, tone: "blue", tilt: -2 },
        { kind: "sticker", from: say("Middle mouse"), to: say("The wheel zooms", -0.2), text: "MIDDLE-DRAG PANS WITH ANY TOOL", pos: { x: 960, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "sticker", from: say("The wheel zooms"), to: say("Reset puts the view", -0.2), text: "🖱️ WHEEL = ZOOM TO THE CURSOR", pos: { x: 960, y: 300 }, tone: "blue", tilt: -2 },
        { kind: "popup", from: say("Reset puts the view"), to: say("To find your token", -0.2), icon: "🧭", title: "RESET", lines: ["Top-left corner, normal zoom", "Not the middle. Not your token."], lineAt: [say("top left corner"), say("It's not the middle")], target: t("Reset"), side: "below", width: 560 },
        { kind: "ring", from: say("press the target", -0.1), to: say("on your row.", 1.6, true), target: t("🎯") },
        { kind: "sticker", from: say("press the target"), to: say("on your row.", 1.6, true), text: "🎯 = YOUR TOKEN", pos: { x: 960, y: 300 }, tone: "green", tilt: 2 },
      ],
    },
    {
      title: "Chat and whispers",
      zooms: [{ from: say("Choose everyone", -0.2), to: say("Being the DM", -0.2), target: t("Send to"), scale: 1.4 }],
      beats: [
        { kind: "ring", from: say("Open chat and", -0.1), to: mark("Chat & Rolls", 0.7), target: t("Chat & Rolls") },
        {
          kind: "chips",
          to: say("Press send", -0.2),
          pos: { x: 700, y: 300 },
          sep: "or",
          items: [
            { text: "EVERYONE = TABLE TALK", at: say("Choose everyone") },
            { text: "WHISPER = PRIVATE", at: say("whisper to someone") },
          ],
        },
        { kind: "popup", from: say("Being the DM"), to: say("But a seat left empty", -0.2), icon: "🤫", title: "WHISPERS STAY PRIVATE", lines: ["Not even the DM reads them"], pos: { x: 700, y: 420 }, width: 520 },
        { kind: "popup", from: say("But a seat left empty"), to: say("stored for it.", 1.4, true), icon: "🪑", title: "AN EMPTY SEAT", lines: ["Empty over six hours, or a restart", "Anyone with the password can take it"], lineAt: [say("But a seat left empty"), say("can be taken")], pos: { x: 700, y: 420 }, width: 560 },
      ],
    },
    {
      title: "Voice",
      zooms: [{ from: say("Press Join Voice", -0.3), to: say("Leave Voice hangs up", 1.4), target: t("voice controls"), scale: 1.8 }],
      beats: [
        { kind: "ring", from: say("Press Join Voice", -0.1), to: mark("Join voice", 0.8), target: t("Join voice") },
        { kind: "sticker", from: say("Allow the microphone"), to: say("Before you join", -0.2), text: "🎤 ALLOW THE MIC", pos: { x: 960, y: 420 }, tone: "blue", tilt: -2 },
        { kind: "popup", from: say("Before you join"), to: say("Mute keeps you", -0.2), icon: "👥", title: "IN CALL", lines: ["See it before you join"], target: t("count"), side: "below", width: 460 },
        { kind: "popup", from: say("Mute keeps you"), to: say("Leave Voice hangs up", -0.2), icon: "🔇", title: "MUTE", lines: ["Still in the call", "You still hear everyone"], lineAt: [say("Mute keeps you"), say("You still hear")], target: t("Mute"), side: "below", width: 480 },
        { kind: "ring", from: say("Leave Voice hangs up", -0.1), to: say("Leave Voice hangs up", 1.4), target: t("Leave voice") },
        { kind: "sticker", from: say("When someone talks"), to: say("Wear headphones", -0.2), text: "THEIR CARD GLOWS IN THEIR COLOUR", pos: { x: 960, y: 300 }, tone: "gold", tilt: 2 },
        { kind: "sticker", from: say("Wear headphones"), to: say("stops echo.", 1.4, true), text: "🎧 HEADPHONES = NO ECHO", pos: { x: 960, y: 420 }, tone: "blue", tilt: -2 },
      ],
    },
    {
      title: "On a phone",
      phone: { from: 0, label: "PHONE" },
      beats: [
        { kind: "chips", to: say("Party and chat open", -0.2), pos: { x: 560, y: 880 }, items: [{ text: "PARTY", at: say("Party, tools") }, { text: "TOOLS", at: say("tools, dice") }, { text: "DICE", at: say("dice, chat") }, { text: "CHAT", at: say("chat, and") }, { text: "RESET", at: say("and reset") }] },
        { kind: "ring", from: say("open full screen", -0.3), to: mark("PARTY", 0.8, "phone"), target: t("PARTY", "phone") },
        { kind: "popup", from: say("Close them with"), to: say("Voice is at the top", -0.2), icon: "✕", title: "CLOSE", lines: ["The ✕, or drag the title bar down"], pos: { x: 560, y: 420 }, width: 520 },
        { kind: "ring", from: say("Voice is at the top"), to: say("of party.", 1.6, true), target: t("voice row", "phone") },
      ],
    },
  ],
};
