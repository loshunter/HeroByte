import { useEffect, useRef } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type { DMMenuTab } from "../hooks/useDMMenuState";

const DM_MENU_TABS: Array<{ tab: DMMenuTab; label: string }> = [
  { tab: "map", label: "Maps" },
  { tab: "atlas", label: "World" },
  // U8: the one combat home (plan §2.1 — DM tools → Encounter).
  { tab: "encounter", label: "Encounter" },
  { tab: "npcs", label: "NPCs & Monsters" },
  { tab: "props", label: "Props & Objects" },
  // U9: invites, the roster, permissions, backups and security — what the
  // Players and Session tabs held, under the word the plan gives the table.
  { tab: "table", label: "Table" },
];

interface DMMenuTabsProps {
  activeTab: DMMenuTab;
  onTabChange: (tab: DMMenuTab) => void;
  /**
   * The phone treatment (M4b): one horizontally scrollable chip row at the
   * 44px touch floor, instead of wrapping to three rows on a 375px screen.
   * Desktop keeps the wrap — a 400px window fits it and always has.
   */
  scrollable?: boolean;
  /**
   * Changes to a nonzero value when something ("Table settings…") sent the person
   * here: the active tab takes focus, on mount and again on each later request.
   */
  focusRequest?: number;
}

export function DMMenuTabs({
  activeTab,
  onTabChange,
  scrollable = false,
  focusRequest = 0,
}: DMMenuTabsProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusRequest > 0) {
      stripRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    }
  }, [focusRequest]);

  return (
    <div
      ref={stripRef}
      style={
        scrollable
          ? {
              display: "flex",
              gap: "8px",
              marginBottom: "12px",
              flexWrap: "nowrap",
              overflowX: "auto",
              paddingBottom: "4px",
            }
          : { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }
      }
    >
      {DM_MENU_TABS.map(({ tab, label }) => (
        <JRPGButton
          key={tab}
          onClick={() => onTabChange(tab)}
          variant={activeTab === tab ? "primary" : "default"}
          aria-pressed={activeTab === tab}
          style={
            scrollable ? { minHeight: "44px", whiteSpace: "nowrap", flex: "0 0 auto" } : undefined
          }
        >
          {label}
        </JRPGButton>
      ))}
    </div>
  );
}
