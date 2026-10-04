import { describe, expect, it } from "vitest";
import type { MapDocumentSummary } from "@herobyte/shared";
import {
  describeOnTable,
  displayName,
  libraryOptionLabel,
  LOST_SCENE_WARNING,
  sceneLossWarning,
  tableSceneFate,
  UNKNOWN_SCENE_WARNING,
} from "../tableMapIdentity";

const summary = (id: string, name: string, revision = 3): MapDocumentSummary => ({
  id,
  name,
  revision,
  width: 2048,
  height: 2048,
  createdAt: 0,
  updatedAt: Number.NaN,
});

describe("describeOnTable — what the party is looking at, in words", () => {
  const documents = [summary("map-a", "Crypt"), summary("map-b", "Tavern")];

  it("names the bound document", () => {
    expect(describeOnTable({ liveMapDocumentId: "map-a", documents, hasCompiledScene: true })).toBe(
      "Crypt",
    );
  });

  it("says 'the table map' while the library has not listed the bound document yet", () => {
    expect(
      describeOnTable({ liveMapDocumentId: "map-z", documents: [], hasCompiledScene: true }),
    ).toBe("the table map");
  });

  it("an unbound scene is not presented as an editable map", () => {
    // Deleting the table's own map, or loading a session whose map is gone,
    // clears the binding while the compiled scene keeps playing.
    expect(describeOnTable({ documents, hasCompiledScene: true })).toBe(
      "a scene with no editable map",
    );
  });

  it("a raster-only table says so, and an empty table says there is nothing", () => {
    expect(describeOnTable({ documents, hasCompiledScene: false, hasBackground: true })).toBe(
      "a background image",
    );
    expect(describeOnTable({ documents, hasCompiledScene: false })).toBe("no map yet");
  });
});

describe("libraryOptionLabel — copies and the table's map are told apart", () => {
  it("keeps name, edit counter and last-edited stamp", () => {
    const documents = [summary("map-a", "Crypt", 7)];
    expect(libraryOptionLabel(documents[0]!, documents, undefined)).toBe("Crypt · r7 · unknown");
  });

  it("marks the document that is on the table", () => {
    const documents = [summary("map-a", "Crypt"), summary("map-b", "Tavern")];
    expect(libraryOptionLabel(documents[0]!, documents, "map-a")).toBe(
      "● Crypt · r3 · unknown · on table",
    );
    expect(libraryOptionLabel(documents[1]!, documents, "map-a")).toBe("Tavern · r3 · unknown");
  });

  it("gives same-named copies a short id so they are not identical lines", () => {
    const documents = [summary("doc-1a2b", "Live Map"), summary("doc-9f8e", "Live Map")];
    const labels = documents.map((document) => libraryOptionLabel(document, documents, undefined));
    expect(labels).toEqual(["Live Map · #1a2b · r3 · unknown", "Live Map · #9f8e · r3 · unknown"]);
    expect(new Set(labels).size).toBe(2);
  });
});

describe("displayName — copies are told apart everywhere, not only in the picker", () => {
  it("adds a short id only when another saved map shares the name", () => {
    const documents = [
      summary("doc-1a2b", "Live Map"),
      summary("doc-9f8e", "Live Map"),
      summary("x", "Crypt"),
    ];
    expect(displayName("doc-1a2b", documents)).toBe("Live Map #1a2b");
    expect(displayName("x", documents)).toBe("Crypt");
    expect(displayName("missing", documents)).toBeUndefined();
  });

  it("the On table line uses it too", () => {
    const documents = [summary("doc-1a2b", "Live Map"), summary("doc-9f8e", "Live Map")];
    expect(
      describeOnTable({ liveMapDocumentId: "doc-9f8e", documents, hasCompiledScene: true }),
    ).toBe("Live Map #9f8e");
  });
});

describe("a binding to a map the server reported gone", () => {
  it("is no binding at all", () => {
    expect(
      describeOnTable({
        liveMapDocumentId: "gone",
        missingDocumentId: "gone",
        documents: [],
        hasCompiledScene: true,
      }),
    ).toBe("a scene with no editable map");
  });
});

describe("tableSceneFate — what the next map does to the scene on the table", () => {
  const documents = [summary("crypt", "Crypt")];
  it("keeps a scene whose map is still in the library", () => {
    expect(tableSceneFate({ sceneDocumentId: "crypt", documents })).toBe("kept");
  });
  it("loses a scene whose map is gone, listed or reported missing", () => {
    expect(tableSceneFate({ sceneDocumentId: "deleted", documents })).toBe("lost");
    expect(
      tableSceneFate({ sceneDocumentId: "crypt", missingDocumentId: "crypt", documents }),
    ).toBe("lost");
  });
  it("has nothing to lose without a scene", () => {
    expect(tableSceneFate({ documents })).toBe("none");
  });
  it("does not call a scene lost before the library has answered", () => {
    // An empty list before the first reply proves nothing about the scene's map.
    expect(tableSceneFate({ sceneDocumentId: "crypt", documents: [], listed: false })).toBe(
      "unknown",
    );
    // A map already in hand is kept either way; one the server reported gone is lost.
    expect(tableSceneFate({ sceneDocumentId: "crypt", documents, listed: false })).toBe("kept");
    expect(
      tableSceneFate({
        sceneDocumentId: "crypt",
        missingDocumentId: "crypt",
        documents: [],
        listed: false,
      }),
    ).toBe("lost");
  });
  it("words each fate's warning: certain loss, possible loss, or none", () => {
    expect(sceneLossWarning("lost")).toBe(LOST_SCENE_WARNING);
    expect(sceneLossWarning("unknown")).toBe(UNKNOWN_SCENE_WARNING);
    expect(sceneLossWarning("kept")).toBeNull();
    expect(sceneLossWarning("none")).toBeNull();
  });
});
