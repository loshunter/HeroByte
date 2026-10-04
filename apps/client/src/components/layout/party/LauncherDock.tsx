// ============================================================================
// LAUNCHER DOCK
// ============================================================================
// The desktop's World, Props and DM MENU launchers used to be `position: fixed`
// over the bottom-right of the Party panel, where they covered the last card's
// settings and HP controls and swallowed their clicks (IA-15). They now render
// into a slot the Party bar reserves in its own layout, so they occupy space
// instead of floating over it.
//
// The dock is a REQUIRED input of every window-presentation launcher: a
// launcher that silently fell back to floating would bring the obstruction
// back unnoticed. `null` means only "the dock has not mounted yet" — the
// launcher then renders nothing for that frame.

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export type LauncherPresentation =
  | {
      /** Bare content for a host that provides the surface (the phone). */
      presentation: "content";
      /** Ignored: content has no launcher. */
      launcherDock?: HTMLElement | null;
    }
  | {
      /** Desktop: a launcher in the Party bar's dock plus a DraggableWindow. */
      presentation?: "window";
      launcherDock: HTMLElement | null;
    };

/** Left-to-right order inside the dock, whatever order the launchers mount in. */
export const LAUNCHER_ORDER = { world: 1, props: 2, dm: 3 } as const;

interface DockedLauncherProps {
  dock: HTMLElement | null;
  order: number;
  children: ReactNode;
}

export function DockedLauncher({ dock, order, children }: DockedLauncherProps): JSX.Element | null {
  if (!dock) return null;
  return createPortal(
    <div className="party-bar__launcher" style={{ order }}>
      {children}
    </div>,
    dock,
  );
}
