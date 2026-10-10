// Every seated player's colour (C3), built once per snapshot for the chat and
// roll log names, desktop and phone (pings build their own map in
// PointersLayer, from the same resolver). A player who has left the table is
// not in `players`, so their old messages keep today's colours.

import { useMemo, useRef } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import { playerColorMap } from "./playerColors";

export function usePlayerColors(
  snapshot: Pick<RoomSnapshot, "players" | "characters" | "tokens"> | null | undefined,
): Map<string, string> {
  const players = snapshot?.players;
  const characters = snapshot?.characters;
  const tokens = snapshot?.tokens;
  // Every snapshot brings new arrays, so the map is rebuilt each time; while the
  // colours are the same the previous map is kept, and the names built from it
  // (chat, roll log) are not worked out again on every broadcast.
  const previous = useRef<Map<string, string>>(new Map());
  return useMemo(() => {
    const next = playerColorMap(
      (players ?? []).map((player) => player.uid),
      characters,
      tokens,
    );
    if (sameColors(next, previous.current)) return previous.current;
    previous.current = next;
    return next;
  }, [players, characters, tokens]);
}

function sameColors(next: ReadonlyMap<string, string>, last: ReadonlyMap<string, string>) {
  if (next.size !== last.size) return false;
  for (const [uid, color] of next) if (last.get(uid) !== color) return false;
  return true;
}
