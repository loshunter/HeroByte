// U10a — the glossary names controls the way the controls name themselves.
import { describe, expect, it } from "vitest";
import { HELP_TOPICS } from "../helpTopics";
import { ANNOTATION_TOOLS, DRAWING_TOOL_LABELS } from "../../drawing/drawingTools";

const entry = (topicId: string, term: string) => {
  const found = HELP_TOPICS.find((t) => t.id === topicId)?.entries.find((e) => e.term === term);
  expect(found, `no "${term}" entry under "${topicId}"`).toBeDefined();
  return found!;
};

describe("the drawing topic uses the toolbar's words", () => {
  it("lists the annotation tools by their button labels", () => {
    const draw = entry("drawing", "✏️ Draw").detail;
    for (const tool of ANNOTATION_TOOLS) {
      expect(draw).toContain(DRAWING_TOOL_LABELS[tool]);
    }
    expect(draw).not.toMatch(/\bRect\b/);
  });

  it("names the four area templates as Burst, Cone, Cube and Bolt, each with its shape", () => {
    const text = entry("drawing", "Area templates").detail;
    expect(text).toMatch(/Burst \(a circle\)/);
    expect(text).toMatch(/Cone/);
    expect(text).toMatch(/Cube \(a square\)/);
    expect(text).toMatch(/Bolt \(a line\)/);
    expect(text).not.toMatch(/◯ Circle|▢ Square|▬ Line/);
    expect(text).toMatch(/Burst reads “20 ft circle”/);
    expect(text).toMatch(/Cube reads “15 ft square” and a Bolt “30 ft line”/);
  });
});

describe("Reset view names the real action", () => {
  it("puts the origin at the top-left of the view at 1x, and is not 'Recenter'", () => {
    const text = entry("moving", "🧭 Reset view").detail;
    expect(text).toMatch(/top-left corner \(the origin, 0, 0\).*100%/);
    expect(text).not.toMatch(/back at the middle/i);
    const terms = HELP_TOPICS.flatMap((topic) => topic.entries.map((e) => e.term)).join("\n");
    expect(terms).not.toMatch(/Recenter/);
  });
});

describe("the dice, ping and shelf topics say who gets what", () => {
  it("Who sees it: ME reaches no other player or DM, and the seat-claim caveat is kept", () => {
    const text = entry("dice", "Who sees it").detail;
    expect(text).toMatch(/no other player or DM is sent it/);
    expect(text).toMatch(/whoever is in DM mode \(now or later\)/);
    // The seat-claim caveat lives here, once, rather than in every tooltip.
    expect(text).toMatch(/claim your seat once you have been gone more than six hours/);
  });

  it("Ping reaches the DM and the players who can see the spot, not 'everyone'", () => {
    const text = entry("drawing", "👆 Ping").detail;
    expect(text).toMatch(/A player’s ping reaches the DM and the players who can see that spot/);
    expect(text).toMatch(/a DM’s ping reaches everyone/);
    expect(text).not.toMatch(/everyone sees/i);
  });

  it("the token shelf is THIS TABLE, wearing ADDED, never CUSTOM or MINE", () => {
    const text = entry("dm", "THIS TABLE (the table’s own tokens)").detail;
    expect(text).toMatch(/THIS TABLE chip/);
    expect(text).toMatch(/ADDED badge/);
    expect(text).toMatch(/Players never receive the shelf/);
    expect(text).not.toMatch(/CUSTOM|MINE/);
  });

  it("the Table button's entry says a player sees no role word", () => {
    expect(entry("tablemenu", "The Table button").detail).toMatch(/a player sees no role word/);
  });
});
