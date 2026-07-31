# HeroByte User Guide

HeroByte is a retro-inspired virtual tabletop (VTT) that runs entirely in the browser: roll dice, move tokens, draw on the map, talk over voice chat, and — as the Dungeon Master — build the battlemap live while your party watches it appear.

This guide walks through everything a player or a DM needs, with screenshots from the real app.

| Guide | Who it's for | What it covers |
| --- | --- | --- |
| [Getting Started](getting-started.md) | Everyone | Joining a table, private tables and invite links, becoming the DM |
| [Player Guide](player-guide.md) | Players | The table UI, your character card, tokens, dice, drawing, voice, doors and fog, mobile |
| [DM Guide](dm-guide.md) | Dungeon Masters | The DM Menu, map setup, NPCs and props, initiative and combat, session save/load, table security |
| [Map Editor Guide](map-editor-guide.md) | Dungeon Masters | The live map editor: rooms, halls, doors, terrain painting, props, lighting, the dungeon generator |

**Self-hosting or deploying?** See the repo-level [README](../../README.md) for the quick start and [DEPLOYMENT.md](../../DEPLOYMENT.md) for production hosting (Render + Cloudflare Pages, persistent-disk setup, and every environment variable).

## A note on words

- A **table** is one shared game space — everyone at the same table sees the same map, tokens, and dice rolls. (The code and server APIs call tables "rooms"; the UI always says table.)
- The **Main Hall** is the default table every server starts with. It's a **public scratch space**: its password is the documented default, and it wipes itself once it has sat empty. Real games belong on a [private table](getting-started.md#creating-a-private-table).
- The **DM** (Dungeon Master) is a player who has elevated with the DM password. The DM gets extra tools: the DM Menu, the live map editor, fog of war, and the player-view lens.

## Screenshots

Every screenshot in these guides is captured automatically from a real running app by the documentation harness:

```bash
pnpm docs:screenshots
```

If the UI changes, re-running that one command re-records every image in `docs/user-guide/img/`.
