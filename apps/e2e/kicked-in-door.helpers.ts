// Helpers for the Kicked-In Door journey. Extracted so the spec itself
// stays under the structural ceiling — the spec is the journey, this is the
// plumbing it walks through.

import { expect, type Page } from "./fixtures";

/** ≥9 digits, outside every coordinate and id range (plan §4.2). */
export const SENTINEL_SEED = 987654321987;

export async function waitForSnap<T>(
  page: Page,
  predicate: (arg: T) => boolean,
  arg?: T,
  timeout = 30_000,
) {
  await page.waitForFunction(predicate, arg as T, { timeout });
}

/** The kick panel, opened by the G keystroke — the way a DM opens it. */
export async function openKickByKeystroke(page: Page) {
  // The canvas takes focus first: G is ignored from a typing surface by
  // design, so a spec that types into a field and then presses G proves
  // nothing about the shortcut.
  await page.locator(".konvajs-content").click({ position: { x: 40, y: 40 } });
  await page.keyboard.press("g");
  await expect(page.getByRole("dialog", { name: "Kick in a door" })).toBeVisible({
    timeout: 15_000,
  });
}

export function nodeByName(page: Page, name: string) {
  return page.evaluate(
    (wanted) =>
      window.__HERO_BYTE_E2E__!.snapshot!.atlasNodes!.find((node) => node.name === wanted) as {
        id: string;
        mapDocumentId?: string;
        parentId?: string;
        discovered?: boolean;
      },
    name,
  );
}

/** Bind a fresh document so the table has a scene but NO atlas node — the unadopted origin. */
export async function startLiveMap(page: Page, documentId: string, name: string) {
  await page.evaluate(
    ({ documentId, name }) => {
      const data = window.__HERO_BYTE_E2E__!;
      data.sendMessage!({ t: "map-studio-create", document: { id: documentId, name } });
      data.sendMessage!({ t: "map-studio-set-live", documentId });
    },
    { documentId, name },
  );
  await waitForSnap(
    page,
    (id) => window.__HERO_BYTE_E2E__?.snapshot?.compiledScene?.sourceDocumentId === id,
    documentId,
  );
}
