import { expect, test, type Page } from "./fixtures";
import { joinDefaultRoom, joinDefaultRoomAsDM } from "./helpers";
import { joinMobileTable } from "./mobile/mobile.helpers";

const readIdentity = (page: Page) =>
  page.evaluate(() => {
    const state = window.__HERO_BYTE_E2E__;
    const player = state?.snapshot?.players.find((entry) => entry.uid === state.uid);
    if (!state?.uid || !player) throw new Error("Chat client identity is unavailable");
    return { uid: state.uid, name: player.name, isDM: Boolean(player.isDM) };
  });

const readChat = (page: Page) =>
  page.evaluate(() => {
    const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
    if (!snapshot) throw new Error("Chat snapshot is unavailable");
    if (!Array.isArray(snapshot.chatLog)) throw new Error("Chat log is unavailable");
    return snapshot.chatLog;
  });

async function openChat(page: Page, touch: boolean) {
  if (touch) {
    await page
      .getByRole("navigation", { name: /Mobile actions/i })
      .getByRole("button", { name: "Chat", exact: true })
      .tap();
    await expect(page.getByRole("dialog", { name: "Chat & Rolls", exact: true })).toBeVisible();
  } else {
    await page.getByRole("button", { name: "📜 Chat & Rolls", exact: true }).click();
  }
  await expect(page.getByRole("tab", { name: "CHAT", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Chat message", { exact: true })).toBeVisible();
}

async function sendChat(page: Page, text: string, touch: boolean) {
  const composer = page.getByLabel("Chat message", { exact: true });
  await composer.fill(text);
  const send = page.getByRole("button", { name: "SEND", exact: true });
  if (touch) await send.tap();
  else await send.click();
  await expect(composer).toHaveValue("");
}

async function expectMessageOnce(page: Page, text: string) {
  const entry = page.getByTestId("chat-message").filter({ hasText: text });
  await expect(entry).toHaveCount(1);
  await expect(entry).toBeVisible();
  await expect
    .poll(async () => (await readChat(page)).filter((message) => message.text === text))
    .toHaveLength(1);
}

for (const touch of [false, true]) {
  const surface = touch ? "375px touch phone" : "desktop";
  test(`Chat on ${surface} keeps whispers private and can return to Everyone`, async ({
    browser,
  }) => {
    test.setTimeout(60_000);
    const senderContext = await browser.newContext({
      viewport: touch ? { width: 375, height: 812 } : { width: 1440, height: 900 },
      hasTouch: touch,
      isMobile: touch,
    });
    const recipientContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const observerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const sender = await senderContext.newPage();
    const recipient = await recipientContext.newPage();
    const observer = await observerContext.newPage();
    const clients = [sender, recipient, observer];

    try {
      await joinDefaultRoomAsDM(recipient);
      await joinDefaultRoom(observer);
      if (touch) await joinMobileTable(sender);
      else await joinDefaultRoom(sender);
      for (const client of clients) {
        await expect
          .poll(() =>
            client.evaluate(() => {
              const snapshot = window.__HERO_BYTE_E2E__?.snapshot;
              if (!snapshot) throw new Error("Joined table snapshot is unavailable");
              return snapshot.players.length;
            }),
          )
          .toBe(3);
      }
      const senderIdentity = await readIdentity(sender);
      const recipientIdentity = await readIdentity(recipient);
      const observerIdentity = await readIdentity(observer);
      expect(new Set([senderIdentity.uid, recipientIdentity.uid, observerIdentity.uid]).size).toBe(
        3,
      );
      expect(senderIdentity.isDM).toBe(false);
      expect(recipientIdentity.isDM).toBe(true);
      expect(observerIdentity.isDM).toBe(false);

      await openChat(sender, touch);
      await openChat(recipient, false);
      await openChat(observer, false);
      const target = sender.getByRole("combobox", { name: "Send to", exact: true });
      await expect(target).toBeVisible();
      await target.selectOption({ label: "Everyone" });
      await expect(target).toHaveValue("");

      const publicMessage = `U1 ${surface}: everyone is ready.`;
      await sendChat(sender, publicMessage, touch);
      for (const client of clients) {
        await expectMessageOnce(client, publicMessage);
        const message = (await readChat(client)).find((entry) => entry.text === publicMessage)!;
        expect(message.authorUid).toBe(senderIdentity.uid);
        expect(message.to).toBeUndefined();
      }

      // Select the visible UI option by its unique value; player names can
      // match, so the matching public label is verified separately.
      await expect(target.locator(`option[value="recipient:${recipientIdentity.uid}"]`)).toHaveText(
        `Whisper to ${recipientIdentity.name}`,
      );
      await target.selectOption({ value: `recipient:${recipientIdentity.uid}` });
      await expect(target).toHaveValue(`recipient:${recipientIdentity.uid}`);
      await expect(sender.getByLabel("Chat message", { exact: true })).toHaveAttribute(
        "placeholder",
        "Whisper something...",
      );
      const whisper = `U1 ${surface}: only the DM knows the hidden door.`;
      await sendChat(sender, whisper, touch);
      for (const client of [sender, recipient]) {
        await expectMessageOnce(client, whisper);
        const message = (await readChat(client)).find((entry) => entry.text === whisper)!;
        expect(message.authorUid).toBe(senderIdentity.uid);
        expect(message.to).toBe(recipientIdentity.uid);
      }

      await target.selectOption({ label: "Everyone" });
      await expect(target).toHaveValue("");
      await expect(sender.getByLabel("Chat message", { exact: true })).toHaveAttribute(
        "placeholder",
        "Say something...",
      );
      // A later public message from the same sender is a barrier: the observer
      // must receive and render newer state before either privacy assertion.
      const barrier = `U1 ${surface}: everyone can hear this again.`;
      await sendChat(sender, barrier, touch);
      for (const client of clients) {
        await expectMessageOnce(client, barrier);
        const message = (await readChat(client)).find((entry) => entry.text === barrier)!;
        expect(message.authorUid).toBe(senderIdentity.uid);
        expect(message.to).toBeUndefined();
      }
      expect((await readChat(observer)).filter((message) => message.text === whisper)).toHaveLength(
        0,
      );
      await expect(observer.getByTestId("chat-message").filter({ hasText: whisper })).toHaveCount(
        0,
      );
      for (const client of [sender, recipient]) await expectMessageOnce(client, whisper);
    } finally {
      await senderContext.close();
      await recipientContext.close();
      await observerContext.close();
    }
  });
}
