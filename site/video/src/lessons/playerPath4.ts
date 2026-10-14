import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
// Cues follow Whisper's words for the take ("role" for "roll" in places): captionFixes mend the captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "player") => ({ mark: m, off, who });
const t = (m: string, who = "player", nth = 1) => ({ mark: m, who, nth });

export const playerPath4: LessonScript = {
  slug: "player-path-4-roll-dice",
  title: "ROLL DICE",
  subtitle: "Player path 4",
  captionFixes: { role: "roll", "role,": "roll,", "roles.": "rolls.", "roles": "rolls" },
  outro: {
    headline: "MAY YOUR D20S BE KIND!",
    next: "Next: Player path 5, Draw, measure and ping. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "Build and roll",
      zooms: [
        { from: say("Click dice to add", -0.2), to: say("Add a plus one", -0.2), target: t("tray"), scale: 1.6 },
        { from: say("Add a plus one"), to: say("Press roll", -0.2), target: t("modifier chip"), scale: 1.7 },
        { from: mark("rolled", -0.4), to: say("fumble.", 1.2, true), target: t("log entry"), scale: 1.3 },
      ],
      beats: [
        { kind: "title", from: 0.2, to: say("Press dice for", -0.3), text: "ROLL THE DICE!", sub: "Sooner or later, everything comes down to them", y: 420 },
        { kind: "ring", from: say("Press dice for", -0.1), to: mark("Dice", 0.7), target: t("Dice") },
        { kind: "ring", from: say("Chat and rolls holds", -0.1), to: mark("Chat & Rolls", 0.7), target: t("Chat & Rolls") },
        { kind: "popup", from: say("Click dice to add"), to: say("Click again", -0.2), icon: "🎲", title: "ADD DICE", lines: ["Into the tray", "Nothing rolls yet"], lineAt: [say("to the tray"), say("Nothing rolls yet")], target: t("tray"), side: "right", width: 480 },
        { kind: "sticker", from: say("Click again"), to: say("Click the count badge", -0.2), text: "AGAIN = ONE MORE", pos: { x: 1300, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "popup", from: say("Click the count badge"), to: say("Add a plus one", -0.2), icon: "🔢", title: "EXACT COUNT", lines: ["Click the badge, type"], target: t("count badge"), side: "right", width: 460 },
        { kind: "popup", from: say("Click a chip"), to: say("Press roll", -0.2), icon: "➕", title: "MODIFIER", lines: ["+1 or −1 chip", "Click it to type any value"], target: t("modifier chip"), side: "right", width: 520 },
        { kind: "ring", from: say("Press roll", -0.1), to: mark("ROLL!", 0.8), target: t("ROLL!") },
        { kind: "sfx", at: mark("ROLL!", 0.1), src: "dice-rattle.wav", volume: 0.4 },
        { kind: "sfx", at: mark("ROLL!", 1.1), src: "dice-land.wav", volume: 0.4 },
        { kind: "sticker", from: say("natural 20"), to: say("A natural one", -0.1), text: "★ CRITICAL!", pos: { x: 1300, y: 300 }, tone: "gold", tilt: -4 },
        { kind: "sticker", from: say("A natural one"), to: say("fumble.", 1.2, true), text: "✖ FUMBLE!", pos: { x: 1300, y: 420 }, tone: "blue", tilt: 4 },
      ],
    },
    {
      title: "Advantage and who sees it",
      zooms: [
        { from: mark("ROLL!", 0.6), to: say("Table means everyone", -0.4), target: t("ROLL!"), scale: 1.2 },
        { from: say("Table means everyone", -0.2), to: say("A natural 20", -0.2), target: t("who line"), scale: 1.8 },
      ],
      beats: [
        {
          kind: "chips",
          to: say("The other die stays", -0.2),
          pos: { x: 1300, y: 240 },
          items: [
            { text: "ADV = KEEP THE HIGHER", at: say("keeps the higher") },
            { text: "DIS = KEEP THE LOWER", at: say("Disadvantage keeps") },
          ],
        },
        { kind: "sticker", from: say("struck through"), to: say("Table means everyone", -0.3), text: "THE OTHER DIE: STRUCK THROUGH", pos: { x: 1300, y: 300 }, tone: "gold", tilt: 2 },
        {
          kind: "chips",
          to: say("The line under", -0.2),
          pos: { x: 1300, y: 860 },
          tone: "blue",
          items: [
            { text: "TABLE = EVERYONE", at: say("Table means everyone") },
            { text: "DM = YOU + THE DM", at: say("DM means") },
            { text: "ME = ONLY YOU", at: say("Me means") },
          ],
        },
        { kind: "ring", from: say("The line under"), to: say("A natural 20", -0.2), target: t("who line") },
        { kind: "sticker", from: say("A natural 20"), to: say("hidden", -0.2), text: "A VERY LONELY NATURAL 20", pos: { x: 1300, y: 300 }, tone: "blue", tilt: -3 },
        { kind: "popup", from: say("hidden"), to: say("kept for your seat", -0.3), icon: "🙈", title: "HIDDEN ROLLS", lines: ["Never sent to anyone else", "Their browser has no copy"], lineAt: [say("never sent"), say("Their browser")], pos: { x: 1300, y: 420 }, width: 520 },
        { kind: "popup", from: say("kept for your seat"), to: say("rolls and all.", 1.2, true), icon: "🪑", title: "KEPT FOR YOUR SEAT", lines: ["Empty over six hours, or a restart", "Anyone with the password can take it"], lineAt: [say("kept for your seat"), say("can be taken")], pos: { x: 1300, y: 420 }, width: 560 },
      ],
    },
    {
      title: "Quick rolls and macros",
      zooms: [
        { from: 0, to: say("Build any", -0.2), target: t("Roll now"), scale: 1.7 },
        { from: say("press save", -0.3), to: say("another device.", 1.2, true), target: t("Longsword"), scale: 1.7 },
      ],
      beats: [
        { kind: "popup", from: say("now row"), to: say("Build any", -0.2), icon: "⚡", title: "ROLL NOW", lines: ["d20 · ADV · DIS · 2d6", "Rolls straight away"], lineAt: [say("D20"), say("rolls straight away")], target: t("Roll now"), side: "right", width: 480 },
        { kind: "ring", from: say("press save", -0.1), to: mark("+ SAVE", 0.8), target: t("+ SAVE") },
        { kind: "popup", from: say("name it"), to: say("live in this browser", -0.2), icon: "💾", title: "SAVED ROLL", lines: ["Name it, keep it"], target: t("Longsword"), side: "right", width: 440 },
        { kind: "sticker", from: say("live in this browser"), to: say("another device.", 1.2, true), text: "THIS BROWSER ONLY", pos: { x: 1300, y: 300 }, tone: "gold", tilt: 2 },
      ],
    },
    {
      title: "Rolling real dice",
      zooms: [
        { from: say("Press I rolled it", -0.3), to: say("Already rolled", -0.2), target: t("I ROLLED IT"), scale: 1.6 },
        { from: say("Press that's not", -0.4), to: say("Either way", -0.2), target: t("NOT WHAT I ROLLED"), scale: 1.5 },
        { from: say("Either way"), to: say("hand entry off.", 1.2, true), target: t("BY HAND"), scale: 1.9 },
      ],
      beats: [
        { kind: "popup", from: say("Rolling physical dice"), to: say("The tray can be empty", 1.2), icon: "✋", title: "I ROLLED IT", lines: ["Type the total", "The tray can be empty"], lineAt: [say("type the total"), say("The tray can be empty")], target: t("I ROLLED IT"), side: "right", width: 480 },
        { kind: "popup", from: say("Press that's not"), to: say("Either way", -0.2), icon: "🔁", title: "THAT'S NOT WHAT I ROLLED", lines: ["Correct the app's roll"], target: t("NOT WHAT I ROLLED"), side: "right", width: 560 },
        { kind: "ring", from: say("Either way"), to: say("When you correct", -0.2), target: t("BY HAND") },
        { kind: "sticker", from: say("When you correct"), to: say("Your DM can", -0.2), text: "THE APP'S NUMBER STAYS, STRUCK THROUGH", pos: { x: 1250, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "sticker", from: say("Your DM can"), to: say("hand entry off.", 1.2, true), text: "YOUR DM CAN TURN IT OFF", pos: { x: 1250, y: 420 }, tone: "blue", tilt: 2 },
      ],
    },
    {
      title: "Initiative",
      zooms: [
        { from: say("INIT on your card", -0.4), to: say("Set your modifier", -0.3), target: t("INIT"), scale: 1.6 },
        { from: say("Set your modifier", -0.2), to: say("The server rolls", -0.2), target: t("+ modifier"), scale: 1.5 },
        { from: say("If no fight"), to: say("Prev and next", -0.2), target: t("combat starts"), scale: 1.6 },
        { from: say("your card says", -0.2), to: say("your turn.", 1.4, true), target: t("YOUR TURN"), scale: 1.8 },
      ],
      beats: [
        { kind: "ring", from: say("INIT on your card", -0.1), to: mark("INIT", 0.8), target: t("INIT") },
        { kind: "popup", from: say("short for Initiative"), to: say("Set your modifier", -0.2), icon: "⚔️", title: "INIT = INITIATIVE", lines: ["Your place in the coming battle"], lineAt: [say("your place")], target: t("INIT"), side: "left", width: 540 },
        { kind: "ring", from: say("press Roll D20 now", -0.1), to: mark("ROLL D20 NOW", 0.8), target: t("ROLL D20 NOW") },
        { kind: "popup", from: say("The server rolls"), to: say("Or press Enter", -0.2), icon: "📜", title: "ROLLED BY THE SERVER", lines: ["In the log, with your name"], pos: { x: 1250, y: 300 }, width: 500 },
        { kind: "sticker", from: say("Or press Enter"), to: say("If no fight", -0.2), text: "OR ENTER YOUR REAL D20", pos: { x: 1250, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("If no fight"), to: say("Prev and next", -0.2), text: "⚔️ COMBAT STARTS FOR THE WHOLE TABLE", pos: { x: 1100, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "chips", to: say("your card says", -0.2), pos: { x: 1250, y: 860 }, items: [{ text: "◄ PREV = BACK ONE", at: say("Prev means") }, { text: "NEXT ►", at: say("Prev and next") }] },
        { kind: "ring", from: say("your card says"), to: say("your turn.", 1.4, true), target: t("YOUR TURN") },
      ],
    },
    {
      title: "On a phone",
      phone: { from: 0, label: "PHONE" },
      beats: [
        { kind: "ring", from: say("Dice opens", -0.1), to: mark("DICE", 0.7, "phone"), target: t("DICE", "phone") },
        { kind: "sticker", from: say("full screen roller"), to: say("Tap outside", -0.2), text: "A FULL-SCREEN ROLLER", pos: { x: 560, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "popup", from: say("Tap outside"), to: say("Initiative is", -0.2), icon: "👆", title: "CLOSE THE RESULT", lines: ["Tap outside it, or its ✕"], pos: { x: 560, y: 420 }, width: 480 },
        { kind: "ring", from: say("on your row"), to: say("in Party.", 1.6, true), target: t("INIT", "phone") },
        { kind: "popup", from: say("on your row"), to: say("in Party.", 1.6, true), icon: "⚔️", title: "INIT", lines: ["On your row in Party"], pos: { x: 560, y: 420 }, width: 440 },
      ],
    },
  ],
};
