# HeroByte on YouTube

Everything needed to start the channel and post the first two lessons. The channel itself has to
be created by the owner (an account and its sign-in are yours); the rest is ready below.

## 1. Create the channel (owner)

1. Sign in to YouTube with the Google account that should own HeroByte's channel, open
   **YouTube Studio → Settings → Channel**, or **Create a channel** from the account menu.
   Choose a **Brand Account** (a channel with its own name) so you can add managers later without
   sharing your Google password.
2. **Name:** `HeroByte`. **Handle:** try `@HeroByte`; if it is taken, `@HeroByteVTT` or
   `@PlayHeroByte`.
3. **Customization → Branding:**
   - Banner: the owner's illustrated banner (chosen 2026-10-07), fitted to 2560×1440 as
     `site/video/out/youtube/channel-banner-art.png`: the art scaled to 2402×448 and placed so
     the whole logo sits inside YouTube's 1546×423 safe area (phones show only that part; the
     castles and desk props at the edges show on computers and TVs). The rendered alternative is
     `channel-banner.png`.
   - Picture: `apps/client/public/icon-512.png` (square; YouTube shows it as a circle).
4. **Customization → Basic info:**
   - Description (paste):

     > HeroByte is a retro virtual tabletop that runs in the browser. Build the dungeon live
     > while your party plays: rooms, doors and walls, a dungeon generator for when they go
     > somewhere you never planned, fog of war, dice and voice chat. No accounts: players join
     > with a password. Every tool works on phones and tablets too.
     >
     > This channel has the lessons from the help center: quick starts for players and DMs, and
     > short videos on every part of the app.

   - Links: **Website** `https://herobyte.pages.dev` · **Help & lessons**
     `https://herobyte.pages.dev/help/` · **Play** `https://herobyte.pages.dev/play/`.
5. Make a playlist **HeroByte lessons** (public) for the videos below.

Banner and thumbnails are rendered from `site/video/src/brand.tsx`
(`npx remotion still src/index.ts ChannelBanner out/youtube/channel-banner.png`, from `site/video/`).

## 2. Video: DM quick start

- **File:** `site/video/out/dm-quick-start.mp4` (2:04, 1080p).
- **Thumbnail:** `site/video/out/youtube/thumb-dm-quick-start.png`.
- **Title:** `DM Quick Start: Set Up Your Table Before Game Night | HeroByte`
- **Description:**

  ```
  Set up a HeroByte table before game night: make a private table, claim the DM seat, put a map
  down (or kick in a door and generate one), invite your players, and see exactly what they see.

  0:00 Make a table
  0:30 Claim the DM seat
  0:47 Put a map down (and kick in a door)
  1:19 Send the invite
  1:40 See what they see

  Try it: https://herobyte.pages.dev
  The full DM guide and more lessons: https://herobyte.pages.dev/help/
  ```

- **Tags:** virtual tabletop, VTT, TTRPG, D&D, dungeon master, online tabletop, HeroByte,
  dungeon generator, fog of war, play D&D online.
- **Playlist:** HeroByte lessons. **Audience:** not made for kids. **Category:** Gaming.

## 3. Video: Player quick start

- **File:** `site/video/out/player-quick-start.mp4` (1:56, 1080p).
- **Thumbnail:** `site/video/out/youtube/thumb-player-quick-start.png`.
- **Title:** `Player Quick Start: Your First Session in HeroByte`
- **Description:**

  ```
  Your first session as a HeroByte player: get in with the link and password your DM sent,
  find your token and your character card, move on the map (on a phone too), and roll dice.

  0:00 Get in
  0:28 Find yourself
  0:52 Move
  1:14 Roll

  Try it: https://herobyte.pages.dev
  The player guide and more lessons: https://herobyte.pages.dev/help/
  ```

- **Tags:** virtual tabletop, VTT, TTRPG, D&D, how to play D&D online, online dice roller,
  HeroByte, tabletop on your phone.
- **Playlist:** HeroByte lessons. **Audience:** not made for kids. **Category:** Gaming.

The chapter lists start at 0:00 and every chapter is at least 10 seconds, which YouTube needs to
show chapters. If a re-render changes the timing, recompute them from `site/video/` (the intro
folds into the first chapter and the recap into the last).

## 4. Music (Suno)

The lessons have no music yet. (The trailer has its own track, "Kick In The Door"; this section is
only for the lessons.) The lessons are teaching, so their music is a **gentle bed**: quiet, slow,
nothing that competes with Wren. One bed per video, made in Suno **Custom** mode, then mixed well
under Wren's voice, coming up a little only at the title card and the closing recap. Send the MP3 or
WAV and it gets fitted to the cut.

### How the timing works

Suno does not follow seconds, but it follows **sections and bar counts** fairly well. Both tracks
are 80 BPM in 4/4, so **one bar is 3 seconds**, and every section below is sized in bars to match a
chapter of the real video (times measured from the renders: the DM lesson is 2:04.4, the Player
lesson 1:56.1). Each chapter change has a gold pixel wipe, which hides a music cut, so the edit
trims or loops each section to its chapter and joins them under the wipes. If Suno runs a section
long or short, that is fine; the shape (where it is calm, where it lifts, where it resolves)
matters more than the length.

In Suno: **Custom** mode, **Instrumental** on. Paste the style line into **Style of Music**, the
exclude line into **Exclude styles**, and the section block into the lyrics box. If your Suno version
hides the lyrics box when Instrumental is on, or it starts singing, leave the box empty; the cue
sheet still tells the edit where everything goes. Make 2 to 4 versions and send the ones you like.

**Settings (v6):** Standard v6, not Max Mode. Variety 0, Weirdness about 25%, Style Influence about
90%. Low weirdness and high style influence keep it on the brief; this is background music, so
surprises are not wanted.

**Exclude styles** (both tracks):

```
vocals, choir, singing, heavy drums, fanfare, epic, fast tempo, heavy distortion, dubstep, orchestral, lo-fi crackle
```

### Track A: DM quick start ("Game Night Prep", 2:04, ask for 2:10 or longer)

**Done 2026-10-08, and this recipe worked: keep it exactly as it is.** Suno returned a 3:33 track at
about 76 BPM (not 80) with a sparse intro, a bright section at 1:20, a quiet breakdown at 2:40 and a
clean ending. That is longer than asked, which is fine: the edit cut four bar-aligned pieces from it
to fit the lesson (preview `site/video/out/dm-quick-start-music.mp4`).

**Style of Music:**

```
gentle 16-bit SNES JRPG chiptune, calm cozy village theme at dusk, soft rounded square-wave melody, warm triangle bass, slow music-box arpeggios, very light percussion or none, 80 BPM, 4/4, peaceful, unhurried, instrumental, lots of space for a narrator, clean ending
```

**Sections** (lyrics box):

```
[Intro: 2 bars, one soft opening chord and a twinkling arpeggio]
[Verse 1: 9 bars, main theme, calm and curious, sparse]
[Verse 2: 5 bars, main theme continues, add a soft counter-melody]
[Interlude: 6 bars, same melody, a little brighter and more playful]
[Pre-Chorus: 2 bars, gentle rising arpeggio, soft]
[Chorus: 3 bars, one warm swell, fuller chords, still gentle]
[Verse 3: 7 bars, main theme returns, relaxed, a light playful pluck near the end]
[Bridge: 5 bars, hushed and mysterious, lower register, fog at night]
[Outro: 3 bars, quiet resolving cadence, clean final chord]
```

**Cue sheet** (what is on screen when each section plays):

| Video time | Section | Chapter | What happens, and what the music does |
| --- | --- | --- | --- |
| 0:00–0:04 | Intro | Title card | Logo and title pop in. The one moment the music sits up front. |
| 0:04–0:31 | Verse 1 | 1. Make a table | Wren explains private tables and passwords. Calm, settled, low. |
| 0:31–0:47 | Verse 2 | 2. Claim the DM seat | Entering DM mode. Same mood, a touch of movement. |
| 0:47–1:05 | Interlude | 3. Put a map down | "Three ways to get a map": upload, then build one live. A little brighter. |
| 1:05–1:09 | Pre-Chorus | 3. (cont.) | "And the third way is the fun one." A small rise. |
| 1:09–1:19 | Chorus | 3. (cont.) | "Now press G": the kicked-in door, and the tavern appears. The one swell in the lesson. |
| 1:19–1:41 | Verse 3 | 4. Send the invite | Copying the invite link. At 1:35 the joke ("what's the password for the next 10 minutes?") can take a playful pluck. |
| 1:41–1:57 | Bridge | 5. See what they see | Player View: fog from the party's vision, secret doors hidden. Hushed, a little mysterious. |
| 1:57–2:04 | Outro | Recap card | The steps list, then the end. Resolves and stops cleanly at 2:04. |

### Track A, trial 2: bardcore, timestamped (2026-10-08)

The owner did not love the first track once it was synced to the picture. Trial 2 changes the sound
to **bardcore meets NES**: tavern bard music (lute, recorder, hand drum, tambourine) played on the NES
sound chip, still gentle. It is also a test of whether Suno follows **timestamps**: every section in
the lyrics box starts with `(hh:mm:ss)`, the moment it should land in the 2:04 video, and says what
should happen there. If Suno ignores the times, the edit still cuts to fit; compare the result with
the cue sheet above to see how close it got.

What went wrong with trial 1 once synced: the cuts were awkward (the edit jumped whole bars but not
whole phrases, so pieces landed mid-phrase, and it chose parts by mood rather than by what joins
cleanly), and the sound was not tavern enough. So for trial 2 the edit plays the track straight
wherever it can. Where a section must move, it jumps only on phrase boundaries (8 bars) with a
longer crossfade, or holds a chapter's last frame a second or two longer so the picture waits for
the music instead of the music being cut.

**Settings for this trial (Suno v6, Advanced, under More Options):**

| Setting | Value | Why |
| --- | --- | --- |
| Lyrics box | the timestamped block below, replacing what is there | v6 has no Instrumental switch; `[Instrumental]` plus the exclude line keeps it wordless |
| Styles box | the style line below | clear the suggestion chips; do not click them |
| Exclude (the crossed-out note) | the exclude line below | |
| Vocal Gender | leave both unselected | |
| Duration | **Custom, 2:05** | the video is 2:04.4; pins the length the timestamps assume |
| Max Mode | Off | |
| Weirdness | about 25% | trial 1 ran at 50% |
| Style Influence | about 90% | trial 1 ran at 50%; higher keeps it on the brief |
| Variety | lowest | fewer surprises |
| Personalize | Off | |

**Style of Music** (724 characters):

```
Bardcore meets NES chiptune: cozy candlelit tavern bard music played on the NES sound chip. Lute as plucked pulse-wave arpeggios and soft strums, recorder-like square-wave melody, a soft hurdy-gurdy drone on a pulse channel, triangle-wave bass like a low lute string, noise-channel bodhran frame drum and tambourine, an occasional soft noise-channel cymbal. Lilting 6/8 jig feel, about 80 BPM. Gentle, warm, unhurried background music for a narrated tutorial: the melody stays simple and leaves space for a voice. Clean 8-bit sound, clear separation between lute, melody and bass, stable quiet loudness, no sudden volume jumps. Instrumental. Follow the timestamps in the lyrics. Ends on one ringing lute chord, then silence.
```

**Exclude styles:**

```
vocals, singing, choir, modern drum kit, electric guitar, distortion, orchestral, epic, dubstep, lo-fi crackle
```

**Lyrics box:**

```
[Instrumental]

(00:00:00) [Intro] Bright plucked lute flourish, one soft cymbal shimmer, settling into the theme

(00:00:04) [Verse] Main theme: gentle lute arpeggios, recorder melody, soft hand drum. Calm and curious

(00:00:15) [Verse] Same theme, sparser: light lute plucking only, steady and patient

(00:00:30) [Flourish] Quick lute strum to turn the page

(00:00:31) [Verse] Main theme with a regal touch, hand drum on the downbeat, like a seat at the head of the table

(00:00:42) [Accent] Soft hand-drum roll into one warm chord

(00:00:47) [Interlude] Wandering recorder melody, like reading an old map, lute answering

(00:01:05) [Build] Tambourine shakes and a rising hand-drum roll, getting brighter

(00:01:10) [Crash] One cymbal crash and a full lute strum: the door is kicked in

(00:01:11) [Tavern Jig] Light tavern jig, lute and recorder dancing, tambourine on the off-beats, still gentle

(00:01:19) [Verse] Back to the calm main theme, soft and steady

(00:01:39) [Accent] Playful descending lute pluck, a little musical joke

(00:01:41) [Bridge] Hushed and mysterious: low triangle drone, slow sparse lute notes, no drums, fog at night

(00:01:50) [Verse] Warmth returns, the main theme comes back quietly

(00:01:57) [Outro] The main theme one last time, fuller lute strums, gentle tambourine, slowing down

(00:02:03) [Final Chord] One last ringing lute strum and a soft cymbal shimmer, fading out

(00:02:05) [End]
```

What each timestamp is aimed at: 0:00 title card; 0:04 "Every campaign needs somewhere to
happen"; 0:15 "Press New Table" (filling in the form); 0:30 the chapter wipe; 0:31 "You arrive as an
ordinary player"; 0:42 the DM password is typed; 0:47 "three ways to get a map"; 1:05 "the third way
is the fun one"; 1:10 "Now press G", the kicked-in door; 1:11 the tavern builds itself; 1:19 "Invite
Players"; 1:39 the end of the "what's the password for the next 10 minutes?" joke; 1:41 Player View
and the fog; 1:50 "You keep every DM power"; 1:57 the recap card; 2:04 the video ends.

**Trial 2 result (2026-10-08):** bardic, but the chiptune sound was gone. Duration was left on Auto,
so it ran 2:59.6. The sections came in the requested order but not at the requested times: no crash
at 1:10 (it livens up around 1:14), the hush at about 1:48 instead of 1:41 (16 s long, the length of
chapter 5), then a full return after 2:04 and its own quiet ending from about 2:40.
**Lyrics-box lesson:** plain sentences after a tag get *sung*; wrapping each description in
parentheses kept it instrumental. Keep the `(time) [Tag] (description)` form.

### Track A, trial 3: chiptune first, Duration 2:05

Same timestamps, with Duration set to Custom 2:05 this time. The style box now names the NES sound
chip's four channels and gives each bardic instrument to one of them, so Suno reaches for chip
voices instead of a real lute and recorder (trial 2 named the real instruments first). The lyrics
descriptions say "chiptune" and "8-bit" for the same reason.

**Style of Music** (809 characters):

```
8-bit NES chiptune. A bardcore tavern song rendered entirely on the NES sound chip: two pulse-wave channels, one triangle channel, one noise channel, nothing else. One pulse wave plays lute-style plucked arpeggios and strums; the other pulse wave plays a recorder-style melody and a soft hurdy-gurdy-like drone; the triangle wave plays the bass; the noise channel plays bodhran and tambourine patterns and an occasional soft cymbal. Lilting 6/8 jig feel, about 80 BPM. Gentle, warm, cozy candlelit tavern mood, background music for a narrated tutorial: a simple melody that leaves space for a voice. Dry, clean 8-bit chip sound, no real acoustic instruments, clear separation between channels, stable quiet loudness. Instrumental. Follow the timestamps in the lyrics. Ends on one ringing chord, then silence.
```

**Exclude styles:**

```
vocals, singing, choir, acoustic guitar, real lute, live acoustic instruments, orchestral strings, modern drum kit, electric guitar, distortion, epic, dubstep, lo-fi crackle
```

**Lyrics box:**

```
[Instrumental]

(00:00:00) [Intro] (Bright 8-bit lute flourish on the pulse channel, one soft noise-cymbal shimmer, settling into the theme)

(00:00:04) [Verse] (Main theme: gentle chiptune lute arpeggios, pulse-wave recorder melody, soft noise-channel bodhran. Calm and curious)

(00:00:15) [Verse] (Same theme, sparser: light chiptune lute plucking only, steady and patient)

(00:00:30) [Flourish] (Quick 8-bit lute strum to turn the page)

(00:00:31) [Verse] (Main theme with a regal touch, bodhran on the downbeat, like a seat at the head of the table)

(00:00:42) [Accent] (Soft noise-channel drum roll into one warm chord)

(00:00:47) [Interlude] (Wandering pulse-wave recorder melody, like reading an old map, chiptune lute answering)

(00:01:05) [Build] (Noise-channel tambourine shakes and a rising drum roll, getting brighter)

(00:01:10) [Crash] (One noise-channel cymbal crash and a full 8-bit lute strum: the door is kicked in)

(00:01:11) [Tavern Jig] (Light chiptune tavern jig, lute and recorder voices dancing, tambourine on the off-beats, still gentle)

(00:01:19) [Verse] (Back to the calm main theme, soft and steady)

(00:01:39) [Accent] (Playful descending 8-bit lute pluck, a little musical joke)

(00:01:41) [Bridge] (Hushed and mysterious: low triangle-wave drone, slow sparse pulse-wave notes, no drums, fog at night)

(00:01:50) [Verse] (Warmth returns, the main theme comes back quietly)

(00:01:57) [Outro] (The main theme one last time, fuller 8-bit lute strums, gentle tambourine, slowing down)

(00:02:03) [Final Chord] (One last ringing chiptune chord and a soft noise-cymbal shimmer, fading out)

(00:02:05) [End]
```

**Trial 3 result (2026-10-08):** `site/video/public/music/dm-quick-start-trial3.wav`. With Duration
set it came back **2:04.8** at **80.7 BPM**, and its ending fades from 2:02 to silence at 2:04,
exactly where the video ends, so it plays straight through with **no cuts**. Sections, compared with
the timestamps: a change at about 1:12 (asked 1:10 to 1:11), but a step down, not a cymbal crash;
the hush at about 1:49 (asked 1:41; trial 2 was late by the same amount, so Suno may run bridges
late). So Duration is followed exactly, section times only roughly. Preview:
`site/video/out/dm-quick-start-trial3.mp4`, with music 14 to 18 dB under Wren's speech.

### Track B: Player quick start ("First Session", 1:56)

Built the way trial 3 worked for the DM lesson, and with the **same instruments**, so the two lessons
sound like one series while each track is timed to its own video and plays with no cuts. (Reusing
the DM track here would need cuts: the Player lesson is 8 s shorter and its big moment is the dice
roll at 1:34, not the door at 1:10.)

What carried over from trial 3:

- **Duration Custom 1:56** (the video is 1:56.1). This is what Suno followed most exactly.
- Every description in **parentheses** after its tag, `(time) [Tag] (description)`, so nothing is
  sung.
- The style box names the NES chip's channels per instrument, so it stays chiptune.
- **One lift only**, asked for a little early: Suno ran the DM track's section changes 2 to 8 s late,
  so the dice-roll lift is asked for at 1:31 to land near "Press Roll" at 1:34.
- No crash asked for: trial 3 did not make one. The lift is asked for as a brighter, fuller moment.

Settings: Duration **Custom 1:56**, Max Mode off, Weirdness about 25%, Style Influence about 90%,
Variety lowest, Vocal Gender unselected, Personalize off.

**Style of Music:**

```
8-bit NES chiptune. A bardcore tavern song rendered entirely on the NES sound chip: two pulse-wave channels, one triangle channel, one noise channel, nothing else. One pulse wave plays lute-style plucked arpeggios and strums; the other pulse wave plays a recorder-style melody and a soft hurdy-gurdy-like drone; the triangle wave plays the bass; the noise channel plays bodhran and tambourine patterns. Lilting 6/8 jig feel, about 80 BPM. Friendly and playful, a warm welcome on a first night at the tavern, background music for a narrated tutorial: a simple melody that leaves space for a voice. Dry, clean 8-bit chip sound, no real acoustic instruments, clear separation between channels, stable quiet loudness. Instrumental. Follow the timestamps in the lyrics. Ends on one ringing chord, then silence.
```

**Exclude styles:**

```
vocals, singing, choir, acoustic guitar, real lute, live acoustic instruments, orchestral strings, modern drum kit, electric guitar, distortion, epic, dubstep, lo-fi crackle
```

**Lyrics box:**

```
[Instrumental]

(00:00:00) [Intro] (Bright 8-bit lute flourish on the pulse channel, settling into the theme)

(00:00:04) [Verse] (Main theme: warm chiptune lute arpeggios, pulse-wave recorder melody, soft noise-channel bodhran. Welcoming, like a tavern door opening)

(00:00:16) [Verse] (Same theme, sparser: light chiptune lute plucking only, patient)

(00:00:26) [Flourish] (Small happy 8-bit lute strum: you are in)

(00:00:29) [Verse] (Main theme, curious and friendly, a soft pulse-wave counter-melody answering the recorder)

(00:00:39) [Accent] (Quick rising 8-bit arpeggio, a little sparkle)

(00:00:52) [Interlude] (Light staccato pulse-wave plucks in steps, playful, like walking square by square on a grid, bodhran ticking softly)

(00:01:14) [Verse] (Main theme with gentle anticipation, tambourine shakes building softly)

(00:01:31) [Lift] (Brighter and fuller for a moment: the whole tavern band of chip voices plays the theme together, like a lucky roll)

(00:01:40) [Verse] (Settles back to the calm main theme, soft and steady)

(00:01:49) [Outro] (The main theme one last time, fuller 8-bit lute strums, gentle tambourine, slowing down)

(00:01:54) [Final Chord] (One last ringing chiptune chord, fading out)

(00:01:56) [End]
```

What each timestamp is aimed at: 0:00 title card; 0:04 "Every adventure starts with getting through
the door"; 0:16 "Open the link", typing the password; 0:26 "Press Enter table"; 0:29 "This is your
token"; 0:39 "The map jumps to it"; 0:52 "Drag your token to move it", snapping and stepping with
WASD; 1:14 "Press DICE", building a roll; 1:31 asked early so the lift lands on "Press Roll" (1:34)
and the quick d20 row; 1:40 "Rolling real dice at the table?"; 1:49 the recap card; 1:56 the video
ends.

**Trial 1 result (2026-10-08):** `site/video/public/music/player-quick-start-trial1.wav`, 1:55.8
(Duration followed), about 103 BPM (not 80). Section changes landed close to their timestamps this
time: 0:16, about 0:36 to 0:38, exactly 1:14, and the lift peaking 1:29 to 1:34 then dipping. Asking
early was not needed here: the lift peaked just *before* "Press Roll". So the preview starts the
track 1.5 s into the title card, uncut: the peak covers "Press Roll", the sparkle lands on "the map
jumps to it", and the track fades to silence just before the video ends. Preview:
`site/video/out/player-quick-start-trial1.mp4`, music 15 to 17 dB under Wren's speech.

