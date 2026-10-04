import { useState } from "react";
import { act, render } from "@testing-library/react";
import { vi } from "vitest";
import { useToolMode } from "../../../../hooks/useToolMode";
import { useKeyboardNavigation } from "../../../../hooks/useKeyboardNavigation";
import { useMapEditTool } from "../../useMapEditTool";
import type { MapEditSubTool } from "../../mapEditTypes";
import { makeController } from "./mapLifecycle.fixtures";

type MapOptions = Parameters<typeof useMapEditTool>[0];
type DriverProps = Pick<
  MapOptions,
  | "activeSubTool"
  | "controller"
  | "liveDocumentId"
  | "cancelSignal"
  | "toWorld"
  | "floorFamily"
  | "mapTransform"
>;
type Mode = ReturnType<typeof useToolMode>;
type MapTool = ReturnType<typeof useMapEditTool>;
const toWorld = (x: number, y: number) => ({ x, y });

// Real map/aim/drag/brush/tool/keyboard hooks. Only the stage pointer and outgoing
// controller methods are substitutes. No test-owned Escape listener is installed.
export function renderMapComposition(subTool: MapEditSubTool, driverFirst = false) {
  const controller = makeController();
  const sendMessage = vi.fn();
  const handleSelectDrawing = vi.fn();
  let mode: Mode | undefined;
  let map: MapTool | undefined;
  let selection: string | null = "token:owned";
  let props: DriverProps = {
    activeSubTool: subTool,
    controller,
    liveDocumentId: "live",
    cancelSignal: 0,
    floorFamily: "grass",
    toWorld,
    mapTransform: undefined,
  };

  function Driver({ active, options }: { active: boolean; options: DriverProps }) {
    map = useMapEditTool({ ...options, mapEditMode: active });
    return null;
  }
  function Navigation({ selectMode }: { selectMode: boolean }) {
    const [selectedObjectId, onSelectObject] = useState<string | null>("token:owned");
    selection = selectedObjectId;
    useKeyboardNavigation({
      selectedDrawingId: null,
      selectMode,
      sendMessage,
      handleSelectDrawing,
      selectedObjectId,
      onSelectObject,
    });
    return null;
  }
  function Harness({ mounted, options }: { mounted: boolean; options: DriverProps }) {
    mode = useToolMode();
    const driver = mounted ? (
      <Driver key="driver" active={mode.mapEditMode} options={options} />
    ) : null;
    const navigation = <Navigation key="navigation" selectMode={mode.selectMode} />;
    return <>{driverFirst ? [driver, navigation] : [navigation, driver]}</>;
  }
  const current = () => {
    if (!mode || !map) throw new Error("The real map/tool owners have not mounted");
    return { tool: mode, map, selectedObjectId: selection };
  };
  const view = render(<Harness mounted={driverFirst} options={props} />);
  act(() => {
    if (!mode) throw new Error("The real tool owner has not mounted");
    mode.setActiveTool("map-edit");
  });
  if (!driverFirst) view.rerender(<Harness mounted options={props} />);
  return {
    current,
    controller,
    sendMessage,
    handleSelectDrawing,
    update(next: Partial<DriverProps>) {
      props = { ...props, ...next };
      view.rerender(<Harness mounted options={props} />);
    },
    unmount: view.unmount,
  };
}

export function dispatchMapEscape() {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  // Deliberately no act here: callers can dispatch, move and release in ONE act.
  document.body.dispatchEvent(event);
  return event;
}
