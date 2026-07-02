// ============================================================================
// useDoorSfx
// ============================================================================
// Plays door foley whenever a compiled door changes state in the snapshot —
// which means every client at the table hears the same door at the same
// moment, whoever clicked it. Open/close creaks; lock/unlock clunks. The
// first observation is a silent baseline so joining a session (or receiving
// a fresh publish) makes no noise.

import { useEffect, useRef } from "react";
import type { CompiledDoor } from "@herobyte/shared";
import { sfxEngine } from "./sfxEngine";

export function useDoorSfx(doors: readonly CompiledDoor[] | undefined): void {
  const prev = useRef<Map<string, CompiledDoor["state"]> | null>(null);

  useEffect(() => {
    const previous = prev.current;
    const next = new Map((doors ?? []).map((door) => [door.id, door.state]));
    prev.current = next;

    if (previous === null) return; // baseline on mount

    for (const [id, state] of next) {
      const before = previous.get(id);
      // New doors (fresh publish or a revealed secret) enter silently.
      if (before === undefined || before === state) continue;

      if (state === "open" || (before === "open" && state === "closed")) {
        sfxEngine.play("doorCreak");
      } else if (state === "locked" || before === "locked") {
        sfxEngine.play("doorClunk");
      }
    }
  }, [doors]);
}
