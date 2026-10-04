// U10b — the chat's text is READABLE. Messages and the composer were `jrpg-text-small`
// (8 px, in the pixel face): sentences people read, in the face the stylesheet itself
// calls "close to unreadable" in a long string. They now take the body face at 13 px
// (`.jrpg-text-body`); SEND, a button, keeps the pixel face at the 11 px floor.
// Measured as computed style, what the browser resolved.

import { expect, test } from "./fixtures";
import { composer, openChat, renderedMessage, sendButton } from "./chat-journey.helpers";
import { createTable, dismissNextSteps } from "./table-role.helpers";

const resolved = (locator: ReturnType<typeof composer>) =>
  locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontSize: style.fontSize, fontFamily: style.fontFamily };
  });

test.describe("U10b — chat text (desktop)", () => {
  test("messages and the composer use the body face at 13 px; SEND the pixel face at 11 px", async ({
    page,
  }) => {
    await createTable(page, "u10b-chat-text");
    await dismissNextSteps(page);
    await openChat(page);

    const text = "Does anyone read this at eight pixels?";
    await composer(page).fill(text);
    await sendButton(page).click();
    const message = renderedMessage(page, text);
    await expect(message).toBeVisible();

    const body = await resolved(message);
    expect(body.fontSize).toBe("13px");
    expect(body.fontFamily).not.toMatch(/Press Start/i);

    const input = await resolved(composer(page));
    expect(input.fontSize).toBe("13px");
    expect(input.fontFamily).not.toMatch(/Press Start/i);

    const send = await resolved(sendButton(page));
    expect(send.fontSize).toBe("11px");
    expect(send.fontFamily).toMatch(/Press Start/i);
  });
});
