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
import { getSessionUID } from "../utils/session";
import { PlayerCard } from "../features/players/components";
import { DrawingToolbar } from "../features/drawing/components";

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
  const { drawTool, drawColor, drawWidth, drawOpacity, drawFilled, setDrawTool, setDrawColor, setDrawWidth, setDrawOpacity, setDrawFilled } = useDrawingState();
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
      {/* Drawing Toolbar - Fixed on left side when draw mode is active */}
      {drawMode && (
        <DrawingToolbar
          drawTool={drawTool}
          drawColor={drawColor}
          drawWidth={drawWidth}
          drawOpacity={drawOpacity}
          drawFilled={drawFilled}
          onToolChange={setDrawTool}
          onColorChange={setDrawColor}
          onWidthChange={setDrawWidth}
          onOpacityChange={setDrawOpacity}
          onFilledChange={setDrawFilled}
          onClearAll={() => sendMessage({ t: "clear-drawings" })}
        />
      )}

      {/* Header - Fixed at top */}
      <div
        ref={topPanelRef}
        className="panel"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          margin: 0,
          borderRadius: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <img
            src="/logo.webp"
            alt="HeroByte"
            style={{ height: "48px", imageRendering: "pixelated" }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
          <p style={{ margin: 0, fontSize: "0.7rem" }}>
            <strong>UID:</strong> {uid.substring(0, 8)}...
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                if (confirm("Create a new player? This will give you a new UID for testing multiplayer in the same browser.")) {
                  localStorage.removeItem("vtt-session-uid");
                  window.location.reload();
                }
              }}
              className="btn btn-success"
            >
              New Player
            </button>
            <button
              onClick={() => {
                if (confirm("Clear all old tokens/players? This will remove disconnected players but keep your own token.")) {
                  sendMessage({ t: "clear-all-tokens" });
                }
              }}
              className="btn btn-danger"
            >
              Clear Old
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label htmlFor="gridSize">Grid Size:</label>
            <button
              onClick={() => setGridLocked(!gridLocked)}
              style={{
                padding: "2px 8px",
                background: "transparent",
                border: "1px solid #555",
                cursor: "pointer",
                fontSize: "1rem",
                color: gridLocked ? "#f66" : "#6c6"
              }}
              title={gridLocked ? "Unlock grid size" : "Lock grid size"}
            >
              {gridLocked ? "🔒" : "🔓"}
            </button>
            <input
              id="gridSize"
              type="range"
              min="1"
              max="100"
              step="1"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              style={{
                width: "200px",
                opacity: gridLocked ? 0.4 : 1,
                cursor: gridLocked ? "not-allowed" : "pointer"
              }}
              disabled={gridLocked}
            />
            <span style={{ color: gridLocked ? "#888" : "#dbe1ff" }}>{gridSize}px</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="snapToGrid"
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
            />
            <label htmlFor="snapToGrid">Snap to Grid</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="pointerMode"
              type="checkbox"
              checked={pointerMode}
              onChange={(e) => setPointerMode(e.target.checked)}
            />
            <label htmlFor="pointerMode">Pointer Mode 👆</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="measureMode"
              type="checkbox"
              checked={measureMode}
              onChange={(e) => setMeasureMode(e.target.checked)}
            />
            <label htmlFor="measureMode">Measure Distance 📏</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="drawMode"
              type="checkbox"
              checked={drawMode}
              onChange={(e) => setDrawMode(e.target.checked)}
            />
            <label htmlFor="drawMode">Draw ✏️</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="crtFilter"
              type="checkbox"
              checked={crtFilter}
              onChange={(e) => setCrtFilter(e.target.checked)}
            />
            <label htmlFor="crtFilter">CRT Filter 📺</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="diceRoller"
              type="checkbox"
              checked={diceRollerOpen}
              onChange={(e) => setDiceRollerOpen(e.target.checked)}
            />
            <label htmlFor="diceRoller">Dice Roller ⚂</label>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              id="rollLog"
              type="checkbox"
              checked={rollLogOpen}
              onChange={(e) => setRollLogOpen(e.target.checked)}
            />
            <label htmlFor="rollLog">Roll Log 📜</label>
          </div>
          <div>
            <button
              onClick={() => {
                const url = prompt("Enter map image URL:");
                if (url && url.trim()) {
                  setMapBackgroundURL(url.trim());
                }
              }}
              className="btn btn-primary"
            >
              Load Map
            </button>
          </div>
        </div>
      </div>

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
        />
      </div>

      {/* Party HUD - Fixed at bottom */}
      <div
        ref={bottomPanelRef}
        className="panel"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          margin: 0,
          borderRadius: 0
        }}
      >
        <h3 style={{ margin: "0 0 8px 0" }}>Party</h3>
        <div
          style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {snapshot?.players?.map((p: Player) => {
            const isMe = p.uid === uid;
            const token = snapshot?.tokens?.find((t: Token) => t.owner === p.uid);

            return (
              <PlayerCard
                key={p.uid}
                player={p}
                isMe={isMe}
                tokenColor={token?.color}
                micEnabled={micEnabled}
                micLevel={micLevel}
                editingPlayerUID={editingPlayerUID}
                nameInput={nameInput}
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
                onHpChange={(hp) => {
                  setPlayerHP(hp, p.maxHp ?? 100);
                }}
                editingMaxHpUID={editingMaxHpUID}
                maxHpInput={maxHpInput}
                onMaxHpInputChange={updateMaxHpInput}
                onMaxHpEdit={startMaxHpEdit}
                onMaxHpSubmit={() => submitMaxHpEdit((maxHp) => setPlayerHP(p.hp ?? 100, maxHp))}
              />
            );
          })}
        </div>
      </div>

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
