import { JRPGButton } from "../../../components/ui/JRPGPanel";
import type { DMMenuTab } from "../hooks/useDMMenuState";

const DM_MENU_TABS: Array<{ tab: DMMenuTab; label: string }> = [
  { tab: "map", label: "Map Setup" },
  { tab: "npcs", label: "NPCs & Monsters" },
  { tab: "props", label: "Props & Objects" },
  { tab: "players", label: "Players" },
  { tab: "session", label: "Session" },
];

interface DMMenuTabsProps {
  activeTab: DMMenuTab;
  onTabChange: (tab: DMMenuTab) => void;
}

export function DMMenuTabs({ activeTab, onTabChange }: DMMenuTabsProps) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
      {DM_MENU_TABS.map(({ tab, label }) => (
        <JRPGButton
          key={tab}
          onClick={() => onTabChange(tab)}
          variant={activeTab === tab ? "primary" : "default"}
        >
          {label}
        </JRPGButton>
      ))}
    </div>
  );
}
