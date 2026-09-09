import { expect, test } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import {
  SENTINEL_SEED,
  nodeByName,
  openKickByKeystroke,
  startLiveMap,
  waitForSnap,
} from "./kicked-in-door.helpers";

// VISION's Signature Move 1, end to end: a DM standing on a table that is not
// on the Atlas at all presses ONE key, names the place, and rolls — and the
// whole table is standing inside a generated building, under fog, with a door
// back. The table itself becomes the campaign's first node on the way.
//
// What only THIS spec proves, over the unit and contract suites: that the
// keystroke reaches a real browser (the first bare-letter shortcut in the
// suite), that the panel's fields are the ones a DM actually fills, that the
// adoption and both doors survive the round trip through the wire, and that
// the player's socket carries none of it but the names they are meant to see.
//
// Secrecy is asserted on KEYS, never on value substrings — a decimal seed
// inside epoch-millisecond soup is the CI #828 false-positive shape — with one
// exception: a ≥9-digit sentinel seed, which no uuid or timestamp reproduces,
// checked with the DM's own frame as the positive control.

test.describe("Kicked-In Door smoke", () => {
  test("G on an unadopted table adopts it, builds a tavern, lands the party inside, and the door leads home", async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    const dmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const dm = await dmContext.newPage();
    const player = await playerContext.newPage();
    // Every window.confirm on this journey (the return door's travel) is a yes.
    let confirms = 0;
    dm.on("dialog", (dialog) => {
      confirms += 1;
      void dialog.accept();
    });

    try {
      await joinDefaultRoomAsDM(dm);
      // The entities panel overlays the BOTTOM of the canvas while the canvas
      // box still spans the full board — so a click aimed at the canvas centre
      // can land on the panel instead of the map. Collapse it before anything
      // in this journey clicks the map.
      await dm.getByRole("button", { name: /HIDE ENTITIES/i }).click();
      await expect(dm.getByRole("button", { name: /SHOW ENTITIES/i })).toBeVisible();
      await startLiveMap(dm, "kick-journey-origin", "The Harbour Road");
      await joinDefaultRoom(player);
      await waitForSnap(player, () =>
        Boolean(window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId),
      );

      // A drawing on the origin: the mark that must survive the round trip.
      await dm.evaluate(() => {
        window.__HERO_BYTE_E2E__!.sendMessage!({
          t: "draw",
          drawing: {
            id: "kick-journey-mark",
            type: "freehand",
            points: [
              { x: 120, y: 120 },
              { x: 200, y: 200 },
            ],
            color: "#ff0",
            width: 4,
            opacity: 1,
          },
        } as never);
      });
      await waitForSnap(dm, () =>
        Boolean(
          window.__HERO_BYTE_E2E__?.snapshot?.drawings?.some((d) => d.id === "kick-journey-mark"),
        ),
      );

      // ---- The kick: one keystroke, the panel, ROLL ----
      await openKickByKeystroke(dm);
      const panel = dm.getByRole("dialog", { name: "Kick in a door" });
      await panel.getByLabel("Name").fill("Cellar");
      await panel.getByLabel("Recipe").selectOption("building");
      await panel.getByLabel("Kind").selectOption("tavern");
      await panel.getByLabel("Size").selectOption("small");
      await panel.getByLabel("Seed").fill(String(SENTINEL_SEED));
      await panel.getByRole("button", { name: "🚪 ROLL" }).click();
      // The panel closes on ROLL; the table arrives moments later.
      await expect(panel).toBeHidden();

      await waitForSnap(dm, () => {
        const data = window.__HERO_BYTE_E2E__;
        const here = data?.snapshot?.atlasNodes?.find(
          (node) => node.id === data.snapshot?.currentAtlasNodeId,
        );
        return here?.name === "Cellar";
      });

      const cellar = await nodeByName(dm, "Cellar");
      const origin = await nodeByName(dm, "The Harbour Road");

      // ---- The table adopted itself, and the child hangs under it ----
      expect(origin, "the live document became the campaign's first node").toBeTruthy();
      expect(origin.mapDocumentId).toBe("kick-journey-origin");
      expect(origin.discovered).toBe(true);
      expect(cellar.parentId).toBe(origin.id);

      // ---- The party is inside the entrance, under fog, with two doors ----
      const arrived = await dm.evaluate(() => {
        const snapshot = window.__HERO_BYTE_E2E__!.snapshot!;
        const zone = snapshot.playerStagingZone!;
        const players = new Set(
          snapshot.players.filter((entry) => !entry.isDM).map((entry) => entry.uid),
        );
        return {
          fog: snapshot.fogEnabled,
          links: snapshot.atlasLinks!.length,
          zone,
          party: snapshot.tokens
            .filter((token) => players.has(token.owner))
            .map((token) => ({ x: token.x, y: token.y })),
          doors: snapshot.compiledScene!.doors.length,
        };
      });
      expect(arrived.fog).toBe(true);
      expect(arrived.links).toBe(2);
      expect(arrived.doors).toBeGreaterThan(0);
      expect(arrived.party.length).toBeGreaterThan(0);
      for (const token of arrived.party) {
        // Cells are fractional inside the zone: half a cell of tolerance on
        // each side is the staging-zone convention itself.
        expect(Math.abs(token.x - arrived.zone.x)).toBeLessThanOrEqual(
          arrived.zone.width / 2 + 0.5,
        );
        expect(Math.abs(token.y - arrived.zone.y)).toBeLessThanOrEqual(
          arrived.zone.height / 2 + 0.5,
        );
      }

      // ---- The player's wire: the names they should see, and nothing else ----
      await waitForSnap(
        player,
        (docId) => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId === docId,
        cellar.mapDocumentId,
      );
      const playerWire = await player.evaluate(() => {
        const snapshot = window.__HERO_BYTE_E2E__!.snapshot!;
        return {
          names: snapshot.atlasNodes!.map((node) => node.name).sort(),
          keySets: snapshot.atlasNodes!.map((node) => Object.keys(node).sort()),
          linkKeySets: snapshot.atlasLinks!.map((link) => Object.keys(link).sort()),
          raw: JSON.stringify(snapshot),
        };
      });
      expect(playerWire.names).toEqual(["Cellar", "The Harbour Road"]);
      // The child carries a parentId (its parent is discovered); the origin is
      // a root. Nothing else — no recipe, no arrival, no mapDocumentId.
      expect(playerWire.keySets).toContainEqual(["discovered", "id", "kind", "name", "parentId"]);
      expect(playerWire.keySets).toContainEqual(["discovered", "id", "kind", "name"]);
      for (const key of ['"recipe"', '"arrival"', '"sceneStates"', '"doorStates"']) {
        expect(playerWire.raw, `${key} reached a player's frame`).not.toContain(key);
      }
      // The seed by VALUE, which only a ≥9-digit sentinel makes safe.
      expect(playerWire.raw).not.toContain(String(SENTINEL_SEED));
      // Both doors reached the player, and both name where they lead: the
      // origin and the child are BOTH discovered.
      expect(playerWire.linkKeySets).toHaveLength(2);
      for (const keys of playerWire.linkKeySets) {
        expect(keys).toEqual(["anchor", "fromNodeId", "id", "linkType", "toNodeId"]);
      }
      // The positive control: the DM's own frame DOES carry the seed, so the
      // absence above is evidence rather than a search that cannot find.
      const dmRaw = await dm.evaluate(() => JSON.stringify(window.__HERO_BYTE_E2E__!.snapshot));
      expect(dmRaw).toContain(String(SENTINEL_SEED));

      // ---- The player's world map names both places ----
      await player.getByRole("button", { name: "🗺 WORLD" }).click();
      await expect(player.getByLabel("you are here: Cellar")).toBeVisible();
      await expect(player.getByLabel("The Harbour Road", { exact: true })).toBeVisible();

      // ---- The return door leads home, and home is as it was left ----
      // Step the party off the doorway first. placeArrivals spreads tokens
      // RANDOMLY inside the arrival zone and the return door sits on that
      // zone's edge, so a token lands on the sprite's cell about half the
      // time — and a token is draggable, so it wins the press. (That is why
      // this failed one run in two until it was instrumented: the projection
      // was landing exactly on the anchor and the click was hitting a token.)
      // A DM would simply drag the character aside; the spec does the same —
      // for EVERY token, the DM's own included. The DM's token travels with
      // the party and is spread into the same zone, and moving only the
      // players' tokens left it as a coin-flip hazard on the door's cell
      // (surfaced when a new spec ahead of this one shifted the spread).
      const targets = await dm.evaluate(() => {
        const data = window.__HERO_BYTE_E2E__!;
        const moved: Record<string, number> = {};
        for (const token of data.snapshot!.tokens) {
          moved[token.id] = token.y - 4;
          data.sendMessage!({ t: "move", id: token.id, x: token.x, y: moved[token.id] } as never);
        }
        return moved;
      });
      // The move rides the delta channel; wait for the SPRITES to have left,
      // not a fixed time — the click below hits whatever is drawn there.
      expect(Object.keys(targets).length, "nothing to step aside").toBeGreaterThan(0);
      await dm.waitForFunction((moved) => {
        const objects = window.__HERO_BYTE_E2E__!.snapshot!.sceneObjects ?? [];
        return Object.entries(moved).every((entry) => {
          const object = objects.find((candidate) => candidate.id === `token:${entry[0]}`);
          return object !== undefined && Math.abs(object.transform.y - entry[1]) < 1e-6;
        });
      }, targets);

      // Put the return door's anchor at the CENTRE of the canvas and click
      // there, rather than projecting the anchor to a screen point: the camera
      // moves on arrival (it focuses the entrance), and a projection computed
      // against a camera that is still easing lands on empty floor.
      const canvas = dm.locator(".konvajs-content");
      const box = (await canvas.boundingBox())!;
      await dm.evaluate(
        ({ childId, w, h }) => {
          const data = window.__HERO_BYTE_E2E__!;
          const link = data.snapshot!.atlasLinks!.find((entry) => entry.fromNodeId === childId)!;
          const scale = data.cam!.scale;
          data.setCam!({
            x: w / 2 - link.anchor.x * scale,
            y: h / 2 - link.anchor.y * scale,
            scale,
          });
        },
        { childId: cellar.id, w: box.width, h: box.height },
      );
      // Guard the aim: a click point the panel or the header covers is a click
      // on the panel, and the failure looks like "the door did not work".
      const target = { x: box.width / 2, y: box.height / 2 };
      const onTop = await dm.evaluate(({ x, y }) => {
        const canvasBox = document
          .querySelector<HTMLElement>(".konvajs-content")!
          .getBoundingClientRect();
        const el = document.elementFromPoint(canvasBox.left + x, canvasBox.top + y);
        return el?.tagName ?? "NONE";
      }, target);
      expect(onTop, "something is covering the point the return door was clicked at").toBe(
        "CANVAS",
      );

      // Konva rebuilds its HIT graph on a DRAW, which follows React's
      // re-render — so the anchor being under the cursor does not yet mean the
      // sprite can be hit, and the page exposes no Konva handle to wait on.
      // (Instrumenting this showed the projection landing EXACTLY on the click
      // point while the click still hit nothing, once in three runs.) So the
      // click is retried until the sprite answers: a miss lands on empty floor
      // and does nothing, and a genuinely broken door still fails here after
      // every attempt.
      const confirmsBefore = confirms;
      let attempts = 0;
      while (confirms === confirmsBefore && attempts < 5) {
        attempts += 1;
        await canvas.click({ position: target });
        await dm.waitForTimeout(700);
      }
      expect(confirms, "the return door never asked to travel").toBeGreaterThan(confirmsBefore);

      await waitForSnap(
        dm,
        (docId) => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId === docId,
        "kick-journey-origin",
      );
      // The origin RESUMED: the drawing made before the kick is still there.
      expect(
        await dm.evaluate(() =>
          Boolean(
            window.__HERO_BYTE_E2E__?.snapshot?.drawings?.some((d) => d.id === "kick-journey-mark"),
          ),
        ),
      ).toBe(true);

      // ---- A second kick, this time from an ALREADY adopted origin ----
      await openKickByKeystroke(dm);
      const second = dm.getByRole("dialog", { name: "Kick in a door" });
      await second.getByLabel("Name").fill("Undervault");
      await second.getByLabel("Recipe").selectOption("dungeon");
      await second.getByLabel("Size").selectOption("small");
      await second.getByRole("button", { name: "🚪 ROLL" }).click();
      await waitForSnap(dm, () => {
        const data = window.__HERO_BYTE_E2E__;
        const here = data?.snapshot?.atlasNodes?.find(
          (node) => node.id === data.snapshot?.currentAtlasNodeId,
        );
        return here?.name === "Undervault";
      });
      const undervault = await nodeByName(dm, "Undervault");
      // The SAME origin took the second child — nothing was adopted twice.
      expect(undervault.parentId).toBe(origin.id);
      expect(await dm.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.atlasNodes!.length)).toBe(
        3,
      );
      expect(await dm.evaluate(() => window.__HERO_BYTE_E2E__!.snapshot!.atlasLinks!.length)).toBe(
        4,
      );
    } finally {
      await dm
        .evaluate(() => {
          const data = window.__HERO_BYTE_E2E__;
          if (!data?.snapshot) return;
          for (const link of data.snapshot.atlasLinks ?? []) {
            data.sendMessage!({ t: "atlas-delete-link", linkId: link.id });
          }
          for (const node of data.snapshot.atlasNodes ?? []) {
            const documentId = (node as { mapDocumentId?: string }).mapDocumentId;
            data.sendMessage!({ t: "atlas-delete-node", nodeId: node.id });
            if (documentId) {
              data.sendMessage!({ t: "map-studio-delete", documentId });
            }
          }
        })
        .catch(() => undefined);
      await dmContext.close();
      await playerContext.close();
    }
  });
});
