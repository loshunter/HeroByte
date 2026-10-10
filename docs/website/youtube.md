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
   - Banner: `site/video/out/youtube/channel-banner.png` (2560×1440; the logo, tagline and chips
     sit inside YouTube's 1546×423 safe area, so phones and TVs show all of it).
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

The lessons have no music yet. One bed per video, made in Suno **Custom** mode, then mixed under
Wren (ducked well below her voice, swelling only at the intro, the big moments and the outro).
Send the MP3 or WAV and it gets fitted to the cut.

**Style of Music** (both tracks; it keeps the channel sounding like one thing):

```
16-bit SNES JRPG chiptune, cozy adventurous town theme, bright square-wave lead, warm triangle bass, soft noise-channel drums, light arpeggios, instrumental, uncluttered midrange for a narrator, loopable
```

**Exclude styles:** `vocals, choir, singing, heavy distortion, dubstep, orchestral, lo-fi crackle`

**Track A, DM quick start** (aim for 2:10 or longer; title "Game Night Prep"). With **Instrumental**
on, paste the section tags below into the lyrics box if your Suno version keeps it; if it starts
singing, keep Instrumental on and leave the box empty. The times are where each part lands in the
video; Suno will not hit them exactly, the edit cuts and joins the parts to fit.

```
[Intro: 4 seconds, bright fanfare hit]
[Main Theme: light, curious, steady, 110 BPM]
[Variation: more playful, same melody]
[Build: rising arpeggios, tension, 4 seconds]
[Big Hit: heroic chord, door-kick energy]
[Main Theme: calm return]
[Outro: short victory fanfare, clean ending]
```

| Video time | Part of the track |
| --- | --- |
| 0:00–0:04 | Intro (title card) |
| 0:04–0:47 | Main theme |
| 0:47–1:06 | Variation (three ways to get a map) |
| 1:06–1:10 | Build ("...the fun one") |
| 1:10–1:19 | Big hit (G, the kicked-in door, the tavern appears) |
| 1:19–1:57 | Main theme, calm |
| 1:57–2:04 | Victory fanfare (recap) |

**Track B, Player quick start** (aim for 2:00 or longer; title "First Session"). Same style line,
with `relaxed tavern feel, 100 BPM` added. No big hit; a small lift for the dice roll at 1:33 and
the same short victory fanfare at 1:49. One of your existing lighter chiptune tracks may fit as it
is; send it and it can be tried first.
