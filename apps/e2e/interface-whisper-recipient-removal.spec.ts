import { expect, test } from "./fixtures";
import { joinDefaultRoom } from "./helpers";
import { joinMobileTable } from "./mobile/mobile.helpers";
import {
  type Command,
  composer,
  target,
  sendButton,
  renderedMessage,
  readState,
  identity,
  observeCommands,
  openChat,
  sendDraft,
  expectMessage,
  expectAbsent,
  elevateViaUI,
} from "./chat-journey.helpers";
test("removed whisper recipient preserves desktop and phone drafts until explicit retarget", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const phoneContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const bobContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const contexts = [desktopContext, phoneContext, bobContext, dmContext];
  const desktop = await desktopContext.newPage();
  const phone = await phoneContext.newPage();
  const bob = await bobContext.newPage();
  const dm = await dmContext.newPage();
  const desktopCommands = observeCommands(desktop);
  const phoneCommands = observeCommands(phone);
  const dmCommands = observeCommands(dm);
  const live = [desktop, phone, dm];
  const all = [...live, bob];
  const chatCommands = (commands: Command[]) => commands.filter((entry) => entry.t === "chat");

  try {
    await joinDefaultRoom(dm);
    await elevateViaUI(dm);
    await joinDefaultRoom(bob);
    await joinDefaultRoom(desktop);
    await joinMobileTable(phone);
    for (const page of all) {
      await page.waitForFunction(() => window.__HERO_BYTE_E2E__?.snapshot?.players.length === 4);
      await expect.poll(async () => (await readState(page)).snapshot.users.length).toBe(4);
    }
    const [desktopId, phoneId, dmId, bobId] = await Promise.all(all.map(identity));
    expect(new Set([desktopId.uid, phoneId.uid, dmId.uid, bobId.uid]).size).toBe(4);
    expect([desktopId.isDM, phoneId.isDM, dmId.isDM, bobId.isDM]).toEqual([
      false,
      false,
      true,
      false,
    ]);
    for (const page of all) await openChat(page, page === phone);

    const senders = [
      { page: desktop, who: desktopId, touch: false, commands: desktopCommands, name: "desktop" },
      { page: phone, who: phoneId, touch: true, commands: phoneCommands, name: "phone-375" },
    ];
    for (const sender of senders) {
      await expect(
        target(sender.page).locator(`option[value="recipient:${bobId.uid}"]`),
      ).toHaveText(`Whisper to ${bobId.name}`);
      await target(sender.page).selectOption({ label: `Whisper to ${bobId.name}` });
      await expect(target(sender.page)).toHaveValue(`recipient:${bobId.uid}`);
      const text = `U1 ${sender.name}: Bob received this private preflight.`;
      await composer(sender.page).fill(text);
      await sendDraft(sender.page, sender.touch);
      for (const page of [sender.page, bob])
        await expectMessage(page, text, sender.who.uid, bobId.uid);
      expect(chatCommands(sender.commands)).toMatchObject([{ t: "chat", text, to: bobId.uid }]);
    }
    // Public traffic from an independent, non-recipient observer proves all
    // four readers are current before any negative preflight privacy checks.
    const preflight = "U1 DM observer: all four clients are current.";
    await target(dm).selectOption({ label: "Everyone" });
    await composer(dm).fill(preflight);
    await sendDraft(dm);
    for (const page of all) await expectMessage(page, preflight, dmId.uid);
    for (const sender of senders) {
      const text = `U1 ${sender.name}: Bob received this private preflight.`;
      for (const page of live.filter((client) => client !== sender.page))
        await expectAbsent(page, text);
      // Both drafts must exist while Bob is still connected and selected.
      await composer(sender.page).pressSequentially(`U1 ${sender.name}: PRIVATE draft for Bob.`);
      await expect(composer(sender.page)).toHaveValue(`U1 ${sender.name}: PRIVATE draft for Bob.`);
      await expect(target(sender.page)).toHaveValue(`recipient:${bobId.uid}`);
    }
    for (const page of all) expect((await readState(page)).snapshot.users).toContain(bobId.uid);

    const beforeAttempts = senders.map((sender) => chatCommands(sender.commands).length);
    const disconnectedAt = Date.now();
    await bob.close(); // Real socket teardown; retain browser identity for the later return.
    for (const page of live) {
      await expect
        .poll(async () => (await readState(page)).snapshot.users)
        .not.toContain(bobId.uid);
      expect((await readState(page)).snapshot.players.map((player) => player.uid)).toContain(
        bobId.uid,
      );
    }
    const lastHeartbeat = (await readState(dm)).snapshot.players.find(
      (player) => player.uid === bobId.uid,
    )?.lastHeartbeat;
    expect(typeof lastHeartbeat).toBe("number");
    await dm.getByRole("button", { name: "🛠️ DM MENU", exact: true }).click();
    await expect(
      dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true }),
    ).toBeVisible();
    // U9: the roster of people lives in DM Menu → Table → Players at this table.
    await dm.getByRole("button", { name: "Table", exact: true }).click();
    // Only Bob is away. The real UI waits for the server's 60s heartbeat age;
    // its 15s refresh tick makes ~75s the worst normal wait. Share it once.
    const remove = dm.getByRole("button", { name: "Remove", exact: true });
    await expect(remove).toBeVisible({ timeout: 90_000 });
    await expect(remove).toHaveCount(1);
    expect(Date.now() - lastHeartbeat!).toBeGreaterThanOrEqual(60_000);
    await test.info().attach("real-removal-grace", {
      body: JSON.stringify({
        elapsedSinceDisconnectMs: Date.now() - disconnectedAt,
        heartbeatAgeMs: Date.now() - lastHeartbeat!,
      }),
      contentType: "application/json",
    });
    await Promise.all([
      dm.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("confirm");
        expect(dialog.message()).toContain(`Remove ${bobId.name} from the table?`);
        await dialog.accept();
      }),
      remove.click(),
    ]);
    await expect
      .poll(() => dmCommands.filter((entry) => entry.t === "remove-player"))
      .toMatchObject([{ t: "remove-player", uid: bobId.uid }]);
    for (const page of live) {
      await expect
        .poll(async () => (await readState(page)).snapshot.players.map((player) => player.uid))
        .not.toContain(bobId.uid);
      await expect.poll(async () => (await readState(page)).snapshot.users.length).toBe(3);
    }
    await dm.getByRole("button", { name: "Close Dungeon Master Tools", exact: true }).click();

    for (const sender of senders) {
      // Soft checks intentionally let the old unsafe implementation reach
      // BOTH trusted send attempts and the independent observer assertions.
      expect.soft(await target(sender.page).inputValue()).toBe("unavailable");
      await expect(
        renderedMessage(sender.page, `U1 ${sender.name}: Bob received this private preflight.`),
      ).toContainText(`→ ${bobId.name}:`);
      expect.soft(await sendButton(sender.page).isDisabled()).toBe(true);
      expect
        .soft(await composer(sender.page).inputValue())
        .toBe(`U1 ${sender.name}: PRIVATE draft for Bob.`);
    }
    await composer(desktop).press("Enter");
    const phoneSend = sendButton(phone);
    await expect(phoneSend).toBeVisible();
    await phoneSend.scrollIntoViewIfNeeded();
    const box = await phoneSend.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    expect(box!.x + box!.width / 2).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width / 2).toBeLessThan(375);
    expect(box!.y + box!.height / 2).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height / 2).toBeLessThan(812);
    // Trusted coordinates bypass Playwright's enabled actionability wait;
    // clicking a legitimately disabled SEND should return without a command.
    await phone.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);

    const blockedBarrier = "U1 DM observer: removal attempts finished; clients are still live.";
    await composer(dm).fill(blockedBarrier);
    await sendDraft(dm);
    for (const page of live) await expectMessage(page, blockedBarrier, dmId.uid);
    for (const [index, sender] of senders.entries()) {
      expect.soft(chatCommands(sender.commands).slice(beforeAttempts[index])).toEqual([]);
      expect.soft(await target(sender.page).inputValue()).toBe("unavailable");
      expect.soft(await sendButton(sender.page).isDisabled()).toBe(true);
      expect
        .soft(await composer(sender.page).inputValue())
        .toBe(`U1 ${sender.name}: PRIVATE draft for Bob.`);
      for (const page of live)
        await expectAbsent(page, `U1 ${sender.name}: PRIVATE draft for Bob.`);
      await expect(
        sender.page.getByRole("status").filter({ hasText: "Recipient unavailable" }),
      ).toBeVisible();
      const screenshot = test.info().outputPath(`${sender.name}-recipient-unavailable.png`);
      await sender.page.screenshot({ path: screenshot });
      await test.info().attach(`${sender.name}-recipient-unavailable`, {
        path: screenshot,
        contentType: "image/png",
      });
    }

    // A returning UID is not new consent. Reopen the same browser identity
    // through the actual login flow; never inject a session token or roster.
    const returned = await bobContext.newPage();
    await joinDefaultRoom(returned);
    await expect.poll(async () => (await identity(returned)).uid).toBe(bobId.uid);
    await openChat(returned);
    live.push(returned);
    for (const page of live) {
      await expect.poll(async () => (await readState(page)).snapshot.users).toContain(bobId.uid);
    }
    for (const sender of senders) {
      expect
        .soft(await target(sender.page).locator("option:checked").textContent())
        .toContain("(choose again)");
      expect.soft(await sendButton(sender.page).isDisabled()).toBe(true);
    }
    await composer(desktop).press("Enter");
    const returnedBox = await sendButton(phone).boundingBox();
    expect(returnedBox).not.toBeNull();
    await phone.touchscreen.tap(
      returnedBox!.x + returnedBox!.width / 2,
      returnedBox!.y + returnedBox!.height / 2,
    );
    const returnBarrier = "U1 DM observer: returned UID still needs an explicit recipient choice.";
    await composer(dm).fill(returnBarrier);
    await sendDraft(dm);
    for (const page of live) await expectMessage(page, returnBarrier, dmId.uid);
    for (const [index, sender] of senders.entries()) {
      expect.soft(chatCommands(sender.commands).slice(beforeAttempts[index])).toEqual([]);
      expect
        .soft(await composer(sender.page).inputValue())
        .toBe(`U1 ${sender.name}: PRIVATE draft for Bob.`);
      for (const page of live)
        await expectAbsent(page, `U1 ${sender.name}: PRIVATE draft for Bob.`);
    }

    for (const sender of senders) {
      const returnedScreenshot = test.info().outputPath(`${sender.name}-recipient-returned.png`);
      await sender.page.screenshot({ path: returnedScreenshot });
      await test.info().attach(`${sender.name}-recipient-returned`, {
        path: returnedScreenshot,
        contentType: "image/png",
      });
    }

    // Explicit consent to retarget: desktop deliberately publishes its saved
    // draft; phone deliberately whispers its saved draft to the live DM.
    await target(desktop).selectOption({ label: "Everyone" });
    await expect(composer(desktop)).toHaveValue("U1 desktop: PRIVATE draft for Bob.");
    await expect(sendButton(desktop)).toBeEnabled();
    await sendDraft(desktop);
    for (const page of live)
      await expectMessage(page, "U1 desktop: PRIVATE draft for Bob.", desktopId.uid);
    await target(phone).selectOption({ label: `Whisper to ${dmId.name}` });
    await expect(target(phone)).toHaveValue(`recipient:${dmId.uid}`);
    await expect(composer(phone)).toHaveValue("U1 phone-375: PRIVATE draft for Bob.");
    await expect(sendButton(phone)).toBeEnabled();
    await sendDraft(phone, true);
    for (const page of [phone, dm]) {
      await expectMessage(page, "U1 phone-375: PRIVATE draft for Bob.", phoneId.uid, dmId.uid);
    }
    const recoveredBarrier = "U1 DM observer: both deliberate retargets finished.";
    await composer(dm).fill(recoveredBarrier);
    await sendDraft(dm);
    for (const page of live) await expectMessage(page, recoveredBarrier, dmId.uid);
    await expectAbsent(desktop, "U1 phone-375: PRIVATE draft for Bob.");
    expect(chatCommands(desktopCommands).slice(beforeAttempts[0])).toMatchObject([
      { t: "chat", text: "U1 desktop: PRIVATE draft for Bob." },
    ]);
    expect(chatCommands(phoneCommands).slice(beforeAttempts[1])).toMatchObject([
      { t: "chat", text: "U1 phone-375: PRIVATE draft for Bob.", to: dmId.uid },
    ]);
    // The formerly selected UID is selectable again, but only by an explicit choice.
    const returnedWhisper = "U1 phone: explicitly selected the returned recipient.";
    await target(phone).selectOption({ value: `recipient:${bobId.uid}` });
    await composer(phone).fill(returnedWhisper);
    await sendDraft(phone, true);
    for (const page of [phone, returned])
      await expectMessage(page, returnedWhisper, phoneId.uid, bobId.uid);
    const finalBarrier = "U1 DM observer: explicit return selection finished.";
    await composer(dm).fill(finalBarrier);
    await sendDraft(dm);
    for (const page of live) await expectMessage(page, finalBarrier, dmId.uid);
    for (const page of [desktop, dm]) await expectAbsent(page, returnedWhisper);
    expect(chatCommands(phoneCommands).slice(beforeAttempts[1])).toMatchObject([
      { t: "chat", text: "U1 phone-375: PRIVATE draft for Bob.", to: dmId.uid },
      { t: "chat", text: returnedWhisper, to: bobId.uid },
    ]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
