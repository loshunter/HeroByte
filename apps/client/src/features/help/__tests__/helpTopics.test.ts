// The in-app glossary is a second home for user-facing copy, and correcting the
// user guide left it behind: it told players Recenter goes to "the middle of the
// map" long after the code settled on the origin. The file's own header asks for
// the two to be kept in step, and nothing checked.
import { describe, it, expect } from "vitest";
import { HELP_TOPICS } from "../helpTopics";

const entry = (topicId: string, term: string) => {
  const topic = HELP_TOPICS.find((t) => t.id === topicId);
  expect(topic, `no help topic "${topicId}"`).toBeDefined();
  const found = topic!.entries?.find((e) => e.term === term);
  expect(found, `no "${term}" entry under "${topicId}"`).toBeDefined();
  return found!;
};

describe("helpTopics stays in step with the camera's behaviour", () => {
  it("describes Recenter as the origin, never the middle of the map", () => {
    // `reset` is applied as { x: 0, y: 0, scale: 1 } in useCameraControl — the
    // map's top-left corner at 1x, which is not its middle and is not where a
    // player arrives.
    const recenter = entry("moving", "🧭 Recenter");
    expect(recenter.detail).toMatch(/top-left/i);
    // The old copy read "Puts the camera back at the middle of the map." Match
    // the AFFIRMATIVE claim only — the current text names the middle to deny it.
    expect(recenter.detail).not.toMatch(/back at the middle/i);
  });
});
