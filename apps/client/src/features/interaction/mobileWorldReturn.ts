import { canReturnFocus, type DismissalFocus, type FocusResolver } from "./dismissalFocus";

export interface WorldReturnHost {
  /** True only for a remembered Tools -> World entry and a still-eligible ordinary dock. */
  canRestoreTools: () => boolean;
  showTools: () => void;
  closeRaw: () => void;
  toolsRoot: () => HTMLElement | null;
  toolsDockButton: () => HTMLElement | null;
}

export function createMobileWorldReturn(readHost: () => WorldReturnHost) {
  let restoringTools = false;
  return {
    /** Supply only to explicit World dismissal; never replace the machine's raw close. */
    closeExplicitly() {
      const host = readHost();
      restoringTools = host.canRestoreTools();
      if (restoringTools) host.showTools();
      else host.closeRaw();
    },
    resolveTarget: (() => {
      const host = readHost();
      if (restoringTools) {
        if (host.canRestoreTools()) {
          const tile =
            host.toolsRoot()?.querySelector<HTMLElement>("[data-focus-return='world']") ?? null;
          if (canReturnFocus(tile)) return tile;
        }
        host.closeRaw(); // Tools could not mount or became ineligible; fall back to the map.
      }
      return host.toolsDockButton();
    }) satisfies FocusResolver,
    /** Raw role/mode/layout/navigation paths invalidate pending return; they never open Tools. */
    closeWithoutReturn(focus: DismissalFocus) {
      restoringTools = false;
      focus.invalidate();
      readHost().closeRaw();
    },
  };
}
