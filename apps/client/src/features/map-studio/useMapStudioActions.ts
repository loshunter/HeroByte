import { useCallback, useMemo, type MutableRefObject } from "react";
import type {
  ClientMessage,
  MapDocument,
  MapDoorState,
  MapElement,
  MapElementUpdate,
  MapGridUpdate,
  MapLayerUpdate,
  MapStudioCommand,
  TerrainPaintCell,
} from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import {
  createDoorElement,
  createShapeElement,
  createStampElement,
  createTileElement,
  createLightElement,
  createWallElement,
} from "./elementBuilders";
import type {
  GenerateInput,
  MapDoorDraft,
  MapShapeDraft,
  MapStampDraft,
  MapTileDraft,
  MapLightDraft,
  MapWallDraft,
} from "./types";

type CommandBuilder = (document: MapDocument, commandId: string) => MapStudioCommand;
type MessageBuilder = (document: MapDocument, commandId: string) => ClientMessage;

/** Omit that distributes over a discriminated union (plain Omit collapses it). */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
/** A command minus the envelope the queue stamps on every one of them. */
type CommandBody = DistributiveOmit<MapStudioCommand, "commandId" | "documentId" | "baseRevision">;

interface UseMapStudioActionsOptions {
  activeDocumentRef: MutableRefObject<MapDocument | null>;
  applyCommand: (build: CommandBuilder) => void;
  applyMessage: (toMessage: MessageBuilder) => void;
}

/**
 * The command-emitting actions of the controller: every one is `submit` with a
 * typed command body — the queue (useMapStudio) stamps the commandId /
 * documentId / baseRevision envelope. The add-element helpers also mint ids
 * and preserve the null / empty-array returns callers rely on.
 */
export function useMapStudioActions({
  activeDocumentRef,
  applyCommand,
  applyMessage,
}: UseMapStudioActionsOptions) {
  const submit = useCallback(
    (body: CommandBody) => {
      applyCommand(
        (document, commandId) =>
          ({
            commandId,
            documentId: document.id,
            baseRevision: document.revision,
            ...body,
            // Recombining a distributive omit with exactly the omitted fields
            // is sound, but TypeScript cannot prove it across the union.
          }) as MapStudioCommand,
      );
    },
    [applyCommand],
  );

  /** Mint one element via `create` and submit it as one add-element command. */
  const elementAdder = useCallback(
    <Draft>(create: (id: string, draft: Draft) => MapElement) =>
      (draft: Draft): string | null => {
        if (!activeDocumentRef.current) return null;
        const element = create(generateUUID(), draft);
        submit({ type: "add-element", element });
        return element.id;
      },
    [activeDocumentRef, submit],
  );

  /** Batch twin of elementAdder: one command, one undo step, ids returned. */
  const elementsAdder = useCallback(
    <Draft>(create: (id: string, draft: Draft) => MapElement) =>
      (drafts: Draft[]): string[] => {
        if (!activeDocumentRef.current || drafts.length === 0) return [];
        const elements = drafts.map((draft) => create(generateUUID(), draft));
        submit({ type: "add-elements", elements });
        return elements.map((element) => element.id);
      },
    [activeDocumentRef, submit],
  );

  const addShape = useMemo(() => elementAdder<MapShapeDraft>(createShapeElement), [elementAdder]);
  const addTile = useMemo(() => elementAdder<MapTileDraft>(createTileElement), [elementAdder]);
  const addStamp = useMemo(() => elementAdder<MapStampDraft>(createStampElement), [elementAdder]);
  const addWall = useMemo(() => elementAdder<MapWallDraft>(createWallElement), [elementAdder]);
  const addDoor = useMemo(() => elementAdder<MapDoorDraft>(createDoorElement), [elementAdder]);
  const addLight = useMemo(() => elementAdder<MapLightDraft>(createLightElement), [elementAdder]);
  const addTiles = useMemo(() => elementsAdder<MapTileDraft>(createTileElement), [elementsAdder]);
  const addStamps = useMemo(
    () => elementsAdder<MapStampDraft>(createStampElement),
    [elementsAdder],
  );

  const updateLayer = useCallback(
    (layerId: string, update: MapLayerUpdate) => submit({ type: "update-layer", layerId, update }),
    [submit],
  );

  const moveLayer = useCallback(
    (layerId: string, targetIndex: number) => submit({ type: "move-layer", layerId, targetIndex }),
    [submit],
  );

  const updateGrid = useCallback(
    (update: MapGridUpdate) => submit({ type: "update-grid", update }),
    [submit],
  );

  const paintTerrain = useCallback(
    (cells: TerrainPaintCell[]) => {
      if (!activeDocumentRef.current || cells.length === 0) return;
      submit({ type: "paint-terrain", cells });
    },
    [activeDocumentRef, submit],
  );

  const placeRoom = useCallback(
    (cells: TerrainPaintCell[], elements: MapElement[]) => {
      if (!activeDocumentRef.current || cells.length === 0 || elements.length === 0) return;
      // Floor terrain + wall perimeter as ONE command = ONE undo step.
      submit({ type: "place-room", cells, elements });
    },
    [activeDocumentRef, submit],
  );

  const removeElement = useCallback(
    (elementId: string) => submit({ type: "remove-element", elementId }),
    [submit],
  );

  const updateElement = useCallback(
    (elementId: string, update: MapElementUpdate) =>
      submit({ type: "update-element", elementId, update }),
    [submit],
  );

  const updateDoor = useCallback(
    (elementId: string, update: { state: MapDoorState; width: number }) =>
      submit({ type: "update-door", elementId, state: update.state, width: update.width }),
    [submit],
  );

  /**
   * Run a server-side recipe over a region. Its own message type, not a
   * map-studio-command — the server builds the command from the recipe's output
   * so a whole dungeon costs one undo and never crosses the wire. It rides the
   * queue anyway: that is what mints the commandId the server echoes back, and
   * the ONLY thing that surfaces a rejection (the controller drops any
   * map-studio-error whose commandId it did not mint).
   */
  const generate = useCallback(
    (input: GenerateInput) => {
      applyMessage((document, commandId) => ({
        t: "map-studio-generate",
        documentId: document.id,
        commandId,
        recipe: input.recipe,
        seed: input.seed,
        bounds: input.bounds,
        params: input.params,
      }));
    },
    [applyMessage],
  );

  const undo = useCallback(() => submit({ type: "undo" }), [submit]);
  const redo = useCallback(() => submit({ type: "redo" }), [submit]);

  return {
    updateLayer,
    moveLayer,
    updateGrid,
    addTile,
    addTiles,
    addStamp,
    addStamps,
    paintTerrain,
    placeRoom,
    addShape,
    addWall,
    addDoor,
    addLight,
    removeElement,
    updateElement,
    updateDoor,
    generate,
    undo,
    redo,
  };
}
