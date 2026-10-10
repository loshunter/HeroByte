// Every seated player's colour (C3), built once per snapshot for the chat and
// roll log names, desktop and phone (pings build their own map in
// PointersLayer, from the same resolver). A player who has left the table is
// not in `players`, so their old messages keep today's colours.

import { useMemo } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import { playerColorMap } from "./playerColors";

export function usePlayerColors(
  snapshot: Pick<RoomSnapshot, "players" | "characters" | "tokens"> | null | undefined,
): Map<string, string> {
  const players = snapshot?.players;
  const characters = snapshot?.characters;
  const tokens = snapshot?.tokens;
  return useMemo(
    () =>
      playerColorMap(
        (players ?? []).map((player) => player.uid),
        characters,
        tokens,
      ),
    [players, characters, tokens],
  );
}
