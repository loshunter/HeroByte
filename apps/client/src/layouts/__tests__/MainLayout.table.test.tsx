// The desktop header's Table button and its public-table warning read the table's facts
// through useTableMenuProps. Every socket close nulls the snapshot while the app stays
// mounted; the warning is a ROW of the header, so one that went with the snapshot removed a
// row and put it back on every reconnect, and the button's name flipped to the room code.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import { createKickMobileProps } from "../../features/interaction/__tests__/kickMobile.props";

vi.mock("../../components/layout/EntitiesPanel", () => ({
  EntitiesPanel: () => <div data-testid="entities-panel" />,
}));
vi.mock("../../ui/MapBoard", () => ({ default: () => <div data-testid="map-board" /> }));
vi.mock("../../features/dm/lazy-entry", () => ({ DMMenuContainer: () => null }));

import { MainLayout } from "../MainLayout";

const tableFacts = { tableName: "Sunday Game", isPublicTable: true } as unknown as RoomSnapshot;

describe("MainLayout — the Table button and the public-table row across a reconnect", () => {
  it("keeps the table's name and the public-table warning while the snapshot is gone", () => {
    const props = createKickMobileProps();
    props.snapshot = tableFacts;
    const { rerender } = render(<MainLayout {...props} />);
    expect(screen.getByTestId("public-table-chip")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Table menu: Sunday Game,/ })).toBeInTheDocument();

    rerender(<MainLayout {...props} snapshot={null} isConnected={false} roleKnown={false} />);
    expect(screen.getByTestId("public-table-chip")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Table menu: Sunday Game, .*offline/ }),
    ).toBeInTheDocument();
  });
});
