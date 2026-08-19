/**
 * buildDMMenuProps: the ONE mapping from the MainLayoutProps bag onto
 * DMMenuContainer's props, shared by desktop and mobile.
 *
 * The FloatingPanelsLayout characterization suite pins this mapping THROUGH
 * MainLayout (fixture in, mocked DMMenuContainer out); what belongs here is
 * the builder's own contract — the renames stay identity, the derivations
 * stay faithful to the wiring they replaced (defaults included), and the
 * guarded lambdas guard.
 */

import { describe, expect, it, vi } from "vitest";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
import { buildDMMenuProps } from "../buildDMMenuProps";

const createBag = (overrides: Partial<MainLayoutProps> = {}): MainLayoutProps =>
  ({
    isDM: true,
    gridSize: 50,
    gridSquareSize: 5,
    gridLocked: false,
    camera: { x: 1, y: 2, scale: 3 },
    snapshot: null,
    mapSceneObject: null,
    stagingZoneSceneObject: null,
    alignmentMode: false,
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    roomPasswordStatus: null,
    roomPasswordPending: false,
    handleToggleDM: vi.fn(),
    setGridLocked: vi.fn(),
    setGridSize: vi.fn(),
    setGridSquareSize: vi.fn(),
    sendMessage: vi.fn(),
    handleClearDrawings: vi.fn(),
    setMapBackgroundURL: vi.fn(),
    toggleSceneObjectLock: vi.fn(),
    transformSceneObject: vi.fn(),
    playerActions: { setPlayerStagingZone: vi.fn() } as unknown as MainLayoutProps["playerActions"],
    handleAlignmentStart: vi.fn(),
    handleAlignmentReset: vi.fn(),
    handleAlignmentCancel: vi.fn(),
    handleAlignmentApply: vi.fn(),
    handleSetRoomPassword: vi.fn(),
    onSaveAsPrivateTable: vi.fn(),
    dismissRoomPasswordStatus: vi.fn(),
    selectPlayerTokens: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    // A SENTINEL, not undefined: the review proved that with the fixture at
    // undefined and no assertion, deleting the builder's mapStudio mapping
    // passed every gated suite while silently removing the Map Studio section
    // from BOTH layouts (the prop is optional, so tsc is blind too).
    mapStudio: { marker: "map-studio-controller" } as unknown as MainLayoutProps["mapStudio"],
    ...overrides,
  }) as MainLayoutProps;

describe("buildDMMenuProps", () => {
  it("keeps every rename an identity, not a wrapper", () => {
    const bag = createBag();
    const built = buildDMMenuProps(bag, {});

    expect(built.onToggleDM).toBe(bag.handleToggleDM);
    expect(built.onGridSizeChange).toBe(bag.setGridSize);
    expect(built.onGridSquareSizeChange).toBe(bag.setGridSquareSize);
    expect(built.onClearDrawings).toBe(bag.handleClearDrawings);
    expect(built.onSetMapBackground).toBe(bag.setMapBackgroundURL);
    expect(built.onSetPlayerStagingZone).toBe(bag.playerActions.setPlayerStagingZone);
    expect(built.onAlignmentStart).toBe(bag.handleAlignmentStart);
    expect(built.onAlignmentReset).toBe(bag.handleAlignmentReset);
    expect(built.onAlignmentCancel).toBe(bag.handleAlignmentCancel);
    expect(built.onAlignmentApply).toBe(bag.handleAlignmentApply);
    expect(built.onSetRoomPassword).toBe(bag.handleSetRoomPassword);
    expect(built.onSaveAsPrivateTable).toBe(bag.onSaveAsPrivateTable);
    expect(built.onDismissRoomPasswordStatus).toBe(bag.dismissRoomPasswordStatus);
    expect(built.onSelectPlayerTokens).toBe(bag.selectPlayerTokens);
    expect(built.snapshot).toBe(bag.snapshot);
    expect(built.sendMessage).toBe(bag.sendMessage);
    expect(built.camera).toBe(bag.camera);
    expect(built.toast).toBe(bag.toast);
    expect(built.mapStudio).toBe(bag.mapStudio);
    expect(built.alignmentModeActive).toBe(bag.alignmentMode);
  });

  it("builds the COMPLETE prop surface — a dropped mapping is a missing key, not a quiet gap", () => {
    // The cast-shaped blindness the review confirmed: optional props make a
    // deleted mapping invisible to tsc, and a fixture only exercises fields
    // someone remembered to assert. Pinning the key set makes ANY dropped (or
    // sneaked-in) mapping red, whatever its optionality.
    const built = buildDMMenuProps(createBag(), { rollAllInitiative: vi.fn() });

    expect(Object.keys(built).sort()).toEqual(
      [
        "isDM",
        "onToggleDM",
        "gridSize",
        "gridSquareSize",
        "gridLocked",
        "onGridLockToggle",
        "onGridSizeChange",
        "onGridSquareSizeChange",
        "fogEnabled",
        "hasCompiledScene",
        "onFogEnabledChange",
        "onClearDrawings",
        "onSetMapBackground",
        "mapBackground",
        "mapLocked",
        "onMapLockToggle",
        "mapTransform",
        "onMapTransformChange",
        "playerStagingZone",
        "onSetPlayerStagingZone",
        "stagingZoneLocked",
        "onStagingZoneLockToggle",
        "alignmentModeActive",
        "alignmentPoints",
        "alignmentSuggestion",
        "alignmentError",
        "onAlignmentStart",
        "onAlignmentReset",
        "onAlignmentCancel",
        "onAlignmentApply",
        "onSetRoomPassword",
        "onSaveAsPrivateTable",
        "roomPasswordStatus",
        "roomPasswordPending",
        "onDismissRoomPasswordStatus",
        "snapshot",
        "sendMessage",
        "camera",
        "toast",
        "onSelectPlayerTokens",
        "onRollAllInitiative",
        "mapStudio",
      ].sort(),
    );
  });

  it("derives the snapshot-backed fields with the wiring's exact defaults", () => {
    const nullCase = buildDMMenuProps(createBag(), {});
    expect(nullCase.fogEnabled).toBe(false);
    expect(nullCase.hasCompiledScene).toBe(false);
    expect(nullCase.mapBackground).toBeUndefined();
    expect(nullCase.playerStagingZone).toBeUndefined();

    const snapshot = {
      fogEnabled: true,
      compiledScene: { rooms: [] },
      mapBackground: "https://example.com/map.jpg",
      playerStagingZone: { x: 0, y: 0, width: 4, height: 3 },
    } as unknown as MainLayoutProps["snapshot"];
    const built = buildDMMenuProps(createBag({ snapshot }), {});
    expect(built.fogEnabled).toBe(true);
    expect(built.hasCompiledScene).toBe(true);
    expect(built.mapBackground).toBe("https://example.com/map.jpg");
    expect(built.playerStagingZone).toEqual({ x: 0, y: 0, width: 4, height: 3 });
  });

  it("onFogEnabledChange speaks the wire protocol directly", () => {
    const bag = createBag();
    buildDMMenuProps(bag, {}).onFogEnabledChange!(true);

    expect(bag.sendMessage).toHaveBeenCalledExactlyOnceWith({
      t: "set-fog-enabled",
      enabled: true,
    });
  });

  it("onGridLockToggle flips through the functional updater", () => {
    const bag = createBag();
    buildDMMenuProps(bag, {}).onGridLockToggle();

    expect(bag.setGridLocked).toHaveBeenCalledTimes(1);
    const updater = vi.mocked(bag.setGridLocked).mock.calls[0][0] as (prev: boolean) => boolean;
    expect(updater(true)).toBe(false);
    expect(updater(false)).toBe(true);
  });

  it("map lock: locked-by-default without a scene object, and the toggle guards", () => {
    const nullBag = createBag();
    const nullBuilt = buildDMMenuProps(nullBag, {});
    expect(nullBuilt.mapLocked).toBe(true);
    nullBuilt.onMapLockToggle!();
    expect(nullBag.toggleSceneObjectLock).not.toHaveBeenCalled();

    const bag = createBag({
      mapSceneObject: {
        id: "map-1",
        locked: false,
        transform: { x: 9, y: 8, scaleX: 2, scaleY: 2, rotation: 45 },
      },
    });
    const built = buildDMMenuProps(bag, {});
    expect(built.mapLocked).toBe(false);
    expect(built.mapTransform).toEqual({ x: 9, y: 8, scaleX: 2, scaleY: 2, rotation: 45 });
    built.onMapLockToggle!();
    expect(bag.toggleSceneObjectLock).toHaveBeenCalledExactlyOnceWith("map-1", true);
  });

  it("mapTransform falls back to the identity transform", () => {
    expect(buildDMMenuProps(createBag(), {}).mapTransform).toEqual({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
  });

  it("onMapTransformChange forwards only the axes that arrived complete", () => {
    const bag = createBag({
      mapSceneObject: {
        id: "map-1",
        locked: false,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      },
    });
    const built = buildDMMenuProps(bag, {});

    built.onMapTransformChange!({ x: 10, y: 20, scaleX: 2, scaleY: 3, rotation: 90 });
    expect(bag.transformSceneObject).toHaveBeenLastCalledWith({
      id: "map-1",
      position: { x: 10, y: 20 },
      scale: { x: 2, y: 3 },
      rotation: 90,
    });

    // A lone x (no y) is NOT a position; a lone rotation is a rotation.
    built.onMapTransformChange!({ x: 10, rotation: 15 });
    expect(bag.transformSceneObject).toHaveBeenLastCalledWith({ id: "map-1", rotation: 15 });

    const nullBag = createBag();
    buildDMMenuProps(nullBag, {}).onMapTransformChange!({ rotation: 15 });
    expect(nullBag.transformSceneObject).not.toHaveBeenCalled();
  });

  it("staging zone lock: unlocked-by-default without an object, and the toggle guards", () => {
    const nullBag = createBag();
    const nullBuilt = buildDMMenuProps(nullBag, {});
    expect(nullBuilt.stagingZoneLocked).toBe(false);
    nullBuilt.onStagingZoneLockToggle!();
    expect(nullBag.toggleSceneObjectLock).not.toHaveBeenCalled();

    const bag = createBag({ stagingZoneSceneObject: { id: "staging-1", locked: true } });
    const built = buildDMMenuProps(bag, {});
    expect(built.stagingZoneLocked).toBe(true);
    built.onStagingZoneLockToggle!();
    expect(bag.toggleSceneObjectLock).toHaveBeenCalledExactlyOnceWith("staging-1", false);
  });

  it("onRollAllInitiative rides the extras, because it is a hook result", () => {
    const rollAllInitiative = vi.fn();
    expect(buildDMMenuProps(createBag(), { rollAllInitiative }).onRollAllInitiative).toBe(
      rollAllInitiative,
    );
    expect(buildDMMenuProps(createBag(), {}).onRollAllInitiative).toBeUndefined();
  });
});
