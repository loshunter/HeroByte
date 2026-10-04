import { expect, expectTypeOf, it } from "vitest";
import type { ChatMessage, RoomSnapshot } from "../../index.js";

it("keeps legacy chat records assignable through the shared barrel and snapshot", () => {
  const legacy: ChatMessage = {
    id: "legacy",
    authorUid: "alice",
    authorName: "Alice",
    text: "hello",
    to: "bob",
    timestamp: 123,
  };
  const history: RoomSnapshot["chatLog"] = [legacy];

  expectTypeOf(history).toMatchTypeOf<ChatMessage[] | undefined>();
  expectTypeOf<ChatMessage["toName"]>().toEqualTypeOf<string | undefined>();
  expect(history?.[0]).toEqual(legacy);
  expect(legacy).not.toHaveProperty("toName");
});
