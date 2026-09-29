// Setup for the U7 Party journeys: a disposable private table (so the party is
// exactly what the spec builds), a DM elevated through the real UI, and a
// player in a separate browser context. Wire messages through the dev seam are
// SETUP only — every behaviour under test is driven through the page.

import { expect, type Locator, type Page } from "@playwright/test";
import { openOwnCharacterSettings, partyInspector } from "./party.helpers";

const TABLE_PASSWORD = "U7-local-table-password";
const DM_PASSWORD = "U7-local-dm-password";

type Seam = {
  uid?: string;
  snapshot?: {
    players: { uid: string; name: string; isDM?: boolean }[];
    characters: {
      id: string;
      name: string;
      type: string;
      ownedByPlayerUID?: string | null;
      tokenId?: string | null;
      hp?: number;
      statusEffects?: string[];
    }[];
    tokens: { id: string; x: number; y: number; owner?: string }[];
    playerPropsEnabled?: boolean;
  };
  cam?: { x: number; y: number; scale: number };
  gridSize?: number;
  sendMessage?: (message: unknown) => void;
};

/** Is the local client a DM, by the snapshot the server sent it? */
export const isDM = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    return state?.snapshot?.players.find((p) => p.uid === state.uid)?.isDM === true;
  });

export async function send(page: Page, message: Record<string, unknown>): Promise<void> {
  await page.evaluate((payload) => {
    (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__?.sendMessage?.(payload);
  }, message);
}

async function joined(page: Page): Promise<void> {
  await expect(page.getByTestId("map-board").locator("canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => {
      const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
      return Boolean(state?.uid && state.snapshot);
    },
    undefined,
    { timeout: 20_000 },
  );
}

/** A fresh private table: `dm` creates it and elevates through its own character window. */
export async function createTableAsDM(dm: Page, label: string): Promise<string> {
  await dm.goto("/");
  await dm.getByRole("button", { name: /New Table/i }).click();
  await dm.getByLabel("New table name", { exact: true }).fill(label);
  await dm.getByLabel("New table password", { exact: true }).fill(TABLE_PASSWORD);
  await dm.getByLabel("New DM password", { exact: true }).fill(DM_PASSWORD);
  await dm.getByRole("button", { name: "Create private table", exact: true }).click();
  await joined(dm);
  const settings = await openOwnCharacterSettings(dm);
  await settings.getByRole("button", { name: "DM Mode: OFF", exact: true }).click();
  await dm.getByLabel("Enter DM Password:", { exact: true }).fill(DM_PASSWORD);
  await dm.getByRole("button", { name: "Elevate to DM", exact: true }).click();
  await expect.poll(() => isDM(dm)).toBe(true);
  const close = settings.getByRole("button", { name: /^Close / });
  if (await close.isVisible()) await close.click();
  await expect(settings).toHaveCount(0);
  // Back to the compact roster: the elevation path opened the DM's details.
  await partyInspector(dm)
    .getByRole("button", { name: /^Close .* details$/ })
    .click();
  await expect(partyInspector(dm)).toHaveCount(0);
  return dm.url();
}

export async function joinTable(page: Page, roomUrl: string): Promise<void> {
  await page.goto(roomUrl);
  await page.getByPlaceholder("Table password").fill(TABLE_PASSWORD);
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await joined(page);
}

/** A second DM on the same table (a co-DM): setup, by message, with the table's DM password. */
export async function elevateBySeam(page: Page): Promise<void> {
  await send(page, { t: "elevate-to-dm", dmPassword: DM_PASSWORD });
  await expect.poll(() => isDM(page)).toBe(true);
}

/** The local client's seat. */
export const uidOf = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__?.uid ?? null,
  );

/** Whose token it is, by the local client's snapshot. */
export const tokenOwner = (page: Page, tokenId: string) =>
  page.evaluate((id) => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    return state?.snapshot?.tokens.find((entry) => entry.id === id)?.owner ?? null;
  }, tokenId);

/** The viewer's own player characters, in creation order. */
export const ownCharacters = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    return (state?.snapshot?.characters ?? []).filter(
      (c) => c.type === "pc" && c.ownedByPlayerUID === state?.uid,
    );
  });

/**
 * Put a token on its own cell. A fresh table has no staging zone, so every
 * token spawns at (0,0): two characters' tokens are stacked, and a Focus that
 * centred the wrong one would still read as centred on the right one.
 */
export async function moveToken(page: Page, tokenId: string, x: number, y: number): Promise<void> {
  await send(page, { t: "move", id: tokenId, x, y });
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
        const token = state?.snapshot?.tokens.find((entry) => entry.id === id);
        return token ? `${token.x},${token.y}` : null;
      }, tokenId),
    )
    .toBe(`${x},${y}`);
}

/**
 * The DM places every NPC's token (setup: the DM menu's PLACE ON MAP, by
 * message). Waits for all `count` NPCs first: a just-sent create-npc may not
 * have reached the snapshot, and "nothing unplaced" must not pass for "done".
 */
export async function placeNpcTokens(dm: Page, count: number): Promise<void> {
  const npcs = () =>
    dm.evaluate(() => {
      const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
      return (state?.snapshot?.characters ?? [])
        .filter((c) => c.type === "npc")
        .map((c) => ({ id: c.id, placed: Boolean(c.tokenId) }));
    });
  await expect.poll(async () => (await npcs()).length).toBe(count);
  for (const npc of await npcs()) {
    if (!npc.placed) await send(dm, { t: "place-npc-token", id: npc.id });
  }
  await expect.poll(async () => (await npcs()).filter((npc) => npc.placed).length).toBe(count);
}

/** The id of the local client's token for a character, by name. */
export const tokenOf = (page: Page, name: string) =>
  page.evaluate((characterName) => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    return state?.snapshot?.characters.find((c) => c.name === characterName)?.tokenId ?? null;
  }, name);

/** Is the camera centred (±1 px) on this token? */
export const centredOn = (page: Page, tokenId: string) =>
  page.evaluate((id) => {
    const state = (window as unknown as { __HERO_BYTE_E2E__?: Seam }).__HERO_BYTE_E2E__;
    const token = state?.snapshot?.tokens.find((entry) => entry.id === id);
    const bounds = document
      .querySelector('[data-testid="map-board"] canvas')
      ?.getBoundingClientRect();
    if (!token || !state?.cam || !bounds) return false;
    const size = state.gridSize ?? 50;
    const x = state.cam.x + (token.x * size + size / 2) * state.cam.scale;
    const y = state.cam.y + (token.y * size + size / 2) * state.cam.scale;
    return Math.abs(x - bounds.width / 2) < 1 && Math.abs(y - bounds.height / 2) < 1;
  }, tokenId);

/**
 * The control, not something over it, takes a click where it sits. It is
 * brought into view as a person would (a roster or card list scrolls), then
 * hit-tested ONCE at its centre: Playwright's trial click retries with other
 * scroll alignments, which can slide a control out from under an overlay and
 * report it clickable where it is actually covered. A script's scroll also
 * moves an overflow:hidden box, which a person cannot scroll, so every box the
 * scroll moved must be one a person can.
 */
export async function takesItsOwnClick(control: Locator): Promise<void> {
  const clipped = await control.evaluate((el) => {
    const before = new Map<Element, [number, number]>();
    for (let box = el.parentElement; box; box = box.parentElement) {
      before.set(box, [box.scrollTop, box.scrollLeft]);
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const personCanScroll = (box: Element, overflow: string) =>
      box === document.scrollingElement
        ? overflow !== "hidden" && overflow !== "clip"
        : ["auto", "scroll", "overlay"].includes(overflow);
    return [...before]
      .filter(([box, [top, left]]) => {
        const style = getComputedStyle(box);
        return (
          (box.scrollTop !== top && !personCanScroll(box, style.overflowY)) ||
          (box.scrollLeft !== left && !personCanScroll(box, style.overflowX))
        );
      })
      .map(([box]) => box.outerHTML.slice(0, 120));
  });
  expect(clipped, "reached only by scrolling a box a person cannot scroll").toEqual([]);
  const hit = await control.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      inView: x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight,
      own: top !== null && (top === el || el.contains(top)),
      top: top?.outerHTML.slice(0, 160) ?? null,
    };
  });
  expect(hit.inView, "the control's centre is on screen").toBe(true);
  expect(hit.own, `covered by ${hit.top}`).toBe(true);
}

/** Do two elements' boxes overlap at all? Both must be rendered. */
export async function overlaps(a: Locator, b: Locator): Promise<boolean> {
  const [boxA, boxB] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  // A missing box is not "no overlap": it is a missing element.
  if (!boxA || !boxB) throw new Error("overlaps: an element is not rendered");
  return !(
    boxA.x + boxA.width <= boxB.x ||
    boxB.x + boxB.width <= boxA.x ||
    boxA.y + boxA.height <= boxB.y ||
    boxB.y + boxB.height <= boxA.y
  );
}

/** Where the map's band sits: its share of the viewport, the panel's top, the board's bottom. */
export const mapBand = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector('[role="group"][aria-label="Play tools"]');
    let fixed: Element | null = header;
    while (fixed && getComputedStyle(fixed).position !== "fixed") fixed = fixed.parentElement;
    const panel = document.querySelector(".party-panel")!.getBoundingClientRect();
    const board = document.querySelector('[data-testid="map-board"]')!.getBoundingClientRect();
    const headerBottom = fixed!.getBoundingClientRect().bottom;
    return {
      share: (panel.top - headerBottom) / window.innerHeight,
      panelTop: panel.top,
      boardBottom: board.bottom,
    };
  });

/** A table with a DM and a player who owns a second character, "Companion". */
export async function partyTable(dm: Page, player: Page, label: string) {
  const roomUrl = await createTableAsDM(dm, label);
  await joinTable(player, roomUrl);
  await send(player, { t: "add-player-character", name: "Companion", maxHp: 100 });
  // Both characters, each with its own token (the server tokens every one).
  await expect
    .poll(async () => (await ownCharacters(player)).filter((c) => c.tokenId).length)
    .toBe(2);
  const [first, second] = await ownCharacters(player);
  // Their own cells, so Focus on one cannot pass for Focus on the other.
  await moveToken(player, second.tokenId!, 4, 3);
  return { roomUrl, first, second };
}
