import { expect, test, type Page } from "./fixtures";
import { identity, readState } from "./chat-journey.helpers";
import { createAndJoin, mapContent, observeWire, publicBarrier } from "./u2-cancel.helpers";

async function tableContent(page: Page) {
  const { snapshot } = await readState(page);
  return {
    map: await mapContent(page),
    atlasNodes: snapshot.atlasNodes,
    atlasLinks: snapshot.atlasLinks,
    currentAtlasNodeId: snapshot.currentAtlasNodeId,
  };
}

test("U2 desktop DM Atlas → Kick closes the foreground first without losing the DM draft", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(150_000);
  const dmContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  const playerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  });
  const dm = await dmContext.newPage();
  const player = await playerContext.newPage();
  const dmWire = observeWire(dm);
  const playerWire = observeWire(player);
  try {
    await createAndJoin(dm, player, false, "U2 DM Kick layer");
    const pages = [dm, player];
    const before = await Promise.all(pages.map(tableContent));
    const mutationCommands = () =>
      [...dmWire.sent, ...playerWire.sent].filter(
        ({ t }) =>
          t.startsWith("atlas-") ||
          (t.startsWith("map-studio-") && t !== "map-studio-list" && t !== "map-studio-get") ||
          t.includes("drawing"),
      );
    const commandsBefore = mutationCommands().length;
    const launcher = dm.getByRole("button", { name: /DM MENU/ });
    const closeDM = dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true });
    await launcher.click();
    await dm.getByRole("button", { name: "World", exact: true }).click();
    const draft = dm.getByLabel("New location name", { exact: true });
    await draft.fill("Retained unsent Atlas draft");

    // Put the real draggable DM window beneath Kick's centered form, so the
    // browser verifies actual paint/hit order as well as keyboard ownership.
    // The elevation toast initially covers this title bar; wait for its real
    // dismissal before dragging, then prove the window actually moved.
    await expect(dm.getByText(/DM elevation successful!/)).toHaveCount(0);
    const titleBar = closeDM.locator("..");
    const titleBox = await titleBar.boundingBox();
    expect(titleBox).not.toBeNull();
    await dm.mouse.move(titleBox!.x + titleBox!.width / 2, titleBox!.y + titleBox!.height / 2);
    await dm.mouse.down();
    await dm.mouse.move(720, titleBox!.y + titleBox!.height / 2, { steps: 8 });
    await dm.mouse.up();
    await expect
      .poll(async () => {
        const box = await titleBar.boundingBox();
        return box ? box.x + box.width / 2 : null;
      })
      .toBeCloseTo(720, 0);
    await dm.getByRole("button", { name: /KICK IN A DOOR/ }).click();
    const kick = dm.getByRole("dialog", { name: "Kick in a door", exact: true });
    const name = kick.getByLabel("Name", { exact: true });
    await expect(kick).toBeVisible();
    await expect(name).toBeFocused();
    await name.fill("Unsent Kick draft");
    const dmBox = await titleBar.locator("..").boundingBox();
    const nameBox = await name.boundingBox();
    expect(dmBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    const fieldCenter = { x: nameBox!.x + nameBox!.width / 2, y: nameBox!.y + nameBox!.height / 2 };
    expect(fieldCenter.x).toBeGreaterThan(dmBox!.x);
    expect(fieldCenter.x).toBeLessThan(dmBox!.x + dmBox!.width);
    expect(fieldCenter.y).toBeGreaterThan(dmBox!.y);
    expect(fieldCenter.y).toBeLessThan(dmBox!.y + dmBox!.height);
    expect(
      await name.evaluate((field) => {
        const box = field.getBoundingClientRect();
        return field.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
      "Kick's Name field must receive pointer input above the overlapping DM window",
    ).toBe(true);
    await info.attach("dm-and-kick-before-Escape.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });

    await name.press("Escape");
    await expect(kick).toHaveCount(0);
    await expect(closeDM).toBeVisible();
    await expect(draft).toHaveValue("Retained unsent Atlas draft");
    await publicBarrier(player, pages, "Kick-only-Escape");
    expect(dmWire.sent.some(({ t }) => t === "elevate-to-dm")).toBe(true);
    expect(playerWire.sent.some(({ t }) => t === "chat")).toBe(true);
    await expect(launcher).not.toBeFocused();
    expect(mutationCommands()).toHaveLength(commandsBefore);
    expect(await Promise.all(pages.map(tableContent))).toEqual(before);
    await info.attach("dm-draft-after-Kick-Escape.png", {
      body: await dm.screenshot(),
      contentType: "image/png",
    });

    await dm.keyboard.press("Escape");
    await expect(closeDM).toHaveCount(0);
    await expect(launcher).toBeFocused();

    // The next higher real owner still wins: Help → Kick → DM.
    await launcher.click();
    await dm.getByRole("button", { name: /KICK IN A DOOR/ }).click();
    await name.fill("Keep under Help");
    const helpLauncher = dm.getByRole("button", { name: "Help", exact: true });
    // Kick intentionally covers part of the header's second row at this width.
    // Reach the real Help button by keyboard rather than clicking through it.
    for (let step = 0; step < 60; step += 1) {
      if (await helpLauncher.evaluate((button) => document.activeElement === button)) break;
      await dm.keyboard.press("Shift+Tab");
    }
    await expect(helpLauncher).toBeFocused();
    await dm.keyboard.press("Enter");
    const help = dm.getByRole("dialog", { name: "HeroByte help", exact: true });
    await expect(help).toBeVisible();
    await dm.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
    await expect(kick).toBeVisible();
    await expect(name).toHaveValue("Keep under Help");
    await expect(closeDM).toBeVisible();
    await dm.keyboard.press("Escape");
    await expect(kick).toHaveCount(0);
    await expect(closeDM).toBeVisible();
    await dm.keyboard.press("Escape");
    await expect(closeDM).toHaveCount(0);
    await expect(launcher).toBeFocused();
    await publicBarrier(player, pages, "Help-Kick-DM-order");
    expect(mutationCommands()).toHaveLength(commandsBefore);
    expect(await Promise.all(pages.map(tableContent))).toEqual(before);
    expect((await identity(dm)).isDM).toBe(true);
    expect((await identity(player)).isDM).toBe(false);
    await expect(player.getByTestId("kick-panel")).toHaveCount(0);
    await expect(player.getByRole("button", { name: /DM MENU/ })).toHaveCount(0);
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
