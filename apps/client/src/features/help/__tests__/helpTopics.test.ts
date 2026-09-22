// The in-app glossary is a second home for user-facing copy, and correcting the
// user guide left it behind: it told players Recenter goes to "the middle of the
// map" long after the code settled on the origin. The file's own header asks for
// the two to be kept in step, and nothing checked.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

describe("helpTopics stays in step with the seat's rules", () => {
  it("the hold it quotes is the server's SESSION_TOKEN_GRACE_MS, read from its source", () => {
    const graceSource = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../../../server/src/ws/auth/SessionTokenService.ts",
      ),
      "utf8",
    );
    const graceHours = Number(
      graceSource.match(/SESSION_TOKEN_GRACE_MS = (\d+) \* 60 \* 60 \* 1000/)?.[1],
    );
    expect(graceHours, "the grace window moved — update the seat help topic").toBe(6);
    expect(entry("seat", "Try Again").detail).toMatch(/up to six hours/);
    expect(entry("seat", "Try Again").detail).toMatch(/more retries will not shorten/);
  });

  it("a fresh session is described as what it costs: a new player, the old character left behind, DM powers gone", () => {
    const fresh = entry("seat", "Start a Fresh Session").detail;
    expect(fresh).toMatch(/new player/);
    expect(fresh).toMatch(/old character/);
    expect(fresh).toMatch(/DM password/);
  });

  it("the DM topic offers the seat's cleanup — REMOVE — and says it is not a ban", () => {
    const remove = entry("dm", "REMOVE (a player)").detail;
    expect(remove).toMatch(/not at the table/);
    expect(remove).toMatch(/[Nn]ot a ban/);
  });
});
