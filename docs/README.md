# HeroByte Documentation

Start here. Everything below is grouped by who needs it.

## 🎲 Playing HeroByte

**[The User Guide](user-guide/README.md)** — the full walkthrough, with screenshots from the real app.

| Guide | What it covers |
| --- | --- |
| [Getting Started](user-guide/getting-started.md) | Joining a table, private tables & invite links, becoming the DM |
| [Player Guide](user-guide/player-guide.md) | The table UI, your character card, tokens, dice, drawing, voice chat, fog & doors, mobile play |
| [DM Guide](user-guide/dm-guide.md) | The DM Menu: map setup, NPCs & props, combat, session save/load, table security, the player lens |
| [Map Editor Guide](user-guide/map-editor-guide.md) | Live map authoring: rooms, halls, doors, terrain painting, lighting, set dressing, the dungeon generator |

## 🖥️ Running a server

| Doc | What it covers |
| --- | --- |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Production hosting (Render + Cloudflare Pages), persistent disk, the full environment-variable reference |
| [CLOUDFLARE_PAGES_DEPLOYMENT.md](../CLOUDFLARE_PAGES_DEPLOYMENT.md) | Cloudflare Pages checklist |
| [QUICK_REFERENCE.md](../QUICK_REFERENCE.md) | Passwords, session save/load, and troubleshooting cheat sheet |
| [PORT_MANAGEMENT.md](../PORT_MANAGEMENT.md) | Dev/E2E port conflicts and the doctor/free scripts |
| [DEMO_SERVER_WORKFLOW.md](DEMO_SERVER_WORKFLOW.md) | Running a shared demo server: passwords, cleanup between groups |
| [playtest-setup-guide.md](playtest-setup-guide.md) | Pre-game checklist for hosting a playtest session |
| [ROOM_AUTH_FLOW.md](../ROOM_AUTH_FLOW.md) | How table and DM authentication work end to end |
| [SECURITY_REQUIREMENTS.md](../SECURITY_REQUIREMENTS.md) | Security posture and hardening requirements |

## 🛠️ Contributing

| Doc | What it covers |
| --- | --- |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | How to propose and land a change |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | Branching, naming, day-to-day workflow |
| [TESTING.md](TESTING.md) | What's tested and how to run it |
| [testing-architecture.md](testing-architecture.md) | How 6,700+ tests stay fast: batching, suite patterns, parallelism |
| [TEST_QUALITY_GUIDELINES.md](TEST_QUALITY_GUIDELINES.md) | Test quality standards |
| [guides/CODE_REVIEW_CHECKLIST.md](guides/CODE_REVIEW_CHECKLIST.md) | Review checklist |
| [guides/PREVENTING_GOD_OBJECTS.md](guides/PREVENTING_GOD_OBJECTS.md) | Keeping modules under the 350-LOC guardrail |
| [pushing-to-github.md](pushing-to-github.md) | Git workflow notes |
| [player-snapshot-schema.md](player-snapshot-schema.md) | The privacy-filtered snapshot players receive |

**Screenshots in the user guide are generated, not hand-taken.** After any UI
change, re-record them from a live app in one command:

```bash
pnpm docs:screenshots
```

## 🗺️ Roadmap & history

| Doc | What it covers |
| --- | --- |
| [VISION.md](../VISION.md) | Where HeroByte is going |
| [TODO.md](../TODO.md) | Phased roadmap and contributor priorities |
| [DONE.md](../DONE.md) | Archive of completed phases |
| [CHANGELOG.md](../CHANGELOG.md) | Release history |
| [TECHNICAL_DEBT.md](../TECHNICAL_DEBT.md) | Known debt and cleanup candidates |

## 📁 Archives

These folders hold working notes kept for provenance — useful for understanding
why something is built the way it is, but not maintained as current reference:

- **[planning/](planning/)** — design docs and arc plans (the renderer/art-technique
  catalogs, the live map toolbar plan, dungeon recipes, lighting arcs)
- **[refactoring/](refactoring/)** — refactor plans and completion reports
- **[research/](research/)** — feature research spikes
- **[testing/](testing/)** — test migration notes
- **[manual-test-reports/](manual-test-reports/)** — historical manual QA runs
