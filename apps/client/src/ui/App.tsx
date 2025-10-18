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
import MapBoard, { type CameraCommand } from "./MapBoard";
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
} from "@shared";
import { WS_URL } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMicrophone } from "../hooks/useMicrophone";
import { useDrawingState } from "../hooks/useDrawingState";
import { usePlayerEditing } from "../hooks/usePlayerEditing";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useDMRole } from "../hooks/useDMRole";
import { useObjectSelection } from "../hooks/useObjectSelection";
import { DMMenu } from "../features/dm";
import { getSessionUID } from "../utils/session";
import { saveSession, loadSession } from "../utils/sessionPersistence";
import { DrawingToolbar } from "../features/drawing/components";
import { Header, type ToolMode } from "../components/layout/Header";
import { EntitiesPanel } from "../components/layout/EntitiesPanel";
import { ServerStatus } from "../components/layout/ServerStatus";
import { ConnectionState, AuthState } from "../services/websocket";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import { computeMapAlignmentTransform } from "../utils/mapAlignment";

interface RollLogEntry extends RollResult {
  playerName: string;
}

const ROOM_SECRET_STORAGE_KEY = "herobyte-room-secret";

function getInitialRoomSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(ROOM_SECRET_STORAGE_KEY) ?? "";
  } catch (error) {
    console.warn("[Auth] Unable to access sessionStorage:", error);
    return "";
  }
}

const authGateContainerStyle: React.CSSProperties = {
  alignItems: "center",
  background: "radial-gradient(circle at top, #101020 0%, #050509 100%)",
  display: "flex",
  height: "100vh",
  justifyContent: "center",
  padding: "24px",
};

const authGateCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(17, 24, 39, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "12px",
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.5)",
  color: "#f8fafc",
  maxWidth: "400px",
  padding: "32px",
  width: "100%",
};

const authGateErrorStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: "0.95rem",
  margin: "0",
};

const authGateHintStyle: React.CSSProperties = {
  color: "#cbd5f5",
  fontSize: "0.85rem",
  marginTop: "16px",
};

const authInputStyle: React.CSSProperties = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.5)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontFamily: "inherit",
  fontSize: "1rem",
  padding: "12px",
  width: "100%",
};

const authPrimaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #38bdf8, #6366f1)",
  border: "none",
  borderRadius: "8px",
  color: "#0f172a",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "1rem",
  fontWeight: 600,
  padding: "12px",
  transition: "filter 0.2s ease",
};

const authSecondaryButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(148, 163, 184, 0.4)",
  borderRadius: "8px",
  color: "#cbd5f5",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "0.9rem",
  marginTop: "12px",
  padding: "10px 12px",
  transition: "border-color 0.2s ease, color 0.2s ease",
  width: "100%",
};

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

  const initialSecret = useMemo(() => getInitialRoomSecret(), []);
  const [authSecret, setAuthSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState(initialSecret || "");
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  useEffect(() => {
    if (!authSecret) return;
    if (authState !== AuthState.UNAUTHENTICATED) return;
    if (!isConnected) return;

    authenticate(authSecret);
  }, [authSecret, authState, authenticate, isConnected]);

  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED && authSecret) {
      try {
        sessionStorage.setItem(ROOM_SECRET_STORAGE_KEY, authSecret);
      } catch (error) {
        console.warn("[Auth] Unable to persist room secret:", error);
      }
    }
  }, [authState, authSecret]);

  useEffect(() => {
    if (authState === AuthState.FAILED && authSecret) {
      try {
        sessionStorage.removeItem(ROOM_SECRET_STORAGE_KEY);
      } catch (error) {
        console.warn("[Auth] Unable to clear stored secret:", error);
      }
      setAuthSecret("");
      setPasswordInput("");
    }
  }, [authState, authSecret]);

  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED) {
      setHasAuthenticated(true);
    } else if (authState === AuthState.FAILED) {
      setHasAuthenticated(false);
    }
  }, [authState]);

  const handlePasswordSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = passwordInput.trim();
      if (!trimmed) {
        return;
      }

      setAuthSecret(trimmed);

      if (!isConnected) {
        connect();
        return;
      }

      authenticate(trimmed);
    },
    [authenticate, connect, isConnected, passwordInput],
  );

  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordInput(event.target.value);
  }, []);

  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "Connected";
      case ConnectionState.CONNECTING:
        return "Connecting";
      case ConnectionState.RECONNECTING:
        return "Reconnecting";
      case ConnectionState.FAILED:
        return "Failed";
      case ConnectionState.DISCONNECTED:
      default:
        return "Disconnected";
    }
  }, [connectionState]);

  const canSubmit =
    passwordInput.trim().length > 0 &&
    authState !== AuthState.PENDING &&
    connectionState === ConnectionState.CONNECTED;

  const showAuthGate = !hasAuthenticated || authState === AuthState.FAILED;

  if (showAuthGate) {
    return (
      <AuthGate
        password={passwordInput}
        authState={authState}
        authError={authError}
        connectionLabel={connectionLabel}
        canSubmit={canSubmit}
        isConnected={isConnected}
        connectionState={connectionState}
        onPasswordChange={handlePasswordChange}
        onSubmit={handlePasswordSubmit}
        onRetry={connect}
      />
    );
  }

  return (
    <AuthenticatedApp
      uid={uid}
      snapshot={snapshot}
      sendMessage={sendMessage}
      registerRtcHandler={registerRtcHandler}
      registerServerEventHandler={registerServerEventHandler}
      isConnected={isConnected}
      authState={authState}
      hasAuthenticated={hasAuthenticated}
    />
  );
};

interface AuthGateProps {
  password: string;
  authState: AuthState;
  authError: string | null;
  connectionLabel: string;
  canSubmit: boolean;
  isConnected: boolean;
  connectionState: ConnectionState;
  onPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}

function AuthGate({
  password,
  authState,
  authError,
  connectionLabel,
  canSubmit,
  isConnected,
  connectionState,
  onPasswordChange,
  onSubmit,
  onRetry,
}: AuthGateProps): JSX.Element {
  const isConnecting =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING;
  const isHandshakeActive = isConnecting || authState === AuthState.PENDING;
  const submitLabel =
    authState === AuthState.PENDING
      ? "Authenticating..."
      : isConnecting
        ? "Connecting..."
        : "Enter Room";
  const primaryDisabled = !canSubmit || isHandshakeActive;
  return (
    <div style={authGateContainerStyle}>
      <div style={authGateCardStyle}>
        <h1 style={{ margin: "0 0 16px" }}>Join Your Room</h1>
        <p style={{ margin: "0 0 24px", color: "#cbd5f5", fontSize: "0.95rem" }}>
          Enter the room password provided by your host to sync with your party.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder="Room password"
            style={authInputStyle}
            autoFocus
            spellCheck={false}
            disabled={isHandshakeActive}
          />
          {authError ? <p style={authGateErrorStyle}>{authError}</p> : null}
          <button
            type="submit"
            style={{
              ...authPrimaryButtonStyle,
              opacity: primaryDisabled ? 0.6 : 1,
              cursor: primaryDisabled ? "not-allowed" : "pointer",
            }}
            disabled={primaryDisabled}
            aria-busy={isHandshakeActive}
          >
            {submitLabel}
          </button>
        </form>
        <p style={authGateHintStyle}>
          Connection status:{" "}
          <strong
            style={{
              animation: isConnecting ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
            aria-live="polite"
            aria-busy={isConnecting}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {isConnecting ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "var(--jrpg-gold)",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : null}
              <span>{connectionLabel}</span>
            </span>
          </strong>
        </p>
        {!isConnected ? (
          <button
            type="button"
            style={{
              ...authSecondaryButtonStyle,
              opacity: isConnecting ? 0.6 : 1,
              cursor: isConnecting ? "not-allowed" : "pointer",
            }}
            onClick={onRetry}
            disabled={isConnecting}
          >
            Retry Connection
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface AuthenticatedAppProps {
  uid: string;
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;
  isConnected: boolean;
  authState: AuthState;
  hasAuthenticated: boolean;
}

type RoomPasswordStatus = { type: "success" | "error"; message: string };

function AuthenticatedApp({
  uid,
  snapshot,
  sendMessage,
  registerRtcHandler,
  registerServerEventHandler,
  isConnected,
  authState,
  hasAuthenticated,
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

  // Map controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridLocked, setGridLocked] = useState(false);

  // Tool modes
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";
  const alignmentMode = activeTool === "align";
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
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

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

  // Clear selection when transform mode is disabled
  useEffect(() => {
    if (!transformMode) {
      clearSelection();
    }
  }, [transformMode, clearSelection]);

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
      }
    });
  }, [registerServerEventHandler]);

  const handleObjectSelection = useCallback(
    (
      objectId: string | null,
      options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
    ) => {
      if (!objectId) {
        clearSelection();
        return;
      }

      const mode = options?.mode ?? "replace";
      switch (mode) {
        case "append": {
          selectMultiple([objectId], "append");
          return;
        }
        case "toggle": {
          if (selectedObjectIds.includes(objectId)) {
            selectMultiple([objectId], "subtract");
          } else if (selectedObjectIds.length > 0) {
            selectMultiple([objectId], "append");
          } else {
            selectObject(objectId);
          }
          return;
        }
        case "subtract": {
          selectMultiple([objectId], "subtract");
          return;
        }
        case "replace":
        default: {
          selectObject(objectId);
        }
      }
    },
    [clearSelection, selectMultiple, selectObject, selectedObjectIds],
  );

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Token actions
   */
  const recolorToken = (sceneId: string) => {
    const tokenId = sceneId.replace(/^token:/, "");
    sendMessage({ t: "recolor", id: tokenId });
  };

  const transformSceneObject = useCallback(
    ({
      id,
      position,
      scale,
      rotation,
      locked,
    }: {
      id: string;
      position?: { x: number; y: number };
      scale?: { x: number; y: number };
      rotation?: number;
      locked?: boolean;
    }) => {
      sendMessage({
        t: "transform-object",
        id,
        position,
        scale,
        rotation,
        locked,
      });
    },
    [sendMessage],
  );

  const toggleSceneObjectLock = useCallback(
    (sceneObjectId: string, locked: boolean) => {
      sendMessage({
        t: "transform-object",
        id: sceneObjectId,
        locked,
      });
    },
    [sendMessage],
  );

  const deleteToken = (id: string) => {
    sendMessage({ t: "delete-token", id });
  };

  /**
   * Player actions
   */
  const renamePlayer = (name: string) => {
    sendMessage({ t: "rename", name });
  };

  const setPortraitURL = (url: string) => {
    sendMessage({ t: "portrait", data: url });
  };

  const setPlayerHP = (hp: number, maxHp: number) => {
    sendMessage({ t: "set-hp", hp, maxHp });
  };

  /**
   * Map actions
   */
  const setMapBackgroundURL = (url: string) => {
    sendMessage({ t: "map-background", data: url });
  };

  const setGridSize = (size: number) => {
    sendMessage({ t: "grid-size", size });
  };

  const setGridSquareSize = (size: number) => {
    sendMessage({ t: "grid-square-size", size });
  };

  const gridSize = snapshot?.gridSize || 50;
  const gridSquareSize = snapshot?.gridSquareSize ?? 5;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (import.meta.env.MODE === "production") {
      return;
    }

    const globalWindow = window as typeof window & {
      __HERO_BYTE_E2E__?: {
        snapshot?: RoomSnapshot | null;
        uid?: string;
        gridSize?: number;
        cam?: { x: number; y: number; scale: number };
        viewport?: { width: number; height: number };
      };
    };

    const previous = globalWindow.__HERO_BYTE_E2E__ ?? {};
    globalWindow.__HERO_BYTE_E2E__ = {
      ...previous,
      snapshot,
      uid,
      gridSize,
    };
  }, [gridSize, snapshot, uid]);

  const mapSceneObject = useMemo(
    () => snapshot?.sceneObjects?.find((obj) => obj.type === "map") ?? null,
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

  const updateTokenImage = useCallback(
    (tokenId: string, imageUrl: string) => {
      sendMessage({ t: "update-token-image", tokenId, imageUrl });
    },
    [sendMessage],
  );

  const updateTokenSize = useCallback(
    (tokenId: string, size: import("@shared").TokenSize) => {
      sendMessage({ t: "set-token-size", tokenId, size });
    },
    [sendMessage],
  );

  const handleFocusSelf = useCallback(() => {
    const myToken = snapshot?.tokens?.find((t) => t.owner === uid);
    if (!myToken) {
      window.alert("You don't have a token on the map yet.");
      return;
    }
    setCameraCommand({ type: "focus-token", tokenId: myToken.id });
  }, [snapshot?.tokens, uid]);

  const handleResetCamera = useCallback(() => {
    setCameraCommand({ type: "reset" });
  }, []);

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
        const color = state.token?.color ?? (typeof state.color === "string" ? state.color : undefined);
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

  const handleSetStatusEffects = useCallback(
    (effects: string[]) => {
      sendMessage({ t: "set-status-effects", effects });
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

  const handleSaveSession = useCallback(
    (name: string) => {
      if (!snapshot) {
        window.alert("No session data available to save yet.");
        return;
      }
      try {
        saveSession(snapshot, name);
        window.alert("Session saved to your downloads.");
      } catch (err) {
        console.error("Failed to save session", err);
        window.alert("Failed to save session. See console for details.");
      }
    },
    [snapshot],
  );

  const handleLoadSession = useCallback(
    async (file: File) => {
      try {
        const loadedSnapshot = await loadSession(file);
        sendMessage({ t: "load-session", snapshot: loadedSnapshot });
        window.alert(`Loaded session from ${file.name}`);
      } catch (err) {
        console.error("Failed to load session", err);
        window.alert(
          err instanceof Error
            ? `Failed to load session: ${err.message}`
            : "Failed to load session.",
        );
      }
    },
    [sendMessage],
  );

  // DM role detection
  const { isDM, toggleDM } = useDMRole({ snapshot, uid, send: sendMessage });

  useEffect(() => {
    if (!activeTool) {
      return;
    }

    const handleToolEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTool(null);
      }
    };

    window.addEventListener("keydown", handleToolEscape);
    return () => window.removeEventListener("keydown", handleToolEscape);
  }, [activeTool]);

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
      // Delete or Backspace to delete selected object (DM only)
      if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectId && isDM) {
        e.preventDefault();

        // Find the scene object to check if it's locked
        const obj = snapshot?.sceneObjects?.find((o) => o.id === selectedObjectId);
        if (obj?.locked) {
          alert("This object is locked. Unlock it first to delete.");
          return;
        }

        // Parse the scene object ID to determine type
        const [type, id] = selectedObjectId.split(":");

        if (type === "token" && id) {
          console.log("[Delete] Attempting to delete token:", { selectedObjectId, type, id });
          if (confirm("Delete this token? This cannot be undone.")) {
            console.log("[Delete] Sending delete-token message:", { t: "delete-token", id });
            sendMessage({ t: "delete-token", id }); // id is already without prefix
            clearSelection();
          }
        } else if (type === "map") {
          // Don't allow deleting the map
          alert("Cannot delete the map background. Use DM Menu to clear it.");
        } else if (type === "drawing" && id) {
          if (confirm("Delete this drawing? This cannot be undone.")) {
            sendMessage({ t: "delete-drawing", id }); // id is already without prefix
            clearSelection();
          }
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
      {hasAuthenticated && authState !== AuthState.AUTHENTICATED && (
        <div
          className="jrpg-text-small"
          style={{
            position: "fixed",
            top: "12px",
            right: "16px",
            padding: "6px 10px",
            background: "rgba(12, 19, 38, 0.9)",
            border: "1px solid var(--jrpg-border-gold)",
            borderRadius: "6px",
            color: "var(--jrpg-white)",
            zIndex: 2000,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {authState === AuthState.PENDING ? "Re-authenticating…" : "Reconnecting…"}
        </div>
      )}

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
      {isDM && selectedObjectIds.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: `${topHeight + 20}px`,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            display: "flex",
            gap: "8px",
            padding: "8px 16px",
            backgroundColor: "rgba(17, 24, 39, 0.95)",
            border: "1px solid rgba(148, 163, 184, 0.3)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div
            style={{
              color: "#cbd5e1",
              fontSize: "0.9rem",
              fontWeight: 500,
              marginRight: "12px",
              lineHeight: "32px",
            }}
          >
            {selectedObjectIds.length} selected
          </div>
          <button
            onClick={lockSelected}
            style={{
              padding: "6px 16px",
              backgroundColor: "#374151",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#4b5563";
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#374151";
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
            }}
          >
            🔒 Lock
          </button>
          <button
            onClick={unlockSelected}
            style={{
              padding: "6px 16px",
              backgroundColor: "#374151",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#4b5563";
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#374151";
              e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
            }}
          >
            🔓 Unlock
          </button>
        </div>
      )}

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
          onCameraCommandHandled={() => setCameraCommand(null)}
          selectedObjectId={selectedObjectId}
          selectedObjectIds={selectedObjectIds}
          onSelectObject={handleObjectSelection}
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
        onToggleDMMode={toggleDM}
        onTokenImageChange={updateTokenImage}
        onApplyPlayerState={handleApplyPlayerState}
        onStatusEffectsChange={handleSetStatusEffects}
        onNpcUpdate={handleUpdateNPC}
        onNpcDelete={handleDeleteNPC}
        onNpcPlaceToken={handlePlaceNPCToken}
        onPlayerTokenDelete={handleDeletePlayerToken}
        onToggleTokenLock={toggleSceneObjectLock}
        onTokenSizeChange={updateTokenSize}
        bottomPanelRef={bottomPanelRef}
      />

      <DMMenu
        isDM={isDM}
        onToggleDM={toggleDM}
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
        playerCount={snapshot?.players?.length ?? 0}
        characters={snapshot?.characters || []}
        onRequestSaveSession={snapshot ? handleSaveSession : undefined}
        onRequestLoadSession={handleLoadSession}
        onCreateNPC={handleCreateNPC}
        onUpdateNPC={handleUpdateNPC}
        onDeleteNPC={handleDeleteNPC}
        onPlaceNPCToken={handlePlaceNPCToken}
        mapLocked={mapSceneObject?.locked ?? true}
        onMapLockToggle={() => {
          if (mapSceneObject) {
            toggleSceneObjectLock(mapSceneObject.id, !mapSceneObject.locked);
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
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            background: "#222",
            border: "2px solid #555",
            padding: "4px",
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn btn-danger"
            style={{
              display: "block",
              width: "100%",
            }}
            onClick={() => {
              deleteToken(contextMenu.tokenId);
              setContextMenu(null);
            }}
          >
            Delete Token
          </button>
        </div>
      )}

      {/* CRT Scanline Filter with Arcade Bezel */}
      {crtFilter && (
        <>
          <div className="crt-vignette" />
          <div className="crt-filter" />
          <div className="crt-bezel" />
        </>
      )}

      {/* Ambient Pixel Sparkles */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div key={i} className="pixel-sparkle" />
        ))}
      </div>

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
    </div>
  );
}
