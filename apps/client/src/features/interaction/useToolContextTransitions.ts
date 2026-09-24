import { useEffect, useLayoutEffect, useRef } from "react";
import type { ToolMode } from "../../components/layout/Header";
import type { ToolContext } from "../../hooks/useToolMode";
import { escapeRegistry } from "./useEscapeOwner";
import { dismissalFocus } from "./dismissalFocus";

export function useToolContextTransitions(
  context: ToolContext | undefined,
  setActiveTool: (mode: ToolMode) => void,
): void {
  const knownUid = useRef<string | undefined>(undefined);
  const previous = useRef<{
    isDM: boolean;
    map?: string;
    scene?: string;
    node?: string;
    background?: string;
  } | null>(null);
  useLayoutEffect(() => {
    if (!context) return;
    const { snapshot, uid, isDM } = context;
    const oldUid = knownUid.current;
    knownUid.current = uid;
    // Identity is explicit even while the new user's roster is unknown. Forget
    // the old role/surface before cancellation so the first new snapshot seeds it.
    if (oldUid !== undefined && oldUid !== uid) {
      previous.current = null;
      escapeRegistry.cancelForTransition();
      dismissalFocus.invalidate();
      setActiveTool(null);
    }
    // A same-UID missing roster is unknown, including temporary reconnect gaps.
    if (!snapshot?.players.some((player) => player.uid === uid)) return;
    const next = {
      isDM,
      map: snapshot.liveMapDocumentId,
      scene: snapshot.compiledScene?.sourceDocumentId,
      node: snapshot.currentAtlasNodeId,
      background: snapshot.mapBackground,
    };
    const old = previous.current;
    previous.current = next;
    if (!old) return;
    if (old.isDM && !isDM) {
      escapeRegistry.cancelForTransition();
      dismissalFocus.invalidate();
      setActiveTool(null);
    } else if (
      old.map !== next.map ||
      old.scene !== next.scene ||
      old.node !== next.node ||
      old.background !== next.background
    ) {
      escapeRegistry.cancelForTransition();
      dismissalFocus.invalidate();
    }
  }, [context, setActiveTool]);
  const enabled = context !== undefined;
  useEffect(() => {
    if (!enabled) return;
    const cancelForLayout = () => {
      escapeRegistry.cancelForTransition();
      dismissalFocus.invalidate();
    };
    window.addEventListener("resize", cancelForLayout);
    window.addEventListener("orientationchange", cancelForLayout);
    return () => {
      window.removeEventListener("resize", cancelForLayout);
      window.removeEventListener("orientationchange", cancelForLayout);
    };
  }, [enabled]);
}
