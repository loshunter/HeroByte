// ============================================================================
// TABLE MENU (the header's Table button)
// ============================================================================
// The header's home for the TABLE: its name, the connection and a DM's mark, with
// a menu behind it for role (Enter / Leave DM mode), personal Preferences and,
// for a DM, the way on to the table's settings. It replaces the UID block, the
// fixed ONLINE badge, and the CRT and Juice buttons that each had their own
// place in the toolbar.
//
// The popover is PORTALLED to document.body, for HelpMenuButton's reason: the
// header is a fixed container at z-index 100, so a child cannot paint above the
// Party bar, and this panel is taller than a couple of rows. It anchors to the
// button's LEFT edge (Help, at the far right, anchors to its right).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { JRPGButton, JRPGPanel } from "../../components/ui/JRPGPanel";
import { EscapeRootProvider, useEscapeOwner, useEscapeRoot } from "../interaction/useEscapeOwner";
import { usePopoverFocus } from "../interaction/usePopoverFocus";
import { currentRoomId, listRememberedRooms } from "../rooms/roomDirectory";
import { TableMenuContent } from "./TableMenuContent";
import { requestDMMenuTab } from "./menuRequest";
import { tableLabel } from "./tableLabel";
import type { TableMenuProps } from "./tableMenuProps";
import "./table.css";

interface Anchor {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Park the popover under the HEADER, flush to the button's left edge. Under the
 * header's bottom edge, not the button's: the button sits beside two rows of
 * controls, and a panel hung from the button would cover the second row.
 */
function anchorTo(el: HTMLElement | null): Anchor | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const headerBottom =
    el.closest("[data-header-root]")?.getBoundingClientRect().bottom ?? rect.bottom;
  const top = Math.max(rect.bottom, headerBottom) + 6;
  return {
    top,
    left: Math.max(8, rect.left),
    maxHeight: Math.max(160, window.innerHeight - top - 12),
  };
}

/** The table's name for this viewer: the snapshot's, else what this browser remembered. */
export function useTableLabel(tableName: string | undefined): string {
  return useMemo(() => {
    const roomId = currentRoomId();
    const rememberedName = tableName
      ? undefined
      : listRememberedRooms().find((room) => room.roomId === roomId)?.name;
    return tableLabel({ tableName, roomId, rememberedName });
  }, [tableName]);
}

export const TableMenu: React.FC<{ menu: TableMenuProps }> = ({ menu }) => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const label = useTableLabel(menu.tableName);
  const escapeRoot = useEscapeRoot(popRef, 2000);
  const { closeToLauncher, onKeyDown } = usePopoverFocus({ open, popRef, wrapRef, setOpen });
  useEscapeOwner(() => ({
    kind: "popover",
    name: "Table menu",
    active: open && anchor !== null,
    root: escapeRoot,
    anchor: popRef.current,
    handle: closeToLauncher,
  }));

  const toggle = useCallback(() => {
    if (open) {
      closeToLauncher();
      return;
    }
    setAnchor(anchorTo(wrapRef.current));
    setOpen(true);
  }, [open, closeToLauncher]);

  useEffect(() => {
    if (!open) return;
    // The header wraps and its contents change (Build map and Player View join
    // it on elevation), so the button can move without a window resize, and the
    // header's bottom edge — where the popover hangs — can move while the capped
    // button does not. Observe the button, its parent, and the header itself.
    const reanchor = () => setAnchor(anchorTo(wrapRef.current));
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        wrapRef.current?.contains(target) === true || popRef.current?.contains(target) === true;
      if (!inside) setOpen(false);
    };
    const observer =
      typeof ResizeObserver === "undefined" || !wrapRef.current
        ? null
        : new ResizeObserver(reanchor);
    observer?.observe(wrapRef.current as Element);
    if (wrapRef.current?.parentElement) observer?.observe(wrapRef.current.parentElement);
    const header = wrapRef.current?.closest("[data-header-root]");
    if (header) observer?.observe(header);
    window.addEventListener("resize", reanchor);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", reanchor);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  const roleText = !menu.roleKnown ? "…" : menu.isDM ? "DM" : "Player";
  const status = menu.isConnected ? "online" : "offline";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <JRPGButton
        className="table-menu-button"
        onClick={toggle}
        variant={open ? "primary" : "default"}
        style={{ padding: "4px 6px" }}
        aria-haspopup="dialog"
        aria-expanded={open}
        // Label in name: the button PRINTS "DM", so the name says "DM" too (speech input
        // matches what is printed) and keeps "Dungeon Master" for a screen reader.
        aria-label={`Table menu: ${label}, ${roleText === "DM" ? "DM, Dungeon Master" : roleText}, ${status}`}
        title="Table: your role, preferences and settings"
      >
        <span aria-hidden="true">{menu.isConnected ? "🟢" : "🔴"}</span>
        <span className="table-menu-button__name">{label}</span>
        {/* A player is the default, so the word is not spent on one: the dot and the
            name say where you are, a DM gets a mark, and the accessible name keeps
            the role. OFFLINE and the unknown-role dots still show. */}
        {(!menu.isConnected || roleText !== "Player") && (
          <span className="table-menu-button__role" aria-hidden="true">
            {menu.isConnected ? roleText : "OFFLINE"}
          </span>
        )}
        <span aria-hidden="true">▾</span>
      </JRPGButton>

      {open &&
        anchor &&
        createPortal(
          <EscapeRootProvider value={escapeRoot}>
            <div
              ref={popRef}
              role="dialog"
              aria-label="Table menu"
              tabIndex={-1}
              onKeyDown={onKeyDown}
              style={{
                position: "fixed",
                top: anchor.top,
                left: anchor.left,
                zIndex: 2000,
                maxHeight: anchor.maxHeight,
                display: "flex",
              }}
            >
              <JRPGPanel
                variant="bevel"
                style={{
                  padding: "12px",
                  width: "340px",
                  maxWidth: "calc(100vw - 16px)",
                  overflowY: "auto",
                }}
              >
                <TableMenuContent
                  menu={{
                    ...menu,
                    // The password dialog opens above everything: leave no popover
                    // behind it to be reached around it.
                    onToggleDM: (next) => {
                      setOpen(false);
                      menu.onToggleDM(next);
                    },
                  }}
                  label={label}
                  showConnection
                  onOpenTableSettings={() => {
                    setOpen(false);
                    requestDMMenuTab("table");
                  }}
                />
              </JRPGPanel>
            </div>
          </EscapeRootProvider>,
          document.body,
        )}
    </div>
  );
};
