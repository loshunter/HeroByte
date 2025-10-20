// ============================================================================
// VTT CLIENT APP
// ============================================================================
// Main application component for the Virtual Tabletop client.
// Manages:
// - Network connection and room state
// - Player management and voice chat
// - UI layout (fixed top/bottom bars, center map canvas)
// - Tool modes (pointer, measure, draw)

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapBoard from "./MapBoard";
import type { Camera } from "../hooks/useCamera";
import { useVoiceChat } from "./useVoiceChat";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import type { RollResult, DieType } from "../components/dice/types";
import type {
  Player,
  PlayerState,
  RoomSnapshot,
  ClientMessage,
  ServerMessage,
  PlayerStagingZone,
  TokenSize,
} from "@shared";
import { WS_URL } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMicrophone } from "../hooks/useMicrophone";
import { useDrawingState } from "../hooks/useDrawingState";
import { usePlayerEditing } from "../hooks/usePlayerEditing";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useDMRole } from "../hooks/useDMRole";
import { useObjectSelection } from "../hooks/useObjectSelection";
import { useToolMode } from "../hooks/useToolMode";
import { useCameraCommands } from "../hooks/useCameraCommands";
import { useSceneObjectSelectors } from "../hooks/useSceneObjectSelectors";
import { useSceneObjectActions } from "../hooks/useSceneObjectActions";
import { DMMenu } from "../features/dm";
import { getSessionUID } from "../utils/session";
import { saveSession, loadSession } from "../utils/sessionPersistence";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { EntitiesPanel } from "../components/layout/EntitiesPanel";
import { VisualEffects } from "../components/effects/VisualEffects";
import { ServerStatus } from "../components/layout/ServerStatus";
import { MultiSelectToolbar } from "../components/layout/MultiSelectToolbar";
import { AuthState } from "../services/websocket";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import { computeMapAlignmentTransform } from "../utils/mapAlignment";
import { useToast } from "../hooks/useToast";
import { useStatusEffects } from "../hooks/useStatusEffects";
import { ToastContainer } from "../components/ui/Toast";
import { useE2ETestingSupport } from "../utils/useE2ETestingSupport";
import { AuthenticationGate } from "../features/auth";
import { ContextMenu } from "../components/ui/ContextMenu";
import { useMapActions } from "../hooks/useMapActions";

interface RollLogEntry extends RollResult {
  playerName: string;
}

// ----------------------------------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------------------------------

export const App: React.FC = () => {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  // Network and session
  const uid = getSessionUID(); // This player's unique ID
  const {
    snapshot,
    connectionState,
    send: sendMessage,
    authState,
    authError,
    isConnected,
    authenticate,
    connect,
    registerRtcHandler,
    registerServerEventHandler,
  } = useWebSocket({
    url: WS_URL,
    uid,
  });

  return (
    <AuthenticationGate
      url={WS_URL}
      uid={uid}
      onAuthenticate={authenticate}
      onConnect={connect}
      isConnected={isConnected}
      connectionState={connectionState}
      authState={authState}
      authError={authError}
    >
      <AuthenticatedApp
        uid={uid}
        snapshot={snapshot}
        sendMessage={sendMessage}
        registerRtcHandler={registerRtcHandler}
        registerServerEventHandler={registerServerEventHandler}
        isConnected={isConnected}
        authState={authState}
      />
    </AuthenticationGate>
  );
};

interface AuthenticatedAppProps {
  uid: string;
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;
  isConnected: boolean;
  authState: AuthState;
}

type RoomPasswordStatus = { type: "success" | "error"; message: string };

function AuthenticatedApp({
  uid,
  snapshot,
  sendMessage,
  registerRtcHandler,
  registerServerEventHandler,
  isConnected,
  authState: _authState,
}: AuthenticatedAppProps): JSX.Element {
  // Custom hooks for state management
  const { micEnabled, micStream, toggleMic } = useMicrophone({ sendMessage });
  const {
    drawTool,
    drawColor,
    drawWidth,
    drawOpacity,
    drawFilled,
    canUndo,
    canRedo,
    setDrawTool,
    setDrawColor,
    setDrawWidth,
    setDrawOpacity,
    setDrawFilled,
    addToHistory,
    popFromHistory,
    popFromRedoHistory,
    clearHistory,
  } = useDrawingState();

  // Heartbeat to prevent timeout (only after authentication)
  useHeartbeat({ sendMessage });
  const {
    editingPlayerUID,
    nameInput,
    editingMaxHpUID,
    maxHpInput,
    startNameEdit,
    updateNameInput,
    submitNameEdit,
    startMaxHpEdit,
    updateMaxHpInput,
    submitMaxHpEdit,
  } = usePlayerEditing();

  // Toast notifications
  const toast = useToast();

  // Map controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridLocked, setGridLocked] = useState(false);

  // Tool modes
  const {
    activeTool,
    setActiveTool,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
  } = useToolMode();

  // Camera state (for viewport-based prop placement)
  const [cameraState, setCameraState] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const [alignmentPoints, setAlignmentPoints] = useState<AlignmentPoint[]>([]);
  const [alignmentSuggestion, setAlignmentSuggestion] = useState<AlignmentSuggestion | null>(null);
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  // Server-synced object selection state
  const {
    selectedObjectId,
    selectedObjectIds,
    selectObject,
    selectMultiple,
    deselect: clearSelection,
    lockSelected,
    unlockSelected,
  } = useObjectSelection({ uid, snapshot, sendMessage });

  // UI layout (fixed panels)
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const [topHeight, setTopHeight] = useState(180);
  const [bottomHeight, setBottomHeight] = useState(210);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(
    null,
  );

  // CRT filter toggle
  const [crtFilter, setCrtFilter] = useState(false);

  // Camera commands
  const { cameraCommand, handleFocusSelf, handleResetCamera, handleCameraCommandHandled } =
    useCameraCommands({ snapshot, uid });

  // Camera state (from MapBoard)
  const [camera, _setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });

  // Dice roller toggle and state
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [rollLogOpen, setRollLogOpen] = useState(false);
  const [viewingRoll, setViewingRoll] = useState<RollResult | null>(null);
  const [roomPasswordStatus, setRoomPasswordStatus] = useState<RoomPasswordStatus | null>(null);
  const [roomPasswordPending, setRoomPasswordPending] = useState(false);

  // Get roll history from server snapshot
  const rollHistory: RollLogEntry[] = React.useMemo(() => {
    return (snapshot?.diceRolls || []).map((roll) => ({
      id: roll.id,
      playerName: roll.playerName,
      tokens: [], // Not needed for display
      perDie: roll.breakdown.map((b) => ({
        tokenId: b.tokenId,
        die: b.die as DieType | undefined,
        rolls: b.rolls,
        subtotal: b.subtotal,
      })),
      total: roll.total,
      timestamp: roll.timestamp,
    }));
  }, [snapshot?.diceRolls]);

  // -------------------------------------------------------------------------
  // VOICE CHAT
  // -------------------------------------------------------------------------

  // Get list of other players for P2P voice connections
  const otherPlayerUIDs = React.useMemo(() => {
    return snapshot?.players?.filter((p: Player) => p.uid !== uid).map((p: Player) => p.uid) || [];
  }, [snapshot?.players, uid]);

  useVoiceChat({
    sendMessage,
    onRtcSignal: registerRtcHandler,
    uid,
    otherPlayerUIDs,
    enabled: micEnabled,
    stream: micStream,
  });

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------

  // Network connection is now handled by useWebSocket hook

  /**
   * Measure top and bottom panel heights for layout calculations
   * Re-measures on window resize and when player list changes
   */
  useEffect(() => {
    const measureHeights = () => {
      if (topPanelRef.current) {
        setTopHeight(topPanelRef.current.offsetHeight);
      }
      if (bottomPanelRef.current) {
        setBottomHeight(bottomPanelRef.current.offsetHeight);
      }
    };

    measureHeights();
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, [snapshot?.players]);

  /**
   * Keyboard shortcuts
   * Ctrl+Z / Cmd+Z: Undo last drawing
   * Delete/Backspace: Delete selected object (moved after isDM declaration)
   */

  // Clear selection when switching away from transform/select mode to other tools
  useEffect(() => {
    if (!transformMode && !selectMode) {
      clearSelection();
    }
  }, [transformMode, selectMode, clearSelection]);

  useEffect(() => {
    registerServerEventHandler((message: ServerMessage) => {
      if ("t" in message && message.t === "room-password-updated") {
        setRoomPasswordPending(false);
        setRoomPasswordStatus({
          type: "success",
          message: "Room password updated successfully.",
        });
      } else if ("t" in message && message.t === "room-password-update-failed") {
        setRoomPasswordPending(false);
        setRoomPasswordStatus({
          type: "error",
          message: message.reason ?? "Unable to update room password.",
        });
      } else if ("t" in message && message.t === "dm-status") {
        // DM elevation successful
        if (message.isDM) {
          toast.success("DM elevation successful! You are now the Dungeon Master.", 4000);
        }
      } else if ("t" in message && message.t === "dm-elevation-failed") {
        // DM elevation failed
        toast.error(`DM elevation failed: ${message.reason}`, 5000);
      }
    });
  }, [registerServerEventHandler, toast]);

  // Selection handlers
  const { handleObjectSelection, handleObjectSelectionBatch } = useSceneObjectSelectors({
    selectedObjectIds,
    selectObject,
    selectMultiple,
    clearSelection,
  });

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Scene object actions (tokens, map, props, staging zone)
   */
  const {
    recolorToken,
    transformSceneObject,
    toggleSceneObjectLock,
    deleteToken,
    updateTokenImage,
    updateTokenSize,
  } = useSceneObjectActions({ sendMessage });

  /**
   * Status effects management
   */
  const { setStatusEffects } = useStatusEffects({ sendMessage });

  /**
   * Player actions
   */
  const renamePlayer = (name: string) => {
    sendMessage({ t: "rename", name });
  };

  const setPortraitURL = (url: string) => {
    console.log(`[App] Setting portrait URL: ${url.substring(0, 50)}...`);
    sendMessage({ t: "portrait", data: url });
  };

  const setPlayerHP = (hp: number, maxHp: number) => {
    sendMessage({ t: "set-hp", hp, maxHp });
  };

  /**
   * Map actions
   */
  const {
    setMapBackground: setMapBackgroundURL,
    setGridSize,
    setGridSquareSize,
  } = useMapActions({ sendMessage });

  const gridSize = snapshot?.gridSize || 50;
  const gridSquareSize = snapshot?.gridSquareSize ?? 5;

  // E2E testing support (dev-only)
  useE2ETestingSupport({
    snapshot,
    uid,
    gridSize,
  });

  const mapSceneObject = useMemo(
    () => snapshot?.sceneObjects?.find((obj) => obj.type === "map") ?? null,
    [snapshot?.sceneObjects],
  );

  const stagingZoneSceneObject = useMemo(
    () => snapshot?.sceneObjects?.find((obj) => obj.type === "staging-zone") ?? null,
    [snapshot?.sceneObjects],
  );

  const handleAlignmentStart = useCallback(() => {
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
    setActiveTool("align");
  }, []);

  const handleAlignmentCancel = useCallback(() => {
    setActiveTool(null);
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
  }, []);

  const handleAlignmentPointCapture = useCallback((point: AlignmentPoint) => {
    setAlignmentError(null);
    setAlignmentPoints((prev) => {
      if (prev.length >= 2) {
        return [point];
      }
      return [...prev, point];
    });
  }, []);

  const handleAlignmentReset = useCallback(() => {
    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
  }, []);

  const handleAlignmentApply = useCallback(() => {
    if (!alignmentSuggestion || !mapSceneObject) {
      return;
    }

    transformSceneObject({
      id: mapSceneObject.id,
      position: {
        x: alignmentSuggestion.transform.x,
        y: alignmentSuggestion.transform.y,
      },
      scale: {
        x: alignmentSuggestion.transform.scaleX,
        y: alignmentSuggestion.transform.scaleY,
      },
      rotation: alignmentSuggestion.transform.rotation,
    });

    setAlignmentPoints([]);
    setAlignmentSuggestion(null);
    setAlignmentError(null);
    setActiveTool(null);
  }, [alignmentSuggestion, mapSceneObject, transformSceneObject]);

  const handleClearDrawings = useCallback(() => {
    clearHistory();
    sendMessage({ t: "clear-drawings" });
  }, [clearHistory, sendMessage]);

  const handleSetRoomPassword = useCallback(
    (nextSecret: string) => {
      setRoomPasswordPending(true);
      setRoomPasswordStatus(null);
      sendMessage({ t: "set-room-password", secret: nextSecret });
    },
    [sendMessage],
  );

  const dismissRoomPasswordStatus = useCallback(() => {
    setRoomPasswordStatus(null);
  }, []);

  const handleAddCharacter = useCallback(
    (name: string) => {
      sendMessage({ t: "add-player-character", name, maxHp: 100 });
    },
    [sendMessage],
  );

  const handleDeleteCharacter = useCallback(
    (characterId: string) => {
      // Find this character
      const character = snapshot?.characters?.find((c) => c.id === characterId);
      if (!character) return;

      // Count player's characters
      const myCharacters = snapshot?.characters?.filter((c) => c.ownedByPlayerUID === uid) || [];
      const isLastCharacter = myCharacters.length === 1;

      // Confirm deletion
      if (!confirm("Delete this character? This will remove the character and their token.")) {
        return;
      }

      // Send delete message
      sendMessage({ t: "delete-player-character", characterId });

      // If was last character, immediately prompt for replacement
      if (isLastCharacter) {
        setTimeout(() => {
          alert("You have no characters. Please create a new one.");
          const name = prompt("Enter character name:", "New Character");
          const finalName = name && name.trim() ? name.trim() : "New Character";
          sendMessage({ t: "add-player-character", name: finalName, maxHp: 100 });
        }, 100);
      }
    },
    [sendMessage, snapshot?.characters, uid],
  );

  const handleCharacterNameUpdate = useCallback(
    (characterId: string, name: string) => {
      sendMessage({ t: "update-character-name", characterId, name });
    },
    [sendMessage],
  );

  const handleApplyPlayerState = useCallback(
    (state: PlayerState, tokenId?: string) => {
      sendMessage({ t: "rename", name: state.name });
      sendMessage({ t: "set-hp", hp: state.hp, maxHp: state.maxHp });

      if (state.portrait !== undefined) {
        sendMessage({ t: "portrait", data: state.portrait ?? "" });
      }

      if (state.statusEffects !== undefined) {
        sendMessage({ t: "set-status-effects", effects: state.statusEffects });
      }

      if (tokenId) {
        const color =
          state.token?.color ?? (typeof state.color === "string" ? state.color : undefined);
        if (color && color.trim().length > 0) {
          sendMessage({ t: "set-token-color", tokenId, color: color.trim() });
        }

        const nextImage =
          state.token?.imageUrl !== undefined ? state.token.imageUrl : state.tokenImage;
        if (nextImage !== undefined) {
          sendMessage({
            t: "update-token-image",
            tokenId,
            imageUrl: nextImage ?? "",
          });
        }

        if (state.token?.size) {
          sendMessage({ t: "set-token-size", tokenId, size: state.token.size });
        }

        const transform: {
          position?: { x: number; y: number };
          scale?: { x: number; y: number };
          rotation?: number;
        } = {};

        if (state.token?.position) {
          transform.position = {
            x: state.token.position.x,
            y: state.token.position.y,
          };
        }

        if (state.token?.scale) {
          const scaleX = Math.max(0.1, Math.min(10, state.token.scale.x));
          const scaleY = Math.max(0.1, Math.min(10, state.token.scale.y));
          transform.scale = { x: scaleX, y: scaleY };
        }

        if (state.token?.rotation !== undefined) {
          transform.rotation = state.token.rotation;
        }

        if (transform.position || transform.scale || transform.rotation !== undefined) {
          sendMessage({
            t: "transform-object",
            id: `token:${tokenId}`,
            ...transform,
          });
        }
      }

      if (state.drawings !== undefined) {
        sendMessage({ t: "sync-player-drawings", drawings: state.drawings });
      }
    },
    [sendMessage],
  );

  const handleSetPlayerStagingZone = useCallback(
    (zone: PlayerStagingZone | undefined) => {
      sendMessage({ t: "set-player-staging-zone", zone });
    },
    [sendMessage],
  );

  const handleCreateNPC = useCallback(() => {
    sendMessage({ t: "create-npc", name: "New NPC", hp: 10, maxHp: 10 });
  }, [sendMessage]);

  const handleUpdateNPC = useCallback(
    (
      id: string,
      updates: Partial<{
        name: string;
        hp: number;
        maxHp: number;
        portrait?: string;
        tokenImage?: string;
      }>,
    ) => {
      const existing = snapshot?.characters?.find((character) => character.id === id);
      if (!existing) return;

      sendMessage({
        t: "update-npc",
        id,
        name: updates.name ?? existing.name,
        hp: updates.hp ?? existing.hp,
        maxHp: updates.maxHp ?? existing.maxHp,
        portrait: updates.portrait ?? existing.portrait,
        tokenImage: updates.tokenImage ?? existing.tokenImage ?? undefined,
      });
    },
    [sendMessage, snapshot?.characters],
  );

  const handleDeleteNPC = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-npc", id });
    },
    [sendMessage],
  );

  const handleDeletePlayerToken = useCallback(
    (tokenId: string) => {
      sendMessage({ t: "delete-token", id: tokenId });
    },
    [sendMessage],
  );

  const handlePlaceNPCToken = useCallback(
    (id: string) => {
      sendMessage({ t: "place-npc-token", id });
    },
    [sendMessage],
  );

  const handleCreateProp = useCallback(() => {
    sendMessage({
      t: "create-prop",
      label: "New Prop",
      imageUrl: "",
      owner: null,
      size: "medium",
      viewport: cameraState,
    });
  }, [sendMessage, cameraState]);

  const handleUpdateProp = useCallback(
    (
      id: string,
      updates: {
        label: string;
        imageUrl: string;
        owner: string | null;
        size: TokenSize;
      },
    ) => {
      sendMessage({
        t: "update-prop",
        id,
        ...updates,
      });
    },
    [sendMessage],
  );

  const handleDeleteProp = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-prop", id });
    },
    [sendMessage],
  );

  const handleSaveSession = useCallback(
    (name: string) => {
      if (!snapshot) {
        toast.warning("No session data available to save yet.");
        return;
      }
      try {
        toast.info("Preparing session file...");
        saveSession(snapshot, name);
        toast.success(`Session "${name}" saved successfully!`, 4000);
      } catch (err) {
        console.error("Failed to save session", err);
        toast.error(
          err instanceof Error
            ? `Save failed: ${err.message}`
            : "Failed to save session. Check console for details.",
          5000,
        );
      }
    },
    [snapshot, toast],
  );

  const handleLoadSession = useCallback(
    async (file: File) => {
      try {
        toast.info(`Loading session from ${file.name}...`);
        const loadedSnapshot = await loadSession(file);

        // Validate snapshot has expected data
        const warnings: string[] = [];
        if (!loadedSnapshot.sceneObjects || loadedSnapshot.sceneObjects.length === 0) {
          warnings.push("No scene objects found");
        }
        if (!loadedSnapshot.characters || loadedSnapshot.characters.length === 0) {
          warnings.push("No characters found");
        }

        sendMessage({ t: "load-session", snapshot: loadedSnapshot });

        if (warnings.length > 0) {
          toast.warning(`Session loaded with warnings: ${warnings.join(", ")}`, 5000);
        } else {
          toast.success(`Session "${file.name}" loaded successfully!`, 4000);
        }
      } catch (err) {
        console.error("Failed to load session", err);
        toast.error(
          err instanceof Error
            ? `Load failed: ${err.message}`
            : "Failed to load session. File may be corrupted.",
          5000,
        );
      }
    },
    [sendMessage, toast],
  );

  // DM role detection
  const { isDM, elevateToDM } = useDMRole({ snapshot, uid, send: sendMessage });

  // Handle DM elevation with password prompt
  const handleToggleDM = useCallback(
    (requestDM: boolean) => {
      if (!requestDM) {
        // Revoking DM mode
        const confirmed = window.confirm(
          "Are you sure you want to revoke your DM status? Another player will be able to become DM with the password.",
        );
        if (!confirmed) {
          return;
        }

        // Send revoke-dm message
        sendMessage({ t: "revoke-dm" });
        toast.success("DM status revoked. You are now a player.", 3000);
        return;
      }

      if (isDM) {
        // Already DM
        return;
      }

      // Prompt for DM password
      const dmPassword = window.prompt("Enter DM password to elevate:");
      if (!dmPassword) {
        return; // User cancelled
      }

      elevateToDM(dmPassword.trim());
    },
    [isDM, elevateToDM, sendMessage, toast],
  );

  useEffect(() => {
    if (activeTool !== "align") {
      setAlignmentPoints([]);
      setAlignmentSuggestion(null);
      setAlignmentError(null);
      return;
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== "align") {
      return;
    }

    if (alignmentPoints.length !== 2) {
      setAlignmentSuggestion(null);
      if (alignmentPoints.length === 0) {
        setAlignmentError(null);
      }
      return;
    }

    try {
      const result = computeMapAlignmentTransform(alignmentPoints, gridSize);
      setAlignmentSuggestion(result);
      const tolerance = Math.max(0.5, gridSize * 0.02);
      if (result.error > tolerance) {
        setAlignmentError(
          `Alignment residual ${result.error.toFixed(2)}px — consider recapturing points.`,
        );
      } else {
        setAlignmentError(null);
      }
    } catch (error) {
      setAlignmentSuggestion(null);
      setAlignmentError(error instanceof Error ? error.message : "Failed to compute alignment.");
    }
  }, [activeTool, alignmentPoints, gridSize]);

  // Keyboard shortcuts (after isDM is declared)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete or Backspace to delete selected object(s)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectIds.length > 0) {
        console.log("[KeyDown] Delete/Backspace pressed:", {
          key: e.key,
          selectedObjectIds,
          isDM,
          target: e.target,
        });

        e.preventDefault();

        // Filter to only objects the user can delete
        // Note: Locked objects CANNOT be deleted by anyone (including DM)
        const objectsToDelete = selectedObjectIds.filter((id) => {
          const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
          if (!obj) return false;

          // LOCK BLOCKS EVERYONE: Can't delete locked objects (even DM must unlock first)
          if (obj.locked) return false;

          // Can't delete the map
          if (id.startsWith("map:")) return false;

          // Can delete if DM (and not locked)
          if (isDM) return true;

          // Can delete if owner (or no owner set) and not locked
          // Owner is stored at the SceneObject level, not in data
          return !obj.owner || obj.owner === uid;
        });

        if (objectsToDelete.length === 0) {
          const hasLocked = selectedObjectIds.some((id) => {
            const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
            return obj?.locked;
          });

          if (hasLocked) {
            alert("Cannot delete locked objects. Unlock them first using the lock icon.");
          } else {
            alert("You can only delete objects you own.");
          }
          return;
        }

        // Show warning if some objects can't be deleted
        if (objectsToDelete.length < selectedObjectIds.length) {
          const skipped = selectedObjectIds.length - objectsToDelete.length;
          const lockedCount = selectedObjectIds.filter((id) => {
            const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
            return obj?.locked;
          }).length;

          const message =
            lockedCount > 0
              ? `Cannot delete ${skipped} locked object${skipped > 1 ? "s" : ""}. Delete the ${objectsToDelete.length} unlocked object${objectsToDelete.length > 1 ? "s" : ""}?`
              : `You can only delete ${objectsToDelete.length} of ${selectedObjectIds.length} selected objects (${skipped} owned by others). Continue?`;

          if (!confirm(message)) {
            return;
          }
        }

        // Separate objects by type
        const tokens = objectsToDelete
          .filter((id) => id.startsWith("token:"))
          .map((id) => id.split(":")[1]!)
          .filter(Boolean);
        const drawings = objectsToDelete
          .filter((id) => id.startsWith("drawing:"))
          .map((id) => id.split(":")[1]!)
          .filter(Boolean);

        if (tokens.length === 0 && drawings.length === 0) {
          return;
        }

        // Build confirmation message
        const parts: string[] = [];
        if (tokens.length > 0) {
          parts.push(`${tokens.length} token${tokens.length > 1 ? "s" : ""}`);
        }
        if (drawings.length > 0) {
          parts.push(`${drawings.length} drawing${drawings.length > 1 ? "s" : ""}`);
        }
        const message = `Delete ${parts.join(" and ")}? This cannot be undone.`;

        if (confirm(message)) {
          console.log("[Delete] Deleting selected objects:", { tokens, drawings });

          // Delete all tokens
          for (const id of tokens) {
            sendMessage({ t: "delete-token", id });
          }

          // Delete all drawings
          for (const id of drawings) {
            sendMessage({ t: "delete-drawing", id });
          }

          clearSelection();
        }
        return;
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        // Only undo if draw mode is active and there's something to undo
        if (drawMode && canUndo) {
          e.preventDefault();
          popFromHistory();
          sendMessage({ t: "undo-drawing" });
        }
      }

      // Ctrl+Y or Cmd+Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        if (drawMode && canRedo) {
          e.preventDefault();
          popFromRedoHistory();
          sendMessage({ t: "redo-drawing" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    drawMode,
    canUndo,
    canRedo,
    popFromHistory,
    popFromRedoHistory,
    sendMessage,
    selectedObjectId,
    isDM,
    snapshot,
  ]);

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <div onClick={() => setContextMenu(null)} style={{ height: "100vh", overflow: "hidden" }}>
      {/* Server Status Banner */}
      <ServerStatus isConnected={isConnected} />

      {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
      {drawMode && (
        <DrawingToolbar
          drawTool={drawTool}
          drawColor={drawColor}
          drawWidth={drawWidth}
          drawOpacity={drawOpacity}
          drawFilled={drawFilled}
          canUndo={canUndo}
          canRedo={canRedo}
          onToolChange={setDrawTool}
          onColorChange={setDrawColor}
          onWidthChange={setDrawWidth}
          onOpacityChange={setDrawOpacity}
          onFilledChange={setDrawFilled}
          onUndo={() => {
            popFromHistory();
            sendMessage({ t: "undo-drawing" });
          }}
          onRedo={() => {
            popFromRedoHistory();
            sendMessage({ t: "redo-drawing" });
          }}
          onClearAll={handleClearDrawings}
          onClose={() => setActiveTool(null)}
        />
      )}

      {/* Header - Fixed at top */}
      <Header
        uid={uid}
        snapToGrid={snapToGrid}
        activeTool={activeTool}
        crtFilter={crtFilter}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        onSnapToGridChange={setSnapToGrid}
        onToolSelect={setActiveTool}
        onCrtFilterChange={setCrtFilter}
        onDiceRollerToggle={setDiceRollerOpen}
        onRollLogToggle={setRollLogOpen}
        topPanelRef={topPanelRef}
        onFocusSelf={handleFocusSelf}
        onResetCamera={handleResetCamera}
      />

      {/* Multi-select toolbar - shows when multiple objects are selected and user is DM */}
      <MultiSelectToolbar
        selectedObjectIds={selectedObjectIds}
        isDM={isDM}
        topHeight={topHeight}
        onLock={lockSelected}
        onUnlock={unlockSelected}
      />

      {/* Main Whiteboard Panel - fills space between fixed top and bottom */}
      <div
        style={{
          position: "fixed",
          top: `${topHeight}px`,
          bottom: `${bottomHeight}px`,
          left: 0,
          right: 0,
          overflow: "hidden",
        }}
      >
        <MapBoard
          snapshot={snapshot}
          sendMessage={sendMessage}
          uid={uid}
          gridSize={gridSize}
          snapToGrid={snapToGrid}
          pointerMode={pointerMode}
          measureMode={measureMode}
          drawMode={drawMode}
          transformMode={transformMode}
          selectMode={selectMode}
          isDM={isDM}
          alignmentMode={alignmentMode}
          alignmentPoints={alignmentPoints}
          alignmentSuggestion={alignmentSuggestion}
          onAlignmentPointCapture={handleAlignmentPointCapture}
          drawTool={drawTool}
          drawColor={drawColor}
          drawWidth={drawWidth}
          drawOpacity={drawOpacity}
          drawFilled={drawFilled}
          onRecolorToken={recolorToken}
          onTransformObject={transformSceneObject}
          onDrawingComplete={addToHistory}
          cameraCommand={cameraCommand}
          onCameraCommandHandled={handleCameraCommandHandled}
          onCameraChange={setCameraState}
          selectedObjectId={selectedObjectId}
          selectedObjectIds={selectedObjectIds}
          onSelectObject={handleObjectSelection}
          onSelectObjects={handleObjectSelectionBatch}
        />
      </div>

      {/* Entities HUD - Fixed at bottom */}
      <EntitiesPanel
        players={snapshot?.players || []}
        characters={snapshot?.characters || []}
        tokens={snapshot?.tokens || []}
        sceneObjects={snapshot?.sceneObjects || []}
        drawings={snapshot?.drawings || []}
        uid={uid}
        micEnabled={micEnabled}
        editingPlayerUID={editingPlayerUID}
        nameInput={nameInput}
        editingMaxHpUID={editingMaxHpUID}
        maxHpInput={maxHpInput}
        onNameInputChange={updateNameInput}
        onNameEdit={startNameEdit}
        onNameSubmit={() => submitNameEdit(renamePlayer)}
        onPortraitLoad={() => {
          const url = prompt("Enter image URL:");
          if (url && url.trim()) {
            setPortraitURL(url.trim());
          }
        }}
        onToggleMic={toggleMic}
        onHpChange={(hp, maxHp) => setPlayerHP(hp, maxHp)}
        onMaxHpInputChange={updateMaxHpInput}
        onMaxHpEdit={startMaxHpEdit}
        onMaxHpSubmit={() =>
          submitMaxHpEdit((maxHp) =>
            setPlayerHP(snapshot?.players?.find((p) => p.uid === uid)?.hp ?? 100, maxHp),
          )
        }
        currentIsDM={isDM}
        onToggleDMMode={handleToggleDM}
        onTokenImageChange={updateTokenImage}
        onApplyPlayerState={handleApplyPlayerState}
        onStatusEffectsChange={handleSetStatusEffects}
        onNpcUpdate={handleUpdateNPC}
        onNpcDelete={handleDeleteNPC}
        onNpcPlaceToken={handlePlaceNPCToken}
        onPlayerTokenDelete={handleDeletePlayerToken}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        onAddCharacter={handleAddCharacter}
        onDeleteCharacter={handleDeleteCharacter}
        onCharacterNameUpdate={handleCharacterNameUpdate}
        bottomPanelRef={bottomPanelRef}
      />

      <DMMenu
        isDM={isDM}
        onToggleDM={handleToggleDM}
        gridSize={gridSize}
        gridSquareSize={gridSquareSize}
        gridLocked={gridLocked}
        onGridLockToggle={() => setGridLocked((prev) => !prev)}
        onGridSizeChange={setGridSize}
        onGridSquareSizeChange={setGridSquareSize}
        onClearDrawings={handleClearDrawings}
        onSetMapBackground={setMapBackgroundURL}
        mapBackground={snapshot?.mapBackground}
        playerStagingZone={snapshot?.playerStagingZone}
        onSetPlayerStagingZone={handleSetPlayerStagingZone}
        camera={camera}
        playerCount={snapshot?.players?.length ?? 0}
        characters={snapshot?.characters || []}
        onRequestSaveSession={snapshot ? handleSaveSession : undefined}
        onRequestLoadSession={handleLoadSession}
        onCreateNPC={handleCreateNPC}
        onUpdateNPC={handleUpdateNPC}
        onDeleteNPC={handleDeleteNPC}
        onPlaceNPCToken={handlePlaceNPCToken}
        props={snapshot?.props || []}
        players={snapshot?.players || []}
        onCreateProp={handleCreateProp}
        onUpdateProp={handleUpdateProp}
        onDeleteProp={handleDeleteProp}
        mapLocked={mapSceneObject?.locked ?? true}
        onMapLockToggle={() => {
          if (mapSceneObject) {
            toggleSceneObjectLock(mapSceneObject.id, !mapSceneObject.locked);
          }
        }}
        stagingZoneLocked={stagingZoneSceneObject?.locked ?? false}
        onStagingZoneLockToggle={() => {
          if (stagingZoneSceneObject) {
            toggleSceneObjectLock(stagingZoneSceneObject.id, !stagingZoneSceneObject.locked);
          }
        }}
        mapTransform={
          mapSceneObject?.transform ?? {
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          }
        }
        onMapTransformChange={(transform) => {
          if (mapSceneObject) {
            transformSceneObject({
              id: mapSceneObject.id,
              position: { x: transform.x, y: transform.y },
              scale: { x: transform.scaleX, y: transform.scaleY },
              rotation: transform.rotation,
            });
          }
        }}
        alignmentModeActive={alignmentMode}
        alignmentPoints={alignmentPoints}
        alignmentSuggestion={alignmentSuggestion}
        alignmentError={alignmentError}
        onAlignmentStart={handleAlignmentStart}
        onAlignmentReset={handleAlignmentReset}
        onAlignmentCancel={handleAlignmentCancel}
        onAlignmentApply={handleAlignmentApply}
        onSetRoomPassword={handleSetRoomPassword}
        roomPasswordStatus={roomPasswordStatus}
        roomPasswordPending={roomPasswordPending}
        onDismissRoomPasswordStatus={dismissRoomPasswordStatus}
      />

      {/* Context Menu */}
      <ContextMenu menu={contextMenu} onDelete={deleteToken} onClose={() => setContextMenu(null)} />

      {/* Visual Effects (CRT Filter + Ambient Sparkles) */}
      <VisualEffects crtFilter={crtFilter} />

      {/* Dice Roller Panel */}
      {diceRollerOpen && (
        <DiceRoller
          onRoll={(result: RollResult) => {
            const me = snapshot?.players?.find((p: Player) => p.uid === uid);
            const playerName = me?.name || "Unknown";

            // Build formula string
            const formula = result.tokens
              .map((t) => {
                if (t.kind === "die") {
                  return t.qty > 1 ? `${t.qty}${t.die}` : t.die;
                } else {
                  return t.value >= 0 ? `+${t.value}` : `${t.value}`;
                }
              })
              .join(" ");

            // Broadcast to server
            sendMessage({
              t: "dice-roll",
              roll: {
                id: result.id,
                playerUid: uid,
                playerName,
                formula,
                total: result.total,
                breakdown: result.perDie,
                timestamp: result.timestamp,
              },
            });
          }}
          onClose={() => setDiceRollerOpen(false)}
        />
      )}

      {/* Roll Log Panel */}
      {rollLogOpen && (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 200,
            width: 350,
            height: 500,
            zIndex: 1000,
          }}
        >
          <RollLog
            rolls={rollHistory}
            onClearLog={() => sendMessage({ t: "clear-roll-history" })}
            onViewRoll={(roll) => setViewingRoll(roll)}
            onClose={() => setRollLogOpen(false)}
          />
        </div>
      )}

      {/* Viewing roll from log */}
      {viewingRoll && (
        <div style={{ position: "fixed", zIndex: 2000 }}>
          <DiceRoller onRoll={() => {}} onClose={() => setViewingRoll(null)} />
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer messages={toast.messages} onDismiss={toast.dismiss} />
    </div>
  );
}
