import { describe, expect, it } from "vitest";
import { tableLabel } from "../tableLabel";

describe("tableLabel — what the header calls this table", () => {
  it("prefers the snapshot's name, which every member's browser learns", () => {
    expect(
      tableLabel({ tableName: "Sunday Game", roomId: "table-k3f9x2", rememberedName: "Old name" }),
    ).toBe("Sunday Game");
  });

  it("falls back to the name this browser's shelf remembered", () => {
    expect(tableLabel({ roomId: "table-k3f9x2", rememberedName: "Sunday Game" })).toBe(
      "Sunday Game",
    );
  });

  it("falls back to the table code, then to the Main Hall on the default table", () => {
    expect(tableLabel({ roomId: "table-k3f9x2" })).toBe("table-k3f9x2");
    expect(tableLabel({})).toBe("Main Hall");
  });

  it("ignores a blank name rather than showing an empty button", () => {
    expect(tableLabel({ tableName: "   ", roomId: "table-k3f9x2", rememberedName: "  " })).toBe(
      "table-k3f9x2",
    );
    expect(tableLabel({ tableName: "  Padded  " })).toBe("Padded");
  });
});
