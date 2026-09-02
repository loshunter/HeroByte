import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type { DMMenuTab } from "../hooks/useDMMenuState";

const DM_MENU_TABS: Array<{ tab: DMMenuTab; label: string }> = [
  { tab: "map", label: "Map Setup" },
  { tab: "atlas", label: "Atlas" },
  { tab: "npcs", label: "NPCs & Monsters" },
  { tab: "props", label: "Props & Objects" },
  { tab: "players", label: "Players" },
  { tab: "session", label: "Session" },
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
}

export function DMMenuTabs({ activeTab, onTabChange, scrollable = false }: DMMenuTabsProps) {
  return (
    <div
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
