import type { LessonScript } from "../script";

// Every on-screen word restates what Wren says or what video-scripts.md captions.
const say = (s: string, off = 0, end = false) => ({ say: s, off, end });
const mark = (m: string, off = 0, who = "dm") => ({ mark: m, off, who });
const t = (m: string, who = "dm", nth = 1) => ({ mark: m, who, nth });

export const dmPath7: LessonScript = {
  slug: "dm-path-7-run-your-first-combat",
  title: "RUN YOUR FIRST COMBAT",
  subtitle: "DM path 7: the Encounter tab",
  captionFixes: { pre: "Prev" },
  outro: {
    headline: "VICTORY!",
    next: "Next: DM path 8, Backups and keeping your work. More at herobyte.pages.dev/help",
  },
  chapters: [
    {
      title: "The Encounter tab",
      beats: [
        { kind: "title", from: 0.2, to: say("Fights live", -0.2), text: "STEEL IS DRAWN", sub: "and the dice are out", y: 420, sfx: "ping.wav" },
        { kind: "chips", to: say("Setup lists", -0.2), pos: { x: 600, y: 860 }, sep: "›", items: [{ text: "DM MENU", at: say("in the DM menu") }, { text: "⚔️ ENCOUNTER", at: say("Under Encounter") }] },
        {
          kind: "chips",
          to: say("Setup lists", -0.2),
          pos: { x: 600, y: 300 },
          tone: "blue",
          items: [
            { text: "PREPARE", at: say("Prepare,") },
            { text: "ROLL", at: say("Roll,") },
            { text: "RUN", at: say("Run") },
            { text: "END", at: say("and End") },
          ],
        },
        { kind: "ring", from: say("Setup lists", -0.1), to: say("Monster HP players see", -0.2), target: t("Setup") },
        { kind: "ring", from: say("Monster HP players see", -0.1), to: mark("Bloodied", 0.8), target: t("Monster HP") },
        {
          kind: "chips",
          to: say("enforces it.", 1.4, true),
          pos: { x: 600, y: 860 },
          items: [
            { text: "EXACT", at: say("Exact,") },
            { text: "🩸 BLOODIED", at: say("bloodied") },
            { text: "HIDDEN", at: say("or hidden") },
          ],
        },
        { kind: "sticker", from: say("The server enforces"), to: say("enforces it.", 1.4, true), text: "THE SERVER ENFORCES IT", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
      ],
    },
    {
      title: "Players roll first",
      split: { from: 0, labels: ["DM", "A PLAYER'S SCREEN"] },
      beats: [
        { kind: "title", from: say("Watch one thing"), to: say("On that character's", -0.2), text: "WATCH ONE THING", sub: "an initiative saved with no fight running starts one", y: 300 },
        { kind: "ring", from: say("press in it", -0.1), to: mark("INIT", 0.8, "player"), target: t("INIT", "player") },
        { kind: "ring", from: say("and roll for their", -0.1), to: mark("ROLL D20 NOW", 0.8, "player"), target: t("ROLL D20 NOW", "player") },
        { kind: "sticker", from: say("The first one to roll"), to: say("starts the fight.", 1.4, true), text: "⚔️ FIRST TO ROLL STARTS THE FIGHT", pos: { x: 960, y: 260 }, tone: "gold", tilt: 2 },
      ],
    },
    {
      title: "Roll the NPCs",
      beats: [
        { kind: "ring", from: say("Roll Missing NPC", -0.1), to: mark("Roll missing NPC initiative", 0.8), target: t("Roll missing NPC initiative") },
        { kind: "popup", from: say("rolls a D20"), to: say("Each gets its own line", -0.2), icon: "🎲", title: "D20 + MODIFIER", lines: ["For every NPC with none"], pos: { x: 600, y: 300 }, width: 480 },
        { kind: "sticker", from: say("Each gets its own line"), to: say("A hidden NPC", -0.2), text: "ONE LOG LINE EACH", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "sticker", from: say("A hidden NPC"), to: say("Players may type", -0.2), text: "🙈 HIDDEN NPC: YOUR LOG ONLY", pos: { x: 600, y: 300 }, tone: "gold", tilt: -2 },
        { kind: "ring", from: say("This line tells you", -0.5), to: say("whether it does.", 1.6, true), target: t("hand entry line") },
      ],
    },
    {
      title: "Start at the top",
      beats: [
        { kind: "popup", from: say("The turn is with"), to: say("Encounter shows a note", -0.2), icon: "⏱️", title: "WHOEVER ROLLED FIRST", lines: ["Not the highest roll", "Yes, even a goblin"], lineAt: [say("not the highest"), say("even if that was")], pos: { x: 600, y: 300 }, width: 500 },
        { kind: "ring", from: say("Encounter shows a note", -0.1), to: say("Press Start at top", -0.2), target: t("not at the top") },
        { kind: "ring", from: say("Press Start at top", -0.1), to: mark("Start at top", 0.8), target: t("Start at top") },
        {
          kind: "chips",
          to: say("refills movement.", 1.4, true),
          pos: { x: 600, y: 860 },
          items: [
            { text: "⏮ TURN TO THE TOP", at: say("It moves the turn") },
            { text: "ROUND STARTS OVER", at: say("starts the round over") },
            { text: "MOVEMENT REFILLS", at: say("refills movement") },
          ],
        },
      ],
    },
    {
      title: "Running turns",
      split: { from: say("On a token's plate", -0.8), labels: ["DM", "A PLAYER'S SCREEN"] },
      beats: [
        { kind: "chips", to: say("The status line", -0.2), pos: { x: 600, y: 860 }, items: [{ text: "NEXT ►", at: say("Next and") }, { text: "◄ PREV", at: say("for previous") }] },
        { kind: "sticker", from: say("A chime marks"), to: say("The status line", -0.2), text: "🔔 A CHIME EACH CHANGE · ANYONE CAN PRESS", pos: { x: 600, y: 300 }, tone: "blue", tilt: 2 },
        { kind: "ring", from: say("The status line", -0.1), to: say("On a token's plate", -0.9), target: t("status") },
        { kind: "popup", from: say("its movement left"), to: say("Overspend", -0.2), icon: "👣", title: "MOVEMENT LEFT THIS TURN", lines: ["On the token's plate"], pos: { x: 1440, y: 260 }, width: 480 },
        { kind: "popup", from: say("turns red"), to: say("With monster HP", -0.2), icon: "🟥", title: "OVERSPENT: IT TURNS RED", lines: ["Nothing is refused"], lineAt: [say("Nothing is refused")], pos: { x: 1440, y: 260 }, width: 480 },
        { kind: "popup", from: say("players see a red dot"), to: say("not numbers.", 1.4, true), icon: "🩸", title: "BLOODIED", lines: ["A red dot, not numbers"], pos: { x: 1440, y: 260 }, width: 440 },
      ],
    },
    {
      title: "End the fight",
      beats: [
        { kind: "ring", from: say("End Combat stops", -0.1), to: mark("End combat", 0.8), target: t("End combat") },
        { kind: "popup", from: say("keeps every initiative"), to: say("Clear All Initiative", -0.2), icon: "🏁", title: "INITIATIVES STAY ON FILE", lines: ["The next one saved", "starts a new fight"], lineAt: [say("keeps every"), say("starts a new fight")], pos: { x: 600, y: 300 }, width: 480 },
        { kind: "ring", from: say("Clear All Initiative", -0.1), to: say("empties the order.", 1.4, true), target: t("Clear all initiative") },
      ],
    },
  ],
};
