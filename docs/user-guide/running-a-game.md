# Running a Game: three ways to get a map on the table

HeroByte does not have _a_ workflow. It has three, they cost different amounts of prep, and you can
switch between them in the middle of a session without anyone leaving the table.

- **Bring a map you already have** — a PNG or JPG from a marketplace, a pack, or your own drawing.
- **Build it here** — rooms, halls, doors and painted terrain in the live editor.
- **Kick in a door** — press one key and HeroByte generates a stocked place on the spot.

This guide walks each one end to end, says when it earns its keep, and shows how to mix them. None
of them is the "real" way. A perfectly good campaign uses all three in one evening.

## Which one, right now?

| Your situation                                          | Use                                              | Prep        |
| ------------------------------------------------------- | ------------------------------------------------ | ----------- |
| You already own art for this scene                      | [A — a map you have](#a--a-map-you-already-have) | a minute    |
| You care about this room and want it exact              | [B — build it](#b--build-it-in-herobyte)         | 10–40 min   |
| They just went somewhere you never prepped              | [C — kick in a door](#c--kick-in-a-door)         | none        |
| You have art, and you want fog and doors on it          | [A then B](#mixing-them)                         | ~5 min      |
| You want a generated place, but that one room hand-made | [C then B](#mixing-them)                         | as you like |

One fact ties them together, and it is worth knowing before you start:

> **Fog of war and the Kicked-In Door both need a _live map_** — a HeroByte map document bound to
> the table. A background image on its own is a picture, and neither feature can read it. Path B
> and Path C give you one automatically. Path A does not, until you add one (which takes about five
> minutes — see [Mixing them](#mixing-them)).

---

## A — a map you already have

**When:** you bought a battlemap, drew one, or found one you like. The art is done and you just want
it on the table.

**Why:** it is the fastest path from nothing to playing, and it keeps whatever art style you have
already invested in.

### Do this

1. Elevate to DM ([how](getting-started.md#becoming-the-dm)), then open **🛠️ DM MENU** →
   **Map Setup**.
2. Under **Map Background**, either **⬆ UPLOAD IMAGE** (from your device — it is stored with your
   table and stays there) or paste an image URL and **APPLY BACKGROUND**. A URL only works if the
   image's host allows other sites to load it; if nothing appears, download it and upload instead.
3. Make the table's grid match the grid printed on your image: **Grid Alignment Wizard** →
   **START ALIGNMENT**, click two _opposite corners of one square_ on the image, then
   **APPLY ALIGNMENT**. The map scales and shifts itself to mesh.
4. Set **Square Size** in feet (usually 5) so measuring and templates report real distances.
5. Turn on **Map is locked** in **Map Transform** so nobody drags the map by accident mid-fight.

Drop tokens on it and play.

### What you get, and what you don't

You get the art, the grid, measurement, drawing, dice, initiative — the whole table.

You do **not** get fog of war, doors that open, or light that stops at walls, because those are
computed from a map's geometry and a photograph has none. HeroByte will not pretend otherwise: the
**Fog of War** button stays disabled and says _"Publish a Map Studio map first — fog uses its
compiled walls and doors."_

If you want fog on this image, you do not have to abandon it — see [Mixing them](#mixing-them).

---

## B — build it in HeroByte

**When:** the scene matters. A boss arena, a puzzle room, the keep the campaign has been pointed at
for a month.

**Why:** everything works. Walls block sight and movement, doors open and close and can be secret,
lights pool and cast shadows, fog reveals the room as the party walks into it.

### Do this

1. Open the map tools (**⚒ TOOLS** on a phone) and press **▶ START LIVE MAP**. That creates a fresh
   map, binds it to the table, and lights the **● LIVE** badge. Every edit from now on compiles and
   reaches players immediately.
2. Block out space with **🏠 Room** and **🚇 Hall**.
3. Add **🧱 Wall** where sight should stop and **🚪 Door** where the party can get through.
4. Optional and quick: **💡 Light** for torches, **🖌️ Paint** for terrain, **✨ Populate** for
   instant furniture.
5. Turn on **Fog of War** in Map Setup. Set **Table Sight Default** to 30 ft if you want the place
   dark.

The [Map Editor Guide](map-editor-guide.md) covers every tool in detail. Two things worth knowing
now: **Escape** leaves edit mode and the map stays live, and **👁 PLAYER VIEW** shows you the table
through a player's eyes without stopping your work.

### What players never see

Secret doors, the GM Notes layer, anything hidden — and the wall overlay itself. **Walls are
invisible to players.** They act through fog and movement, not as scenery. That detail is what makes
the hybrid below work.

---

## C — kick in a door

**When:** the party opens a door you did not prep. They ignore the plot hook and wander into the
tavern. They ask what is down the stairs. This is the moment the feature exists for — not prep time,
but the ten seconds where you would otherwise say _"give me a minute."_

**Why:** you get a real, playable, stocked map with fog and doors in about five seconds, and the
place you left is waiting exactly as it stood when you come back.

### Do this

1. Be on a live map. Path B gives you one, and any place you have already kicked in is one — but a background image on its own is not, and **ROLL** will be greyed out until you start one.
2. Press **G**. On a phone: **♛ DM** → **🚪 Kick in a door**. There is also
   **🚪 KICK IN A DOOR** on the DM Menu's **Atlas** tab.
3. The panel opens with the name already filled in and your last dials remembered. Type a name if
   you want one — _The Salt Hound_ beats _Tavern 3_ at the table.
4. Pick the **Recipe** and its dials (below).
5. Hit **🚪 ROLL**, or just press Enter.

That is the whole interaction. Seconds later the table is somewhere new.

### What just happened

- A new place was generated, compiled, and put on the table for **everyone**, not just you.
- Fog is on and the camera is on the party.
- The party is standing **inside the entrance** — a marked strip just in the door — rather than in
  solid rock.
- A **🚪 door sprite** now sits on the map you left, where the party was standing.
- Another sits at the new entrance, leading **back**.
- The new place hangs under the one you were on in the **Atlas**, already discovered, so players see
  its name on their **🗺 WORLD** map at once.
- If your table was not on the Atlas at all, it just **adopted itself** as your campaign's first
  node, named after the map. You never have to set anything up in advance.

### Getting back

Click the return **🚪** and confirm. The old scene resumes as you left it — open doors, drawings,
initiative, fog, all of it.

One honest wrinkle: **travel re-places the travelling party.** The scene comes back exactly as it
was, but the party tokens are set down together at the destination's entrance, or at the map's
centre if it has none. Coming back from a kicked-in door that means the middle of the old map rather
than the doorway you left by. Drag them where you want them.

### Doing it again from inside

Press **G** again. The new place is now the one you are standing on, so the next kick hangs
underneath it. A cellar under the tavern under the town is three keystrokes.

### If it does not budge

You get a toast after twenty seconds. Press **🚪 ROLL** again — it retries safely and cannot build
the place twice.

If **ROLL** is greyed out, the table has no live map. Start one (Path B, step 1) and try again.

### The dials

**Dungeon** — rooms joined by corridors, doors between them, a brazier in most rooms, and a key on
the notes layer saying what lives there. Dials: **theme** (stone or wood) and **density**.

**Building** — a **tavern**, **shop**, **warehouse** or **house**: a footprint partitioned into
rooms by real walls, interior doors, exactly one front door with the party arriving just inside it,
a light per room, room keys written for that kind, and furniture that suits it — tables in a
tavern's common room, crates along a warehouse's walls, a counter in a shop.

**Size** sets the footprint. Small is a handful of rooms; large is a floor plan you can lose people
in.

### Seeds, and rolling the same place twice

Every recipe is deterministic: **the same seed and the same dials always produce the same place.**
Note a seed down and you can rebuild that tavern exactly, forever. Reroll the seed if you do not
like what you got — before the party has seen it, nobody is any the wiser.

The room keys are **prep notes, not secrets**. Players never receive them, but the map they _can_
see is built from the same seed, so anything that genuinely must stay hidden belongs in your own
notes rather than on the map.

---

## Mixing them

The three paths are not lanes. They share one campaign and one Atlas.

**Fog and doors on a downloaded map (A then B).** Upload your image as in Path A, then press
**▶ START LIVE MAP** and draw only **🧱 Wall** and **🚪 Door** over it — no terrain painting. Walls
are invisible to players, so your art shows through untouched while fog, line of sight and doors all
start working. The editor warns that live terrain fights a background photo; that warning is about
_painting_, and this hybrid deliberately skips painting.

**Generate, then make it yours (C then B).** A kicked-in map is an ordinary HeroByte map. Stay in
edit mode after you arrive and move a wall, add a secret door, paint a bloodstain. Nothing about it
is locked.

**Bring any map into the campaign tree.** On the Atlas tab, **+ CREATE NODE** for a place, then
**🔗 Link existing map** to attach a map you built or a background you set up. Kicked-in places,
hand-built places and bought art all sit in the same tree and all travel the same way with
**🚩 TRAVEL**.

**Promise now, build later.** A node with no map yet (**⬒**) costs nothing — it is about a hundred
bytes of _"there is a tavern here."_ Make them freely while planning, and cash one with
**🎲 Generate…** or **🔗 Link existing map** when the party actually walks in.

---

## Side by side

|                         | A — map you have | B — build it     | C — kick it in      |
| ----------------------- | ---------------- | ---------------- | ------------------- |
| Prep time               | a minute         | 10–40 min        | none                |
| Your own art            | yes              | HeroByte's tiles | HeroByte's tiles    |
| Fog of war              | not until walls  | yes              | yes, on by default  |
| Doors that open         | not until walls  | yes              | yes                 |
| Lighting and shadows    | not until walls  | yes              | yes                 |
| Exactly what you wanted | yes              | yes              | close, and editable |
| Works mid-session       | yes, a bit slow  | not really       | that is the point   |

---

## A worked evening

Your party is in a port town. You have a lovely bought map of the harbour, so that is **Path A** —
uploaded and aligned before the session, five minutes.

They decide to rob a warehouse you never wrote. **Path C**: G, _"Kestrel & Sons"_, building →
warehouse → medium, ROLL. Four seconds later everyone is standing inside the door in the dark,
because you had already set **Table Sight Default** to 30 ft. Crates, a light per room, a key
telling you what is in the back office.

They find a hatch. G again — dungeon, stone, small — and now the cellar hangs under the warehouse
which hangs under the harbour.

Next week you know they are heading for the smuggler king's vault, and you care about that fight. So
you spend twenty minutes in **Path B** building it properly, with a secret door and a light that
only reaches half the room, and **🔗 Link existing map** hangs it under the cellar.

Three workflows, one campaign tree, one evening.

---

## It is your table

Nothing above is a requirement. Run a whole campaign on downloaded PNGs and never open the editor.
Build every room by hand because you enjoy it. Generate everything and never draw a wall. Use fog or
leave it off. Use the Atlas or ignore it and swap backgrounds by hand.

HeroByte's job is to have the tool ready when you want it, and to stay out of the way when you
don't.
