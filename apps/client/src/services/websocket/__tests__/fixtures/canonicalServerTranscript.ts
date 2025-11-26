import type { RoomSnapshot } from "@shared";
import type { SignalData } from "simple-peer";

export interface TranscriptEntry {
  label: string;
  payload: string;
}

const minimalSnapshot: RoomSnapshot = {
  users: [],
  stateVersion: 1,
  tokens: [],
  players: [],
  characters: [],
  props: [],
  mapBackground: undefined,
  pointers: [],
  drawings: [],
  gridSize: 50,
  gridSquareSize: 5,
  diceRolls: [],
  sceneObjects: [],
  selectionState: {},
  combatActive: false,
};

export const canonicalServerTranscript: TranscriptEntry[] = [
  {
    label: "rtc-signal",
    payload: JSON.stringify({
      t: "rtc-signal",
      from: "peer-a",
      signal: { type: "offer", sdp: "fake-sdp" } as SignalData,
    }),
  },
  {
    label: "auth-ok",
    payload: JSON.stringify({ t: "auth-ok" as const }),
  },
  {
    label: "heartbeat-ack",
    payload: JSON.stringify({ t: "heartbeat-ack" as const, timestamp: 1_730_000_000_000 }),
  },
  {
    label: "dm-status",
    payload: JSON.stringify({ t: "dm-status" as const, isDM: true }),
  },
  {
    label: "ack",
    payload: JSON.stringify({ t: "ack" as const, commandId: "cmd-1" }),
  },
  {
    label: "snapshot",
    payload: JSON.stringify(minimalSnapshot),
  },
];
