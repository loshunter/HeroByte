import { expect, type Page } from "./fixtures";
import { enterDMMode } from "./table-role.helpers";

export type Command = { t: string; text?: string; to?: string; uid?: string };
export const composer = (page: Page) => page.getByLabel("Chat message", { exact: true });
export const target = (page: Page) => page.getByRole("combobox", { name: "Send to", exact: true });
export const sendButton = (page: Page) => page.getByRole("button", { name: "SEND", exact: true });
export const renderedMessage = (page: Page, text: string) =>
  page.getByTestId("chat-message").filter({ hasText: text });

export const readState = (page: Page) =>
  page.evaluate(() => {
    const state = window.__HERO_BYTE_E2E__;
    if (!state?.uid || !state.snapshot || !Array.isArray(state.snapshot.chatLog)) {
      throw new Error("Joined chat state is unavailable");
    }
    return {
      uid: state.uid,
      snapshot: { ...state.snapshot, chatLog: state.snapshot.chatLog },
    };
  });

export async function identity(page: Page) {
  const state = await readState(page);
  const self = state.snapshot.players.find((player) => player.uid === state.uid);
  if (!self) throw new Error("Local player is absent from the roster");
  return { uid: self.uid, name: self.name, isDM: Boolean(self.isDM) };
}

// Passive Node-side observation; never patch WebSocket or the application seam.
// Successful UI sends below prove this ledger is attached and sees chat frames.
export function observeCommands(page: Page) {
  const commands: Command[] = [];
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => commands.push(JSON.parse(payload.toString())));
  });
  return commands;
}

export async function openChat(page: Page, touch = false) {
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
  await expect(composer(page)).toBeVisible();
}

export async function sendDraft(page: Page, touch = false) {
  if (touch) await sendButton(page).tap();
  else await sendButton(page).click();
  await expect(composer(page)).toHaveValue("");
}

export async function expectMessage(page: Page, text: string, authorUid: string, to?: string) {
  await expect
    .poll(async () =>
      (await readState(page)).snapshot.chatLog.filter((message) => message.text === text),
    )
    .toHaveLength(1);
  const message = (await readState(page)).snapshot.chatLog.find((entry) => entry.text === text)!;
  expect(message.authorUid).toBe(authorUid);
  expect(message.to).toBe(to);
  await expect(renderedMessage(page, text)).toHaveCount(1);
  await expect(renderedMessage(page, text)).toBeVisible();
}

export async function expectAbsent(page: Page, text: string) {
  expect
    .soft((await readState(page)).snapshot.chatLog.filter((entry) => entry.text === text))
    .toHaveLength(0);
  expect.soft(await renderedMessage(page, text).count()).toBe(0);
}

export async function elevateViaUI(page: Page) {
  // Through the Table menu, as a person does (U9).
  await enterDMMode(page, process.env.E2E_DM_PASSWORD ?? "FunDM");
  await expect.poll(async () => (await identity(page)).isDM).toBe(true);
}
