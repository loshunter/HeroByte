# Narration audition: picking the HeroByte voice

One passage, run through both voices with the same settings, so the only difference you hear is the voice. It is
built from the DM quick start (chapter 3, "Put a map down", and its "common mistake"), with a little more character
than the current scripts, to show how the full scripts could sound once they are written for Eleven v4's audio tags.

Candidates (both premade):

1. **Female narrator**: balances serious, dramatic storytelling with an underlying cheekiness; the tabletop DM guiding
   a chaotic party.
2. **Cassius**: velvety, measured, commanding British RP; calm and deliberate, with room for sudden intensity.

## How to run it

In ElevenLabs, open **Text to Speech** (or a **Studio** project) and set:

- **Model:** Eleven v4 (`eleven_v4`), not Turbo. Turbo is for real-time agents; v4 is the one meant for narration.
- **Stability:** start at **50**. v4 has only two settings, Stability and Similarity (no Style or Speed slider). Lower
  stability gives a more varied, performative read; higher gives a steadier one. Then try **35** for Female narrator
  (more play) and **60** for Cassius (keeps his cadence even). ElevenLabs recommends a few takes at lower stability and
  picking the best.
- **Similarity:** leave it at the default.
- **Takes:** generate each passage **3 times** per voice. v4 varies between takes, and one bad take says little.

Run four things per voice: the tagged passage, the plain passage (same words, no tags, which shows what the tags add),
the pronunciation check, and the in-character line.

## 1. The tagged passage (about 70 seconds)

Paste exactly this, brackets included. The tags follow the patterns in the v4 page's Voice acting and Audiobook
showcase: descriptive directions that carry pace and tone together (`[Gradually building energy]`,
`[Pause, dry amusement]`, `[Quick, light, playful pace]`), and non-verbal reactions placed inside the line
(`[soft chuckle]`, `[sigh]`).

```text
[Warm, storytelling narration] Every campaign needs somewhere to happen. Tonight, that somewhere is your table.

[Clear, friendly instruction] There are three ways to put a map on it. Have a map image already? Upload it from the DM Menu, under Maps. Want to build one yourself? Open Build map, and press Start live map.

[lower, conspiratorial] But the third way... [soft chuckle] is the fun one.

[Gradually building energy] Your players ignore the quest. They wander off the edge of your notes. They open the one door you never planned for.

[Pause, dry amusement] They always do.

[Quick, light, playful pace] So press G. Pick a recipe. Press Generate and enter... and HeroByte builds a stocked place behind that door, and moves the whole table inside.

[measured, reassuring] Fog is already on. Your players only see what their characters can see.

[Pause, matter-of-fact] One last thing. When you send the invite link, send the table password separately. The link doesn't carry it. [mischievously] Unless you enjoy answering "what's the password?" for the next ten minutes. [sigh]
```

## 2. The plain passage (same words, no tags)

```text
Every campaign needs somewhere to happen. Tonight, that somewhere is your table.

There are three ways to put a map on it. Have a map image already? Upload it from the DM Menu, under Maps. Want to build one yourself? Open Build map, and press Start live map.

But the third way... is the fun one.

Your players ignore the quest. They wander off the edge of your notes. They open the one door you never planned for.

They always do.

So press G. Pick a recipe. Press Generate and enter... and HeroByte builds a stocked place behind that door, and moves the whole table inside.

Fog is already on. Your players only see what their characters can see.

One last thing. When you send the invite link, send the table password separately. The link doesn't carry it. Unless you enjoy answering "what's the password?" for the next ten minutes.
```

## 3. Pronunciation check

The lessons are full of game shorthand. Run this once per voice and note anything misread:

```text
[Clear, even narration] Welcome to HeroByte. Roll a d twenty with advantage, add your plus two, and step six squares with W, A, S, D. A fifteen foot cone. Fifth edition rules. The D M can hide an N P C, and Control Z undoes your last edit.
```

If a word is still wrong (most likely "HeroByte"), v4 accepts IPA between slashes. For example:
`Welcome to "/ˈhɪəroʊˌbaɪt/".`

## 4. In character: the DM voicing a quest-giver

The narrator as a DM doing an NPC, in the style of the v4 page's Voice acting examples (which are, fittingly, a
fantasy quest-giver): stacked tags, a sigh in mid-line, mood switching inside a line, then the "sudden intensity"
turn. The lessons would use this sparingly (an intro, the Kicked-In Door), but it shows the voice's range and
whether it can be a DM, not only describe one.

```text
[casual] "Adventurers, eh? Good. The cellar under this tavern has a rat problem... a big rat problem."
------------
[annoyed] [muttering under breath] "Third party this week. [sigh] The last lot came back two members short and one rat richer."
------------
[ecstatic] "But YOU look capable! [dismissive] Mostly."
------------
[Low, steady voice, restrained urgency] The cellar door is already open. Whatever was down there... is awake now. [Voice rising into firm resolve] Roll for initiative.
```

The `------------` lines are how the showcase separates segments in one generation; leave them in.

## 5. Whisper, performance and sarcasm

Added 2026-10-07 for the owner's taste ("whispering and performance and sarcasm when necessary"):

```text
[whispering] Shh. The goblins are asleep. If anyone so much as sneezes, this ends very badly. [Pause, dry amusement] Oh, wonderful. The bard brought a lute. [sarcastic] Of course he did. Who doesn't bring a lute to a stealth mission? [measured, quietly building] Alright. Everyone, roll for stealth. [whispering] Especially the bard.
```

## What to listen for

- **Can you follow it?** These are tutorials first. Can you tell which button to press while the screen moves? Is the
  pace right for a viewer clicking along, or too slow?
- **Do the tags land?** Compare tagged and plain. Listen for a tag that is read aloud, or that turns into a sound
  effect instead of a delivery (ElevenLabs warns this can happen; descriptive tags like `[dry amusement]` are
  safer than single words).
- **Does the joke land?** "They always do" and the password line are the cheekiness test. It should sound like a
  friendly DM, not sarcasm.
- **Do the button names sound like buttons?** "Start live map" and "Generate and enter" should be clear without
  sounding shouted.
- **Will it hold up for 16 videos?** A voice that is wonderful for 70 seconds can tire over 45 minutes.

## A first read of the fit (decide by ear)

- **Female narrator** sounds built for this: a DM's voice suits a tabletop app's lessons, and "serious with a cheeky
  undercurrent" is the tone of the help center's quick fixes and common-mistake beats. Strongest candidate for all
  16 lessons.
- **Cassius** suits the dramatic moments: the landing page, a trailer, "Roll for initiative". His calm, deliberate
  cadence may make 16 instruction-heavy lessons long and slow. If you love him, one option is Cassius for an
  intro or trailer and Female narrator for the lessons. That is two voices to keep consistent, so only if both earn it.

## How the full scripts will change once a voice is picked

The current scripts (`video-scripts.md`) were written for a human reader. For Eleven v4 they need these changes:

1. **Button names in normal case.** v4 reads capitals as emphasis, so "Press ENTER TABLE" would be shouted. Narration
   says "Press Enter Table"; capitals are kept only for words that should be stressed. On-screen captions keep the
   real labels.
2. **Shorthand spelled the way it is said:** d20 becomes "d twenty", 5e becomes "fifth edition", 15 ft becomes "fifteen
   feet", Ctrl+Z becomes "Control Z", WASD becomes "W, A, S, D". Emoji are dropped, and table codes are never read
   out.
3. **One opening tag per chapter** (for example `[Warm, clear tutorial narration]`), so the delivery stays consistent
   from chapter to chapter and video to video.
4. **Sparing tags after that,** in the patterns the v4 showcase uses, only where the delivery should change:
   - direction tags that carry pace and tone together: `[Pause, dry amusement]` for a common mistake,
     `[Gradually building energy]` for a big moment, `[Quick, light, playful pace]` for a run of quick clicks;
   - non-verbal reactions inside the line, not before it: `... [soft chuckle] is the fun one`, `[sigh]` at a joke's end;
   - stacked tags for a precise colour: `[lower, conspiratorial]`, `[annoyed] [muttering under breath]`;
   - a mood switch inside a line: `[ecstatic] ... [dismissive] ...`, for in-character moments only.
   At most one change of delivery per paragraph in instruction-heavy chapters, matched to the chosen voice.
5. **Pauses from structure:** paragraph breaks, ellipses and `[short pause]`. v4 does not support SSML break tags.
6. **One generation per chapter** (well under v4's 10,000-character limit), with the same voice and settings for all
   of them, 2 or 3 takes each, keeping the best.
7. **A little more character,** like the audition: a line of flavour at the start of each video and a light touch in
   the common-mistake beats. The instructions stay plain and exact.

Sources: ElevenLabs docs ([Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4),
[Best practices: Prompting Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v4),
[Models](https://elevenlabs.io/docs/overview/models), [Text to Speech playground](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech),
[Studio](https://elevenlabs.io/docs/eleven-creative/products/studio)), read 2026-10-07.
