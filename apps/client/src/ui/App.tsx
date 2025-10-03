// ============================================================================
// VTT CLIENT APP
// ============================================================================
// Main application component for the Virtual Tabletop client.
// Manages:
// - Network connection and room state
// - Player management and voice chat
// - UI layout (fixed top/bottom bars, center map canvas)
// - Tool modes (pointer, measure, draw)

import React, { useEffect, useState, useRef } from "react";
import { RoomSnapshot, Token, Player, Pointer, Drawing } from "@shared";
import MapBoard from "./MapBoard";
import { useVoiceChat } from "./useVoiceChat";
import { DiceRoller } from "../components/dice/DiceRoller";
import { RollLog } from "../components/dice/RollLog";
import type { RollResult } from "../components/dice/types";
import { WS_URL } from "../config";
import { useWebSocket } from "../hooks/useWebSocket";
import { useMicrophone } from "../hooks/useMicrophone";
import { useDrawingState } from "../hooks/useDrawingState";
import { usePlayerEditing } from "../hooks/usePlayerEditing";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { getSessionUID } from "../utils/session";
import { DrawingToolbar } from "../features/drawing/components";
import { Header } from "../components/layout/Header";
import { PartyPanel } from "../components/layout/PartyPanel";
import { ServerStatus } from "../components/layout/ServerStatus";

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
  const uid = getSessionUID();                                          // This player's unique ID
  const { snapshot, send: sendMessage, isConnected, registerRtcHandler } = useWebSocket({
    url: WS_URL,
    uid,
  });

  // Custom hooks for state management
  const { micEnabled, micLevel, micStream, toggleMic } = useMicrophone({ sendMessage });
  const {
    drawTool, drawColor, drawWidth, drawOpacity, drawFilled,
    drawingHistory, canUndo,
    setDrawTool, setDrawColor, setDrawWidth, setDrawOpacity, setDrawFilled,
    addToHistory, popFromHistory, clearHistory
  } = useDrawingState();

  // Heartbeat to prevent timeout
  useHeartbeat({ sendMessage });
  const {
    editingPlayerUID, nameInput, editingMaxHpUID, maxHpInput,
    startNameEdit, updateNameInput, submitNameEdit,
    startMaxHpEdit, updateMaxHpInput, submitMaxHpEdit
  } = usePlayerEditing();

  // Map controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridLocked, setGridLocked] = useState(false);

  // Tool modes
  const [pointerMode, setPointerMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);

  // UI layout (fixed panels)
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const [topHeight, setTopHeight] = useState(180);
  const [bottomHeight, setBottomHeight] = useState(210);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(null);

  // CRT filter toggle
  const [crtFilter, setCrtFilter] = useState(false);

  // Dice roller toggle and state
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [rollLogOpen, setRollLogOpen] = useState(false);
  const [viewingRoll, setViewingRoll] = useState<RollResult | null>(null);

  // Get roll history from server snapshot
  const rollHistory: RollLogEntry[] = React.useMemo(() => {
    return (snapshot?.diceRolls || []).map((roll) => ({
      id: roll.id,
      playerName: roll.playerName,
      tokens: [], // Not needed for display
      perDie: roll.breakdown.map(b => ({
        ...b,
        die: b.die as any, // Type compatibility between DiceRoll and RollResult
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
    return snapshot?.players
      ?.filter((p: Player) => p.uid !== uid)
      .map((p: Player) => p.uid) || [];
  }, [snapshot?.players, uid]);

  const { connectedPeers } = useVoiceChat({
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
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only undo if draw mode is active and there's something to undo
        if (drawMode && canUndo) {
          e.preventDefault();
          popFromHistory();
          sendMessage({ t: "undo-drawing" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawMode, canUndo, popFromHistory, sendMessage]);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Token actions
   */
  const moveToken = (id: string, x: number, y: number) => {
    sendMessage({ t: "move", id, x, y });
  };

  const recolorToken = (id: string) => {
    sendMessage({ t: "recolor", id });
  };

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

  // Get synchronized grid size from server
  const gridSize = snapshot?.gridSize || 50;

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
          onToolChange={setDrawTool}
          onColorChange={setDrawColor}
          onWidthChange={setDrawWidth}
          onOpacityChange={setDrawOpacity}
          onFilledChange={setDrawFilled}
          onUndo={() => {
            popFromHistory();
            sendMessage({ t: "undo-drawing" });
          }}
          onClearAll={() => {
            clearHistory();
            sendMessage({ t: "clear-drawings" });
          }}
        />
      )}

      {/* Header - Fixed at top */}
      <Header
        uid={uid}
        gridSize={gridSize}
        gridLocked={gridLocked}
        snapToGrid={snapToGrid}
        pointerMode={pointerMode}
        measureMode={measureMode}
        drawMode={drawMode}
        crtFilter={crtFilter}
        diceRollerOpen={diceRollerOpen}
        rollLogOpen={rollLogOpen}
        onGridLockToggle={() => setGridLocked(!gridLocked)}
        onGridSizeChange={setGridSize}
        onSnapToGridChange={setSnapToGrid}
        onPointerModeChange={setPointerMode}
        onMeasureModeChange={setMeasureMode}
        onDrawModeChange={setDrawMode}
        onCrtFilterChange={setCrtFilter}
        onDiceRollerToggle={setDiceRollerOpen}
        onRollLogToggle={setRollLogOpen}
        onLoadMap={() => {
          const url = prompt("Enter map image URL:");
          if (url && url.trim()) {
            setMapBackgroundURL(url.trim());
          }
        }}
        topPanelRef={topPanelRef}
      />

      {/* Main Whiteboard Panel - fills space between fixed top and bottom */}
      <div
        style={{
          position: "fixed",
          top: `${topHeight}px`,
          bottom: `${bottomHeight}px`,
          left: 0,
          right: 0,
          overflow: "hidden"
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
          drawTool={drawTool}
          drawColor={drawColor}
          drawWidth={drawWidth}
          drawOpacity={drawOpacity}
          drawFilled={drawFilled}
          onMoveToken={moveToken}
          onRecolorToken={recolorToken}
          onDeleteToken={deleteToken}
          onDrawingComplete={addToHistory}
        />
      </div>

      {/* Party HUD - Fixed at bottom */}
      <PartyPanel
        players={snapshot?.players || []}
        tokens={snapshot?.tokens || []}
        uid={uid}
        micEnabled={micEnabled}
        micLevel={micLevel}
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
        onMaxHpSubmit={() => submitMaxHpEdit((maxHp) => setPlayerHP(snapshot?.players?.find(p => p.uid === uid)?.hp ?? 100, maxHp))}
        bottomPanelRef={bottomPanelRef}
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
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
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
            const formula = result.tokens.map((t) => {
              if (t.kind === 'die') {
                return t.qty > 1 ? `${t.qty}${t.die}` : t.die;
              } else {
                return t.value >= 0 ? `+${t.value}` : `${t.value}`;
              }
            }).join(' ');

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
          />
        </div>
      )}

      {/* Viewing roll from log */}
      {viewingRoll && (
        <div style={{ position: "fixed", zIndex: 2000 }}>
          <DiceRoller
            onRoll={() => {}}
            onClose={() => setViewingRoll(null)}
          />
        </div>
      )}
    </div>
  );
};
