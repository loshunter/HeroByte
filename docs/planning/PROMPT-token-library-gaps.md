# PROMPT — Token Library gaps, then ship it (dev → main → live)

Written 2026-09-15 by the planning model (Claude Fable 5.1) for the implementing model
(Claude Opus). Read all of it before touching anything. Every claim in §2 carries a file
anchor; verify the anchor at HEAD before trusting a line-level claim.

You are working in `D:\HeroByte` on branch `dev`. The owner has decided: fix the gaps below,
verify the whole ladder, then push `dev`, merge it to `main`, and confirm the live deploy.
`main` IS production (Render + Cloudflare Pages auto-deploy on push; CI does not gate it).

---

## 0. Where things stand, exactly

- `dev` = `985b4747` — 29 commits ahead of `main` = `origin/main` = `origin/dev` = `8e104dc4`.
  Nothing on dev has been pushed. Merging dev→main ships TWO arcs at once:
  1. **The Weighed Campaign** (W0–W3, `006fc724..16cd30e7`): every mint weighs the export it
     would write; three production bugs fixed; two review rounds recorded; live-evaluated 8.5.
  2. **The Token Library** (`5af811ba..985b4747`, 9 commits): Codex's Pixel15 pack 1.0.0 —
     184 monsters + 60 townsfolk at three render tiers under `apps/client/public/tokens/`,
     the DM menu's Library picker (Monsters / Townsfolk / Custom), mimic reveal,
     `create-npc.tokenSize`, and the table's own custom-token shelf (`customTokens`).
     The owner knows both ship together. Do not re-litigate; do not cherry-pick.
- No commit on dev touches `.github/workflows/` (verified with
  `git diff --stat main..dev -- .github/`), so the CLI credential can push. If that changes,
  read `workflow-scope-push-block` in memory before pushing.
- Untracked files that are NOT yours and must NEVER be staged: everything under `temp/`
  (the owner's, including the Codex pack source under `temp/Library`), and
  `apps/server/herobyte-state.json.corrupt` (the dev server rotated its state file during
  an earlier half-applied edit; leave it on disk, mention it in your final report).
- The last full ladder on `985b4747`: lint, format, structure, both typechecks, all three unit
  suites, dev boot — pass; e2e run ALONE — 203 passed / 0 failed / 3 pre-existing skips.
- Still the owner's, not yours: the licence for the pack (they will open-source the images
  later). Do not block on it; name it in the final report.

## 1. The mission

Four gaps were reported when the custom shelf shipped. Fix them as four slices, each its own
commit, each verified, in this order (G1 and G2 share one image pipeline; G3 is CSS; G4 is
the wire change with the widest ripple, so it goes last while the tree is quiet):

| slice  | gap                                                                           | one-line fix                                                                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G1** | a custom image has no 84px thumb — the grid decodes the full image per cell   | at add time, the client draws the image to an 84px canvas and uploads the result as an asset; `CustomToken.thumbUrl`                                                                                   |
| **G2** | an imgur link is only as permanent as imgur                                   | at add time, the client also re-encodes the image to PNG (long side ≤ 1254px) and uploads it; the token's `imageUrl` becomes the upload. Best-effort, opt-out checkbox                                 |
| **G3** | on phones the ✕ on a custom cell grows to the 44px floor and covers the thumb | move the control's styling to a CSS class; under `(pointer: coarse)` it becomes a full-width 44px bar UNDER the cell, not an overlay                                                                   |
| **G4** | custom tokens and townsfolk are ordinary NPCs and the card says **Enemy**     | `disposition: "hostile" \| "neutral" \| "friendly"` on Character / create-npc / update-npc / CustomToken; the pack's civilians are born neutral; the card shows Enemy / Neutral / Ally with its colour |

Then **G5 — ship**: the full ladder, live evaluation with two clients, a bounded adversarial
review, push dev, CI, merge to main, CI, deploy probe, deploy record. §6 is the runbook.

Scope rule: the four fixes and the deploy. No unrequested extensions. Any pre-existing bug you
hit gets its own commit (the owner's standing rule) — never a silent deferral.

## 2. Recon already banked (verify anchors at HEAD)

**The shelf (what G1–G4 build on):**

- Shared: `packages/shared/src/index.ts` — `CustomToken` (id, name, imageUrl, description?,
  tags, size, addedBy, addedAt), `RoomSnapshot.customTokens?` (DM recipients only),
  `add-custom-token` / `remove-custom-token`; `packages/shared/src/customTokenLimits.ts` —
  `CUSTOM_TOKEN_LIMITS` (NAME_MAX 50, DESCRIPTION_MAX 300, TAG_MAX 24, TAGS_MAX 12,
  URL_MAX 2048, COUNT_MAX 200). Shared runtime constants MUST live in a sub-module and be
  value-re-exported from the barrel (memory `shared-barrel-no-runtime-const`): a bare
  `export const` in `index.ts` is erased for the server and every gate stays green while
  `pnpm dev` cannot boot. Boot the dev server after adding any shared constant.
- Server: `apps/server/src/domains/customToken/service.ts` (60 LOC: `normalizeTags`, `add`,
  `remove`), `apps/server/src/middleware/validators/customTokenValidators.ts` (60 LOC:
  `isCustomTokenImageUrl` = `https://…` or a same-site `/path`; anything else refused),
  `apps/server/src/ws/handlers/CustomTokenMessageHandler.ts` (41),
  `apps/server/src/ws/dispatchers/CustomTokenDispatcher.ts`, wired in
  `apps/server/src/ws/messageRouter.ts` after PropDispatcher; DM-only in
  `apps/server/src/ws/services/AuthorizationService.ts`; `coerceCustomTokens` in
  `apps/server/src/domains/room/persistence/loadCoercions.ts`, used by BOTH
  `StatePersistence.ts` (348 LOC — at the ceiling, do not grow it) and
  `snapshot/SnapshotLoader.ts`; `SNAPSHOT_LIMITS.customTokens: 200` in
  `middleware/validators/sessionValidators.ts`. Asset reclaim finds `/assets/<hash>` inside
  `customTokens` by regex over the serialized state — a new `thumbUrl` field is covered
  automatically; PROVE it with the existing reclaim test pattern
  (`apps/server/src/domains/assets/assetReferences.ts` and its tests).
- Client: `apps/client/src/features/dm/hooks/useCustomTokens.ts` (54 LOC: `addToken(draft)`
  sends the message, `removeToken(id)`), `features/dm/token-library/customTokensContext.tsx`
  (`CustomTokenDraft`, `CustomTokensApi`, provider), `CustomTokenForm.tsx` (261 LOC:
  ImageField "Image", Name, Size, Description, Tags box + KIND_TAGS / ANCESTRY_TAGS chips,
  "＋ Add to library"), `TokenLibrary.tsx` (310 LOC: the Custom chip, `customCellStyle`,
  `badgeStyle` MINE, `removeStyle` ✕ at lines ~254–290, `remove(item)` with
  `window.confirm`), `tokenCatalog.ts` (210 LOC: `LibraryItem` {imageUrl, portraitUrl,
  thumbUrl, size, custom}, `packItem`, `customItem` — today `thumbUrl: token.imageUrl`).
  `DMMenuContainer.tsx` owns `useCustomTokens({ snapshot, sendMessage })`; `NPCsTab.tsx`
  (311) provides the context and `handlePickToken(item: LibraryItem)` → `useNpcCreation`
  → `create-npc`; `NPCEditor.tsx` is **344/350** — pass items, never widen its props;
  if a slice must add lines there, first extract something (e.g. `handlePickAsset` into a
  hook) so it stays under 350.
- Uploads: `apps/client/src/components/ui/ImageField.tsx` (223) calls `uploadAssetFile`
  from `features/map-studio/uploads/assetUpload.ts` (`MAX_UPLOAD_BYTES` 5 MiB, accepted
  MIME png/jpeg/gif/webp, `AssetUploadCredentials { secret, roomId? }`, returns
  `{ hash, url: "/assets/<hash>", mime, size, deduplicated }`). Find how ImageField obtains
  its credentials and reuse the same road — do not invent a second one. Server side:
  `apps/server/src/http/routes.ts` `POST /assets` (magic-byte sniff, per-asset cap, per-room
  and total quotas in `domains/assets/quota.ts`, rate limit 30 per window in
  `http/uploadGuards.ts`). Quota errors surface as `AssetUploadError` codes.
- CSP (`apps/client/public/_headers` and `apps/client/index.html`): `img-src 'self' data:
blob: https://media.discordapp.net https://i.imgur.com <server origin>`; `connect-src`
  does NOT include `i.imgur.com`. So **`fetch("https://i.imgur.com/…")` is blocked** —
  the only road to an imgur image's pixels is `new Image()` with `crossOrigin =
"anonymous"` (i.imgur.com sends `Access-Control-Allow-Origin: *`) drawn to a canvas.
  `media.discordapp.net` does not allow CORS: the canvas is tainted and `toBlob` throws a
  `SecurityError` — that is the designed fallback path, not an error to surface loudly.
- E2E: `apps/e2e/token-library.spec.ts` (4 tests; the 4th drives the real form:
  `form.getByRole("textbox", { name: "Image" })`, `getByRole("textbox", { name: "Tags" })`
  — Playwright's `getByLabel` is a SUBSTRING match and the form has a `Chosen tags` group,
  so never `getByLabel("Tags")`). Mobile: `apps/e2e/mobile/mobile-dm.spec.ts` opens the DM
  screen (`elevateToDM`, then the `Mobile actions` nav's `DM` button, dialog `DM Menu`, the
  `NPCs & Monsters` chip); `mobile.helpers.ts` has `joinMobileTable`, `undersizedControls`;
  `mobile-portrait-upload.spec.ts` shows `setInputFiles` with an in-memory PNG buffer. The
  e2e server uses a disposable data directory, so uploads in e2e are isolated.

**The Enemy label (G4):**

- `apps/client/src/features/players/components/NpcCard.tsx` (332 LOC): line ~210 renders the
  literal `Enemy` in `.player-card-role`; the card's tint is hardcoded red (`background:
rgba(40, 9, 15, 0.9)`, `boxShadow … rgba(214, 60, 83, 0.45)`, `tokenColor="#D63C53"` on
  `PortraitSection`). The map token's colour is NOT red — `domains/token/service.ts` mints a
  random HSL per token — so G4 touches the card only, not the map.
- `Character.type: "pc" | "npc"` (`packages/shared/src/index.ts` ~513) is load-bearing in
  ~20 client sites (ordering, movement, redaction, DM menu filters) — **do not add a third
  type**. `disposition` is a separate optional field. `SnapshotCharacter extends
Omit<Character, "hp" | "maxHp" | "tempHp">`, so an optional field rides to players
  automatically; confirm the recipient filter (`domains/room/snapshot/recipientFilter.ts`)
  spreads rather than pick-lists.
- `create-npc` (`index.ts` ~911: name, hp, maxHp, tempHp?, portrait?, tokenImage?,
  tokenSize?, count?) is validated in `middleware/validators/npcValidators.ts` (102 LOC;
  `validateCreateNpcMessage`, `validateUpdateNpcMessage`); `isTokenSize` lives in
  `commonValidators.ts` — put `isNpcDisposition` beside it. The handler is
  `ws/handlers/NPCMessageHandler.ts` (234) → `domains/character/service.ts` (432, already
  over the guard and grandfathered — it may grow; a file that newly CROSSES 350 fails the
  guard, a file already over it in `scripts/structure-baseline.json` does not).
- The pack's catalog entries (`tokenCatalog.generated.ts`) carry `role: "civilian"` for all 60
  townsfolk (tags include `"non-enemy"`); the 184 monsters carry `melee` (125), `caster`
  (21), `leader` (20), `ranged` (13) or `disguise` (5, the mimics). So the rule is exactly
  `role === "civilian"` → neutral; every other role → absent (hostile).
- The floor rule at `herobyte.css` ~1369 lifts `[data-mobile-surface] button, select,
textarea, input:not(range/checkbox/radio)` — the bare ✕ `<button>` is caught by it
  (that is the G3 gap), a `<select>` is lifted (G4's Stance select on the phone is free), and
  a checkbox is NOT (G2's "Keep a copy" checkbox needs its label to be the 44px tap target).

**Deploy facts (G5):** `DEPLOYMENT.md` (repo root) is the reference. CI is
`.github/workflows/ci.yml` (name `CI`, on push and PR to dev and main); `gh` is NOT
installed — the `ci-watcher` agent polls the Actions API with curl. Main moves by a merge
commit titled `Merge dev: <what>` (see `git log --merges main`). Render returns 502 for ~15 s
after a push (restart, not failure). Players must reload after a deploy.

## 3. Traps this arc WILL hit

1. **Two e2e runs on one machine collide.** The second runner's preflight kills the first
   run's servers on 5175/8788; the first run's Playwright then hits the second's server —
   ECONNREFUSED, then a cascade of `POST /__e2e/reset 409 clients are connected`, and
   cross-run tokens (`Player …` plates) failing unrelated mobile specs. Never start
   `pnpm test:e2e` while `gates-runner` is on its e2e rung, and never ask gates-runner for
   a bundle figure AND e2e in one prompt (the extra build clobbers dist mid-run).
2. **TaskStop does not kill a Windows Bash background task's node tree.** If you must abort
   an e2e run: `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match
'run-e2e\.mjs|playwright|start-e2e-server|vite.*preview' }` and `Stop-Process` each.
3. **The e2e seam object is REPLACED per snapshot.** `window.__HERO_BYTE_E2E__` captured
   into a variable never sees a later snapshot — read it fresh inside every `poll`.
4. **A player-tab "missing token" is the vision filter, not a sync bug** — the server strips
   tokens outside a player's sight from the player's snapshot. Move the token beside the
   player, or read the DM tab.
5. **Inline `min-*` or inline `position`/`padding` beats the phone's floor rule.** The 44px
   floor is ONE `(pointer: coarse)` selector list in `apps/client/src/theme/herobyte.css`
   (~line 1348) using `min-height`/`min-width`; a class rule cannot override an inline
   style. G3 must move the ✕'s layout styles OUT of the inline object into a class.
6. **A narrow pane tab mounts the MOBILE shell and keeps it after a resize** — resize the
   pane BEFORE navigating. The pane's `find` names a JRPGButton by its `title`. The pane's
   click coordinates are the LAST SCREENSHOT's frame.
7. **`git checkout --` wipes uncommitted work; a failed commit leaves files staged.** Never
   `git add <dir>` — stage explicit paths and read `git diff --cached --name-only` before
   committing (memory `stage-files-explicitly`: a broad add once deleted an owner's file).
8. **Perl `s{…}{…}` with an unbalanced `{`** in the replacement corrupted two server files
   last session; backticks in a perl replacement run as command substitution. Use the Edit
   tool for edits. The Write tool turns a `\uFEFF` escape into a literal BOM.
9. **A half-applied edit that throws inside `StatePersistence.ts`** makes `tsx watch` rotate
   `apps/server/herobyte-state.json` to `.corrupt` and start EMPTY — the dev table's contents
   are gone. Stop the dev server (or do not have it running) while editing persistence.
10. **New required RoomState/Character fields ripple through hand-built fixtures**
    (4 RoomState literals under `apps/server/src/ws/__tests__/`, the `sceneTravel.contract`
    FIELD_BUCKETS, characterization tests). Keep every new field OPTIONAL and there is no
    ripple; if one is unavoidable, `/fix-fixture-ripple` — never re-pin an assertion.
11. **`pnpm lint` does NOT run the structure guard or format-check the e2e specs and md.**
    The pre-commit list is CI's exact list (§5); `gates-runner` runs it for you.
12. **An e2e that waits for the wrong signal is not a flake.** A flaky e2e exits 0 — read
    the summary LINE (`N passed`, `N failed`), never just the exit code.
13. **Prettier 100 columns**; a long `it(...)` title or a template literal is the usual
    offender. Run `pnpm exec prettier --check <files>` before the gates.
14. **jsdom has no 2D canvas** and no `Image` decoding — G1/G2's pipeline is tested with the
    canvas and Image seams INJECTED (a `deps` parameter), and its real behaviour proved in
    e2e (an upload appears at `/assets/<hash>` and the token's `thumbUrl` points at it).

## 4. Design — settled; implement as written, note deviations in the report

### G1 + G2 — one image pipeline: `prepareCustomImage`

New client module `apps/client/src/features/dm/token-library/customTokenImages.ts`
(≤ 200 LOC), pure and dependency-injected:

```ts
export interface PreparedCustomImage {
  imageUrl: string; // the mirror's /assets/<hash>, or the original when mirroring was off or failed
  thumbUrl?: string; // /assets/<hash> of the 84px render, absent when it could not be made
  mirrored: boolean;
  note?: string; // one line for the form: why a step was skipped (CORS, quota, size)
}
export interface PrepareDeps {
  loadImage(url: string): Promise<HTMLImageElement>; // new Image(), crossOrigin="anonymous", decode()
  toPngBlob(image: HTMLImageElement, maxSide: number): Promise<Blob>; // canvas, contain, smooth
  upload(blob: Blob, name: string): Promise<{ url: string }>; // uploadAssetFile with the field's credentials
}
export async function prepareCustomImage(
  imageUrl: string,
  options: { mirror: boolean },
  deps: PrepareDeps,
): Promise<PreparedCustomImage>;
```

Rules: same-site `/assets/<hash>` uploads are never re-mirrored (they are already ours) but
DO get a thumb; a `/tokens/…` pack path gets neither (the pack has its own tiers — leave it);
an `https://` link gets a thumb always and a mirror when `options.mirror`. The mirror is a
PNG with the long side ≤ 1254 px (the pack's master size); the thumb is 84×84 contain with
smooth scaling (photos, not pixel art). Any thrown step (tainted canvas `SecurityError`,
`AssetUploadError` quota/too-large/rate) degrades: mirror fails → keep the link; thumb fails
→ no `thumbUrl`; never reject. One `loadImage` per add, both blobs from it.

Wire: `CustomToken.thumbUrl?: string`; `add-custom-token.thumbUrl?: string`, validated with
`isCustomTokenImageUrl` and `URL_MAX` exactly like `imageUrl`; `coerceCustomTokens` keeps a
string `thumbUrl`, drops anything else; the service stores it. `customItem()` uses
`token.thumbUrl ?? token.imageUrl` for `thumbUrl`, and `portraitUrl` stays `imageUrl`.

Form: `CustomTokenForm` gains one checkbox, label **"Keep a copy on this table"**, default
ON, shown only while the image value is an `https://` link, with the helper text
_"the link stays if the copy cannot be made"_. `useCustomTokens.addToken` becomes async:
`prepareCustomImage` → send. The button reads "Adding…" while it runs (disable, not spinner);
the note, if any, shows under the form for one add. Credentials: whatever `ImageField` uses.

Tests: unit for `prepareCustomImage` with fake deps (link+mirror; link+no-mirror; upload
throws quota; toPngBlob throws SecurityError; same-site asset; pack path) — prove each can
fail; validator + coercion + service tests for `thumbUrl`; `customItem` prefers `thumbUrl`.
E2E (extend the shelf test in `token-library.spec.ts`, keep it one test): after the add, the
shelf entry's `thumbUrl` matches `/^\/assets\/[a-f0-9]{64}$/`, and a `page.request.get`
of it returns 200 `image/png`; the grid `<img>` for the cell has that `src`. Use the
same-origin `IMAGE` already in the spec (it is a `/tokens/…` path today — switch the
fixture to an uploaded PNG via `setInputFiles` on the form's `Image upload` input so both
the thumb and the "already ours" rule are exercised; the `/tokens/` no-thumb rule gets a unit
test, not e2e). Docs: update "Your own tokens" in `docs/user-guide/dm-guide.md` (~line 65):
a link is copied to the table by default; uncheck to keep only the link.

### G3 — the ✕ becomes a bar on phones

In `TokenLibrary.tsx` give the remove button `className="token-library-remove"` and move
`position/top/right/width/height/padding/fontSize/lineHeight` from `removeStyle` into
`herobyte.css` (keep colours inline or move them too — your call, but LAYOUT must be in the
class). Add, inside the existing `(pointer: coarse)` block scoped to `[data-mobile-surface]`
(find the block that lifts inputs/selects; add next to it, same scoping):

```css
[data-mobile-surface] .token-library-remove {
  position: static;
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
}
```

Keep the glyph and today's `aria-label` (`Remove <name> from the library`) so the existing
e2e's accessible name is unchanged; a bar with a single ✕ is enough. The cell wrap
(`cellWrapStyle`) must be a column flex so the bar sits under the cell, and the MINE badge
stays an overlay (it is `pointer-events: none`, so the floor rule does not touch it).

E2E (new `apps/e2e/mobile/mobile-token-library.spec.ts`, mobile-chromium): 375×812,
`joinMobileTable`, open the DM screen as `mobile-dm.spec.ts` does, chip `NPCs & Monsters`,
`📖 Library`, `Custom`, add one token by the form with the same-origin fixture, then assert
(a) the ✕'s box is ≥ 44 px tall, (b) it does not intersect the cell's `<img>` box, (c)
`undersizedControls(page, '[data-testid="token-library"] button')` is empty; remove it in
`finally`. Prove (b) can fail by temporarily restoring the inline `position: absolute`.

### G4 — disposition

Shared: `export type NpcDisposition = "hostile" | "neutral" | "friendly";` in
`packages/shared/src/index.ts` (a type, so the barrel is fine). `Character.disposition?:
NpcDisposition` (absent = hostile for an NPC; PCs ignore it). `create-npc.disposition?`,
`update-npc.disposition?`, `CustomToken.disposition?`, `add-custom-token.disposition?`.
Validators: `isNpcDisposition` in `commonValidators.ts`; used by `npcValidators.ts` (both)
and `customTokenValidators.ts`. Coercion: `coerceCustomTokens` and whatever coerces
characters on load keep a valid value, drop anything else (do not default to a string —
absent is the default).

Server: `create-npc` handler passes `disposition` through to the character; `update-npc`
sets it when present. The custom-token service stores it.

Client:

- `LibraryItem.disposition?: NpcDisposition`. `packItem`: `role === "civilian"` → `"neutral"`,
  everything else absent (hostile). `customItem`: `token.disposition`.
- `NPCsTab.handlePickToken` forwards `item.disposition` into the create (through
  `useNpcCreation` — add the optional field to its input; do not widen NPCEditor).
- `CustomTokenForm`: a **Stance** select (Hostile / Neutral / Friendly), default derived
  from the kind chips on change — `monster`/`boss` → hostile, `ally` → friendly, any other
  kind chip (`npc`, `traveler`, `villager`, `prop`) → neutral — and freely overridden. The
  draft carries it.
- `NpcCard.tsx`: replace the literal with a small map:
  `{ hostile: { label: "Enemy", ring: "#D63C53", tint: "rgba(40, 9, 15, 0.9)", glow: "rgba(214, 60, 83, 0.45)" }, neutral: { label: "Neutral", ring: "#C9A24E", tint: "rgba(38, 30, 12, 0.9)", glow: "rgba(201, 162, 78, 0.35)" }, friendly: { label: "Ally", ring: "#3FBF6F", tint: "rgba(9, 36, 20, 0.9)", glow: "rgba(63, 191, 111, 0.35)" } }`
  in a sibling module `npcDisposition.ts` (so `NpcCard.tsx` does not grow past 350), read
  as `character.disposition ?? "hostile"`.
- Editing on an existing NPC: a Stance select in the DM's NPC editor. `NPCEditor.tsx` is at
  344 — put the select in a new `NpcStanceSelect.tsx` and mount it in ONE line; if the file
  still crosses 350, first extract `handlePickAsset` into `useNpcAssetPick.ts`. It sends
  `update-npc` with the existing field set plus `disposition`.

Tests: validators (accept the three, reject `"enemy"`, `""`, a number); handler passes it
through; coercion; `packItem` civilian → neutral and a monster → absent; `NpcCard` label per
disposition (existing NpcCard tests show the render pattern); the form's default-from-chips
rule. E2E: extend the townsfolk test in `token-library.spec.ts` — the three blacksmiths are
born `disposition: "neutral"` in the snapshot and the DM's card for one of them reads
`Neutral`; extend the shelf test — a token added with the `ally` chip picks into an NPC whose
card reads `Ally`. Prove both can fail. Docs: one sentence each under "The Library" and
"Your own tokens" in the DM guide; `docs/planning/token-library-codex-request.md` is the
owner's record — do not edit it.

Decision recorded for the owner: a disposition is visible to players (it is the DM's choice
what to set; a disguised enemy is set neutral). Not a secret field — no recipient-filter work.

## 5. Non-negotiables (short form; `docs/planning/HANDOFF-NEXT.md` §8 is the full list)

- **The ladder, in order, before every commit:** `/verify-gates` ("Run the gates." — add
  ` e2e boot` before the LAST commit of each slice and before the push). A gate that reddens
  on a file you do not recognise: check `git status --porcelain` for root-level `??` junk
  first. CI's exact list: shared build, `pnpm lint`, `pnpm format:check`,
  `pnpm lint:structure:enforce`, both typechecks (`tsconfig.typecheck.json` is the client's
  real one), `pnpm test` in shared/server/client, e2e.
- **Prove every new test can fail** (sabotage the code, watch it go red, restore). Never
  re-pin a characterization assertion; a green pin has twice protected a real bug here.
- **Fix bugs you find regardless of origin, each in its own commit.**
- **Every slice ships its mobile surface in the same slice** — G3 is that for the shelf; G4's
  Stance select must be reachable and ≥ 44 px on the phone's DM screen (the floor rule
  covers a `<select>` inside `[data-mobile-surface]` — verify, do not assume).
- **Commits:** explicit paths only; message in the repo's voice (see `git log -12`); end with
  `Co-Authored-By: Claude Opus <noreply@anthropic.com>` — use YOUR model's name.
- **Do not edit** anything under `temp/`, `docs/planning/token-library-codex-request.md`,
  `scripts/structure-baseline.json` (unless a grandfathered file is being split), or the
  generated `tokenCatalog.generated.ts` / `apps/client/public/tokens/**` (the importer
  `scripts/import-token-library.mjs` is the only road in; `--check` reports drift).
- **The 350-LOC guard** is per file; measure with `wc -l` after every edit burst.

## 6. Tooling and the ship runbook

Agents (registered subagent types; all report-only, you fix): `gates-runner` (sonnet,
via `/verify-gates`), `ci-watcher` (haiku, via `/watch-ci`; needs a Bash timeout ≥
660000 ms; writes no files), `fixture-ripple` (sonnet, via `/fix-fixture-ripple`). Skills:
`evaluate-live` (score the RUNNING table with two real clients, FunDM + Fun1 — or it did not
happen), `review-convergence` (bounded adversarial review: agent cap, 3-round cap, plateau
stop, both-must-pass, union not intersection; a review that does not finish has no verdict;
review agents are read-only — `git diff` audit after any errored run, and an errored run's
verdict is void). Dev logins: `FunDM` (DM) and `Fun1` (player); e2e rails on 5175/8788, dev
on 5174/8787. Never run dev servers through Bash — use the Browser pane's `preview_start`.

**Ship runbook (G5) — run in this order, stop at the first red:**

1. `/verify-gates` with "Run the gates. e2e boot" on the final tree → `GATES: PASS`.
2. `evaluate-live`: two clients; exercise the four fixes on the real dev table — a link
   added with the copy on (thumb + mirror in the snapshot), one with it off, an upload, the
   phone shell's ✕ bar at 375 px, a townsfolk pick reading Neutral on the player's card,
   a custom Ally. Screenshots as evidence. Fix what it finds (own commits), re-gate.
3. `review-convergence` on `main..dev` — bounded; fix findings in own commits; re-gate.
   If it plateaus at the cap with open findings, list them in the report and CONTINUE to
   the push — the owner has decided to ship; do not stop for the owner here.
4. `git status --porcelain` shows nothing staged and only the owner's untracked files.
   `git push origin dev` → `/watch-ci` on the dev run → green.
5. **Before the merge — the rollback caveat, found in round 3 of the review.** `main` at
   `8e104dc4` has never had a `customTokens` field. A rollback of main past this merge
   ERASES every custom-token shelf on the first save afterwards (the old loader never reads
   the key, the old writer never writes it, and the 250 ms save debounce fires on any table
   activity), and the asset reclaim sweep then un-claims both hashes per entry and deletes
   the art after its 7-day grace. There is no code fix — it is the nature of adding a
   persisted collection. Mitigation, and the rule from here on: **export a session file
   from every table with a custom shelf before any rollback past this commit**, and know
   that the shelf is still lost on re-import into the old build (`validateLoadSessionMessage`
   ignores an unknown key rather than rejecting it). A new session file into the old server
   also drops `thumbUrl` and `disposition` silently; `characters[].disposition` survives only
   because the old coercion spreads `...character`.
6. Merge: `git checkout main && git pull --ff-only origin main && git merge --no-ff dev -m
"Merge dev: the Weighed Campaign + the Token Library (pack 1.0.0, custom shelf, gaps G1–G4)"`
   then `git push origin main` → `/watch-ci` on the main run → green. `git checkout dev`.
7. Deploy probe (memory `deploy-probe-discriminating-string`): pick a literal present at the
   new main and absent at `8e104dc4` — `"Add to library"` qualifies (`git grep "Add to
library" 8e104dc4` → nothing; at HEAD → the form) — plus a control present in both
   (`"Apply Portrait"`). Fetch the live HTML, extract every `assets/*.js` chunk it references,
   download them all, grep the set: marker ≥ 1, control ≥ 1. Expect a Render 502 for ~15 s;
   poll to 200. Also `GET <live client>/tokens/NPC/Enemies/Goblins/goblinClub.png` → 200
   `image/png` proves the pack deployed. Then a functional check on production with two
   clients if the owner's production table allows it (Fun1/Main Hall is public on purpose).
8. Deploy record: a docs commit on dev (`docs: deploy record — …`, see `0bd19cc9` for the
   shape) naming the main merge sha, the CI run numbers, the probe result, and the open
   items; push dev.

## 7. Prompting the running model — the owner's standing instructions

The owner asked that every handoff carry these. They were written for Fable 5.1; the ones
that are about conduct apply to you (Opus) unchanged: say in a line what you are about to
do, give brief updates, close with a recap that stands alone; batch independent tool calls
(first privately list what you need next, then request every item that does not depend on
another's result in one response); finish the whole task — end your turn only when it is
complete or blocked on input only the owner can give; surgical edits, never whole-file
rewrites; subagents keep working while you do — never poll, never hand-read a journal;
"fix bugs you find regardless of origin" is the repo rule and wins over the generic
"don't fix what the task doesn't mention"; no scratch-test sprawl; density over flourish.
The full text, including the API-level notes that only matter to the human running the
session, is §7 of `docs/planning/PROMPT-kicked-in-door-arc.md` — read it once.

Opus-specific: keep effort high for the whole run; do not lower it for the "mechanical"
slices, because G3's precedence trap and G4's fixture ripple are exactly where a low-effort
pass ships a green build that is wrong on a phone.

## 8. The final report (what the owner reads)

Lead with the outcome: live or not, and the main sha. Then, in this order: the four fixes
(one line each, with what proved them), the ladder results as a table, live-evaluation
findings and what was fixed, review findings open at the plateau (if any), CI run numbers,
the probe result, the deploy record sha, and the items that remain the owner's (the
licence; the `.corrupt` file; anything you deferred with its reason). Numbers in a table,
not prose. No closing offer.
