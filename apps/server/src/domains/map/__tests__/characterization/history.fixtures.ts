// Real drawing history fixtures for the U2 characterization baseline.
import type { Drawing, DrawingSegmentPayload, Player } from "@herobyte/shared";
import { MapService } from "../../service.js";
import { createEmptyRoomState } from "../../../room/model.js";

export const DM = "history-dm";
export const ALICE = "history-alice";
export const BOB = "history-bob";

export function drawing(id: string, x = 0): Drawing {
  return {
    id,
    type: "freehand",
    points: [
      { x, y: 0 },
      { x: x + 10, y: 0 },
      { x: x + 20, y: 0 },
    ],
    color: "#ffffff",
    width: 4,
    opacity: 1,
  };
}

export function segment(from: number, to: number): DrawingSegmentPayload {
  return {
    type: "freehand",
    points: [
      { x: from, y: 0 },
      { x: to, y: 0 },
    ],
    color: "#ffffff",
    width: 4,
    opacity: 1,
  };
}

export function historyFixture() {
  const service = new MapService();
  const state = createEmptyRoomState();
  state.players = [DM, ALICE, BOB].map(
    (uid): Player => ({
      uid,
      name: uid,
      isDM: uid === DM,
      hp: 10,
      maxHp: 10,
      statusEffects: [],
    }),
  );
  return { service, state };
}

export function mixedHistoryFixture() {
  const fixture = historyFixture();
  fixture.service.addDrawing(fixture.state, drawing("dm-kept"), DM);
  fixture.service.addDrawing(fixture.state, drawing("alice-undone", 50), ALICE);
  // Do not replace with directly assigned stacks: this setup must exercise
  // the real operation recorder and a real Undo before its reset is tested.
  if (!fixture.service.undoDrawing(fixture.state, ALICE)) {
    throw new Error("History fixture could not undo Alice's drawing");
  }
  return fixture;
}
