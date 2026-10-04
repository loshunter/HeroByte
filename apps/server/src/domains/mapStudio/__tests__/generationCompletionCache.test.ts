import { describe, expect, it } from "vitest";
import { MapStudioService } from "../service.js";

function setup() {
  const service = new MapStudioService();
  service.create("room", { id: "map", name: "Map", timestamp: 1 });
  const apply = (id: string) =>
    service.apply(
      "room",
      {
        type: "update-grid",
        commandId: id,
        documentId: "map",
        baseRevision: service.get("room", "map").revision,
        update: { size: 50 },
      },
      2,
    );
  apply("generation");
  return { service, apply };
}

describe("Generate completion shares the existing bounded cache lifetime", () => {
  it("requires an explicit completion mark, returns a defensive result and retains the latest document", () => {
    const { service, apply } = setup();
    expect(service.cachedResult("room", "map", "generation")?.generationCompleted).toBeUndefined();
    service.completeGeneration("room", "map", "generation");
    const cached = service.cachedResult("room", "map", "generation")!;
    expect(cached.generationCompleted).toBe(true);
    delete cached.generationCompleted;
    apply("later");
    expect(service.cachedResult("room", "map", "generation")).toMatchObject({
      generationCompleted: true,
      revision: 2,
    });
    expect(service.cachedResult("other", "map", "generation")).toBeUndefined();
    expect(service.cachedResult("room", "map", "later")?.generationCompleted).toBeUndefined();
  });

  it.each(["delete", "reset", "evict"] as const)(
    "cannot retain or recreate a completion after %s",
    (mode) => {
      const { service, apply } = setup();
      service.completeGeneration("room", "map", "generation");
      if (mode === "delete") service.delete("room", "map");
      if (mode === "reset") service.resetRoom("room");
      if (mode === "evict") for (let n = 0; n < 500; n++) apply(`later-${n}`);
      expect(service.cachedResult("room", "map", "generation")).toBeUndefined();
      service.completeGeneration("room", "map", "generation");
      expect(service.cachedResult("room", "map", "generation")).toBeUndefined();
    },
  );
});
