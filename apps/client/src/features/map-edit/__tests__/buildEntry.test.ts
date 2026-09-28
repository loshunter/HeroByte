import { describe, expect, it } from "vitest";
import type { MapDocumentSummary } from "@herobyte/shared";
import { describeBuildEntry } from "../buildEntry";

const summary = (id: string, name: string): MapDocumentSummary => ({
  id,
  name,
  revision: 1,
  width: 8192,
  height: 8192,
  createdAt: 0,
  updatedAt: 0,
});
const documents = [summary("map-a", "Crypt"), summary("map-b", "Tavern")];

describe("describeBuildEntry — what opening Build offers", () => {
  it("is plain building when the table's map is the one open", () => {
    expect(
      describeBuildEntry({
        isLive: true,
        liveMapDocumentId: "map-a",
        bindingDangling: false,
        activeDocument: { id: "map-a", name: "Crypt" },
        documents,
      }),
    ).toEqual({ kind: "live" });
  });

  it("offers to resume the table's map, naming both, while a library map is open", () => {
    expect(
      describeBuildEntry({
        isLive: false,
        liveMapDocumentId: "map-a",
        bindingDangling: false,
        activeDocument: { id: "map-b", name: "Tavern" },
        documents,
      }),
    ).toEqual({ kind: "resume", onTableName: "Crypt", viewingName: "Tavern" });
  });

  it("still names the table's map while nothing is open yet", () => {
    expect(
      describeBuildEntry({
        isLive: false,
        liveMapDocumentId: "map-a",
        bindingDangling: false,
        activeDocument: null,
        documents,
      }),
    ).toEqual({ kind: "resume", onTableName: "Crypt", viewingName: null });
  });

  it("starts a new table map when the binding is gone or dangling, naming what is there", () => {
    const base = { isLive: false, activeDocument: null, documents };
    expect(
      describeBuildEntry({ ...base, liveMapDocumentId: undefined, bindingDangling: false }),
    ).toEqual({
      kind: "start",
      onTableName: "no map yet",
      viewingName: null,
      replacesUnsavedScene: false,
      sceneFateUnknown: false,
      sceneMapSaved: false,
    });
    // A dangling binding is no binding: the scene it left has no saved map.
    expect(
      describeBuildEntry({
        ...base,
        liveMapDocumentId: "gone",
        bindingDangling: true,
        sceneSourceDocumentId: "gone",
        activeDocument: { id: "map-b", name: "Tavern" },
      }),
    ).toEqual({
      kind: "start",
      onTableName: "a scene with no editable map",
      viewingName: "Tavern",
      replacesUnsavedScene: true,
      sceneFateUnknown: false,
      sceneMapSaved: false,
    });
  });

  it("flags a start that would erase a scene with no saved map", () => {
    const base = { isLive: false, activeDocument: null, documents };
    expect(
      describeBuildEntry({
        ...base,
        liveMapDocumentId: undefined,
        bindingDangling: false,
        sceneSourceDocumentId: "deleted-map",
      }),
    ).toMatchObject({ kind: "start", replacesUnsavedScene: true, sceneMapSaved: false });
    // A scene whose map still exists is saved by the switch, so nothing is
    // erased — and Build names that map rather than "no editable map".
    expect(
      describeBuildEntry({
        ...base,
        liveMapDocumentId: undefined,
        bindingDangling: false,
        sceneSourceDocumentId: "map-a",
      }),
    ).toEqual({
      kind: "start",
      onTableName: "Crypt",
      viewingName: null,
      replacesUnsavedScene: false,
      sceneFateUnknown: false,
      sceneMapSaved: true,
    });
  });

  it("before the library answers, a start is flagged as a POSSIBLE loss, not a certain one", () => {
    expect(
      describeBuildEntry({
        isLive: false,
        liveMapDocumentId: undefined,
        bindingDangling: false,
        activeDocument: null,
        documents: [],
        listed: false,
        sceneSourceDocumentId: "crypt",
      }),
    ).toMatchObject({ kind: "start", replacesUnsavedScene: true, sceneFateUnknown: true });
  });

  it("an older unbound save viewing the scene's own map does not name it twice", () => {
    expect(
      describeBuildEntry({
        isLive: false,
        liveMapDocumentId: undefined,
        bindingDangling: false,
        activeDocument: { id: "map-a", name: "Crypt" },
        documents,
        sceneSourceDocumentId: "map-a",
      }),
    ).toMatchObject({
      kind: "start",
      onTableName: "Crypt",
      viewingName: null,
      sceneMapSaved: true,
    });
  });

  it("names same-named copies apart in the resume offer", () => {
    const copies = [summary("doc-1a2b", "Live Map"), summary("doc-9f8e", "Live Map")];
    expect(
      describeBuildEntry({
        isLive: false,
        liveMapDocumentId: "doc-1a2b",
        bindingDangling: false,
        activeDocument: { id: "doc-9f8e", name: "Live Map" },
        documents: copies,
      }),
    ).toEqual({ kind: "resume", onTableName: "Live Map #1a2b", viewingName: "Live Map #9f8e" });
  });
});
