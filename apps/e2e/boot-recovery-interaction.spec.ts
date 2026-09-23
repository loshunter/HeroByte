/** Terminal CSS failure must stop the mounted table, including body portals. */
import { expect, test, type Page } from "./fixtures";

test.describe("terminal boot interactions", () => {
  test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });

  test("a retained Character portal cannot create a character after terminal failure", async ({
    page,
    browser,
    baseURL,
  }) => {
    const observer = await browser.newPage({ baseURL, serviceWorkers: "block" });
    try {
      await joinTable(observer);
      const commands = observeCommands(page);
      await enterRetryGrace(page);
      await openOwnSettings(page);
      await page.getByRole("button", { name: "➕ Add Character", exact: true }).click();
      const name = page.getByPlaceholder("Enter character name...");
      await name.fill("Terminal portal probe");
      const create = page.getByRole("button", { name: "Create", exact: true });
      await expect(create).toBeEnabled();
      const box = await create.boundingBox();
      expect(box).not.toBeNull();
      await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible();
      await test.info().attach("terminal-character-portal", {
        contentType: "image/png",
        body: await page.screenshot(),
      });
      commands.length = 0;
      // Trusted pointer at the formerly active button, with no force-click on
      // a hidden locator. The stale portal used to remain fully actionable.
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await observeNoReload(page);
      const characterExists = await observer.evaluate(() =>
        window.__HERO_BYTE_E2E__?.snapshot?.characters?.some(
          (character) => character.name === "Terminal portal probe",
        ),
      );
      await test.info().attach("terminal-character-result", {
        contentType: "application/json",
        body: JSON.stringify({ commands, characterExists }),
      });
      expect(commands.filter((command) => command.t === "add-player-character")).toEqual([]);
      expect(characterExists).toBe(false);
      await expect(name).toHaveCount(0);
      await expect(page.locator("#root")).toBeEmpty();
    } finally {
      await observer.close();
    }
  });

  test("terminal failure removes Settings before it can open a late Character portal", async ({
    page,
  }) => {
    await enterRetryGrace(page);
    await openOwnSettings(page);
    const add = page.getByRole("button", { name: "➕ Add Character", exact: true });
    await expect(add).toBeEnabled();
    await add.scrollIntoViewIfNeeded();
    const box = await add.boundingBox();
    expect(box).not.toBeNull();
    await expect(page.getByPlaceholder("Enter character name...")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await observeNoReload(page);
    await test.info().attach("terminal-settings-late-portal", {
      contentType: "image/png",
      body: await page.screenshot(),
    });
    await expect(page.getByPlaceholder("Enter character name...")).toHaveCount(0);
    await expect(page.locator('body > [data-mobile-surface="settings"]')).toHaveCount(0);
  });

  test("a held token drag cannot commit during or after terminal cleanup", async ({
    page,
    browser,
    baseURL,
  }) => {
    const observer = await browser.newPage({ baseURL, serviceWorkers: "block" });
    try {
      await joinTable(observer);
      const commands = observeCommands(page);
      await enterRetryGrace(page);
      const before = (await readOwnToken(page))!;
      await beginOwnTokenDrag(page);
      await page.mouse.up();
      // Positive control: a normal release really sends and moves the token.
      await expect.poll(async () => (await readToken(observer, before.id))?.x).toBe(before.x + 2);
      expect(commands.some((command) => command.t === "transform-object")).toBe(true);
      const token = (await readToken(observer, before.id))!;
      commands.length = 0;
      await beginOwnTokenDrag(page);
      expect(commands.some((command) => command.t === "transform-object")).toBe(false);
      await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toBeVisible();
      await page.mouse.up();
      await observeNoReload(page);
      const observed = await readToken(observer, token.id);
      await test.info().attach("terminal-held-drag-result", {
        contentType: "application/json",
        body: JSON.stringify({ commands, before: token, after: observed }),
      });
      expect(commands.filter((command) => command.t === "transform-object")).toEqual([]);
      expect(observed).toEqual(token);
    } finally {
      await page.mouse.up();
      await observer.close();
    }
  });
});

async function beginOwnTokenDrag(page: Page) {
  const position = await page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__!;
    const own = data.snapshot!.tokens.find((entry) => entry.owner === data.uid)!;
    const size = data.gridSize!;
    return {
      x: data.cam!.x + (own.x * size + size / 2) * data.cam!.scale,
      y: data.cam!.y + (own.y * size + size / 2) * data.cam!.scale,
      step: size * data.cam!.scale,
    };
  });
  const canvas = await page.getByTestId("map-board").locator("canvas").first().boundingBox();
  expect(canvas?.height).toBeGreaterThan(0);
  const x = canvas!.x + position.x;
  const y = canvas!.y + position.y;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + position.step * 2, y, { steps: 10 });
  // Inspect actual Konva drag state; drag-preview wire messages are off by
  // default. This observer neither selects nor mutates the stage.
  expect(
    await page.evaluate(() =>
      (window as unknown as { Konva: { isDragging(): boolean } }).Konva.isDragging(),
    ),
  ).toBe(true);
}

async function readToken(page: Page, id: string) {
  return page.evaluate((tokenId) => {
    const token = window.__HERO_BYTE_E2E__?.snapshot?.tokens.find((entry) => entry.id === tokenId);
    return token ? { id: token.id, x: token.x, y: token.y } : null;
  }, id);
}

function observeCommands(page: Page) {
  const commands: Array<{ t: string }> = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => commands.push(JSON.parse(payload.toString())));
  });
  return commands;
}

async function enterRetryGrace(page: Page) {
  let cssAttempts = 0;
  await page.route("**/assets/index-*.css", (route) => {
    cssAttempts += 1;
    return route.abort("connectionfailed");
  });
  await joinTable(page);
  const token = await readOwnToken(page);
  expect(token).not.toBeNull();
  await expect.poll(() => cssAttempts, { timeout: 20_000 }).toBe(2);
  await expect.poll(async () => (await readOwnToken(page))?.id).toBe(token!.id);
  await expect(page.getByRole("heading", { name: "HeroByte didn't load" })).toHaveCount(0);
}

async function joinTable(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Table password").fill(process.env.E2E_ROOM_PASSWORD ?? "Fun1");
  await page.getByRole("button", { name: /Enter Table/i }).click();
  await expect.poll(() => readOwnToken(page)).not.toBeNull();
}

async function openOwnSettings(page: Page) {
  const ownCard = page.locator(".player-card").filter({
    has: page.getByText("You", { exact: true }),
  });
  await ownCard.getByTitle("Open player settings", { exact: true }).click();
}

async function readOwnToken(page: Page) {
  return page.evaluate(() => {
    const data = window.__HERO_BYTE_E2E__;
    const token = data?.snapshot?.tokens.find((candidate) => candidate.owner === data.uid);
    return token ? { id: token.id, x: token.x, y: token.y } : null;
  });
}

async function observeNoReload(page: Page) {
  await expect(
    page.waitForEvent("framenavigated", {
      predicate: (frame) => frame === page.mainFrame(),
      timeout: 5_000,
    }),
  ).rejects.toThrow(/Timeout/i);
}
