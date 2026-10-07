// Shared by the voice specs (desktop and phone): what "this browser hears N people" means.

import { expect, type Page } from "@playwright/test";

/**
 * People this browser is connected to AND playing a live voice from: an unpaused <audio>
 * per person fed by a live remote track, capped by the connections its voice control
 * counts as up. Whether sound actually flows is not measured (a fake mic's tone would need
 * an analyser on the receiving side).
 */
export async function hearing(page: Page): Promise<number> {
  return page.evaluate(() => {
    const playing = [
      ...document.querySelectorAll<HTMLAudioElement>("audio[data-voice-peer]"),
    ].filter(
      (audio) =>
        !audio.paused &&
        Boolean(
          (audio.srcObject as MediaStream | null)
            ?.getAudioTracks()
            .some((track) => track.readyState === "live"),
        ),
    ).length;
    const control = document.querySelector('[aria-label="Voice chat"][data-voice-connected]');
    const connected = Number(control?.getAttribute("data-voice-connected") ?? 0);
    return Math.min(playing, connected);
  });
}

export async function expectHearing(page: Page, count: number): Promise<void> {
  await expect.poll(() => hearing(page), { timeout: 20_000 }).toBe(count);
}

/** Still hearing exactly `count` at every check for `ms` (a dropped call would dip). */
export async function expectHearingHolds(page: Page, count: number, ms = 2_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    expect(await hearing(page)).toBe(count);
    await page.waitForTimeout(100);
  }
}
