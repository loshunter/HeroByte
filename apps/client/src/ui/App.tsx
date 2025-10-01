// ============================================================================
// VTT CLIENT APP
// ============================================================================
// Main application component for the Virtual Tabletop client.
// Manages:
// - Network connection and room state
// - Player management and voice chat
// - UI layout (fixed top/bottom bars, center map canvas)
// - Tool modes (pointer, measure, draw)

import React, { useEffect, useState, useRef, memo } from "react";
import { NetClient } from "@adapters-net";
import { RoomSnapshot, Token, Player, Pointer, Drawing } from "@shared";
import MapBoard from "./MapBoard";
import { useVoiceChat } from "./useVoiceChat";

// ----------------------------------------------------------------------------
// SESSION MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Get or create a unique session ID for this browser
 * Stored in localStorage to persist across page reloads
 */
function getSessionUID(): string {
  const key = "herobyte-session-uid";
  const v = localStorage.getItem(key);
  if (v) return v;

  let id: string;
  if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
    id = crypto.randomUUID();
  } else {
    // Fallback UUID generator for browsers without crypto.randomUUID
    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  localStorage.setItem(key, id);
  return id;
}

// ----------------------------------------------------------------------------
// PLAYER CARD COMPONENT
// ----------------------------------------------------------------------------

/**
 * PlayerCard: Displays a single player's portrait and controls
 * Memoized to prevent unnecessary re-renders
 */
interface PlayerCardProps {
  player: Player;
  isMe: boolean;
  tokenColor?: string;
  micEnabled: boolean;
  micLevel: number;
  editingPlayerUID: string | null;
  nameInput: string;
  onNameInputChange: (name: string) => void;
  onNameEdit: (uid: string, name: string) => void;
  onNameSubmit: (name: string) => void;
  onPortraitLoad: () => void;
  onToggleMic: () => void;
}

const PlayerCard = memo<PlayerCardProps>(({
  player,
  isMe,
  tokenColor,
  micEnabled,
  micLevel,
  editingPlayerUID,
  nameInput,
  onNameInputChange,
  onNameEdit,
  onNameSubmit,
  onPortraitLoad,
  onToggleMic,
}) => {
  const editing = editingPlayerUID === player.uid;

  return (
    <div
      style={{
        width: "120px",
        height: "170px",
        background: "#222",
        border: "2px solid #555",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px",
        color: "#dbe1ff",
        fontSize: "0.8rem",
      }}
    >
      <div
        style={{
          width: "100%",
          textAlign: "center",
          borderBottom: "1px solid #444",
          marginBottom: "4px",
          fontSize: "0.7rem",
        }}
      >
        {isMe && editing ? (
          <input
            type="text"
            value={nameInput}
            onChange={(e) => onNameInputChange(e.target.value)}
            onBlur={() => onNameSubmit(nameInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onNameSubmit(nameInput);
              }
            }}
            autoFocus
            style={{
              width: "100%",
              fontSize: "0.7rem",
              background: "#111",
              color: tokenColor || "#dbe1ff",
              border: "1px solid #555",
              padding: "2px",
              textAlign: "center",
            }}
          />
        ) : (
          <span
            onClick={() => {
              if (isMe) {
                onNameEdit(player.uid, player.name);
              }
            }}
            style={{
              cursor: isMe ? "pointer" : "default",
              color: tokenColor || "#dbe1ff",
              fontWeight: "bold",
            }}
          >
            {player.name}
          </span>
        )}
      </div>

      <div
        style={{
          width: "64px",
          height: "64px",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "6px",
          overflow: "hidden",
          transform: (player.micLevel ?? 0) > 0.1
            ? `scale(${1 + (player.micLevel ?? 0) * 0.2})`
            : "scale(1)",
          transition: "transform 0.1s ease-out",
        }}
      >
        {player.portrait ? (
          <img
            key={player.portrait.substring(0, 100)}
            src={player.portrait}
            alt="portrait"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              userSelect: "none",
              display: "block",
            }}
            draggable={false}
          />
        ) : (
          <span style={{ fontSize: "0.6rem", color: "#aaa" }}>
            Portrait
          </span>
        )}
      </div>

      {isMe && (
        <>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              style={{
                fontSize: "0.7rem",
                padding: "2px 6px",
                background: "#6cf",
                border: "none",
                cursor: "pointer",
              }}
              onClick={onPortraitLoad}
            >
              Load
            </button>
            <button
              style={{
                fontSize: "0.7rem",
                padding: "2px 6px",
                background: micEnabled ? "#f66" : "#6c6",
                border: "none",
                cursor: "pointer",
              }}
              onClick={onToggleMic}
              title={micEnabled ? "Mute mic" : "Enable mic"}
            >
              {micEnabled ? "🔇" : "🎤"}
            </button>
          </div>
        </>
      )}
      {!isMe && (
        <div style={{ height: "22px" }} />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if relevant props change
  return (
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.portrait === nextProps.player.portrait &&
    prevProps.player.micLevel === nextProps.player.micLevel &&
    prevProps.tokenColor === nextProps.tokenColor &&
    prevProps.micEnabled === nextProps.micEnabled &&
    prevProps.micLevel === nextProps.micLevel &&
    prevProps.editingPlayerUID === nextProps.editingPlayerUID &&
    prevProps.nameInput === nextProps.nameInput
  );
});

// ----------------------------------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------------------------------

export const App: React.FC = () => {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  // Network and session
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);  // Room state from server
  const uid = getSessionUID();                                          // This player's unique ID
  const [net, setNet] = useState<NetClient>();                          // WebSocket client

  // Player name editing
  const [editingPlayerUID, setEditingPlayerUID] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  // Map controls
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridLocked, setGridLocked] = useState(false);

  // Tool modes
  const [pointerMode, setPointerMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);

  // Drawing tool settings
  const [drawTool, setDrawTool] = useState<"freehand" | "line" | "rect" | "circle" | "eraser">("freehand");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(3);
  const [drawOpacity, setDrawOpacity] = useState(1);
  const [drawFilled, setDrawFilled] = useState(false);

  // Voice chat
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // UI layout (fixed panels)
  const topPanelRef = useRef<HTMLDivElement | null>(null);
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);
  const [topHeight, setTopHeight] = useState(180);
  const [bottomHeight, setBottomHeight] = useState(210);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(null);

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
    net,
    uid,
    otherPlayerUIDs,
    enabled: micEnabled,
    stream: micStream,
  });

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------

  /**
   * Initialize network connection on mount
   */
  useEffect(() => {
    const n = new NetClient();
    const wsHost = window.location.hostname || "localhost";
    n.connect(`http://${wsHost}:8787`, uid, (snap) => setSnapshot(snap));
    setNet(n);
  }, [uid]);

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
   * Cleanup audio context and animation frame on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------------

  /**
   * Toggle microphone on/off
   * Starts/stops audio analysis for visual feedback
   */
  const toggleMic = async () => {
    if (micEnabled) {
      // Turn off mic
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        setMicStream(null);
      }
      setMicEnabled(false);
      setMicLevel(0);
      net?.send({ t: "mic-level", level: 0 });
    } else {
      // Turn on mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const detectLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalized = average / 255; // Normalize to 0-1
          setMicLevel(normalized);
          net?.send({ t: "mic-level", level: normalized });
          animationFrameRef.current = requestAnimationFrame(detectLevel);
        };

        detectLevel();
        setMicEnabled(true);
      } catch (err) {
        console.error("Mic access error:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert(`Microphone error: ${errorMsg}\n\nCheck Safari Settings → Websites → Microphone`);
      }
    }
  };

  /**
   * Token actions
   */
  const moveToken = (id: string, x: number, y: number) => {
    net?.send({ t: "move", id, x, y });
  };

  const recolorToken = (id: string) => {
    net?.send({ t: "recolor", id });
  };

  const deleteToken = (id: string) => {
    net?.send({ t: "delete-token", id });
  };

  /**
   * Player actions
   */
  const renamePlayer = (name: string) => {
    net?.send({ t: "rename", name });
  };

  const setPortraitURL = (url: string) => {
    net?.send({ t: "portrait", data: url });
  };

  /**
   * Map actions
   */
  const setMapBackgroundURL = (url: string) => {
    net?.send({ t: "map-background", data: url });
  };

  const setGridSize = (size: number) => {
    net?.send({ t: "grid-size", size });
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
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 200,
            background: "#1a1c24",
            border: "2px solid #555",
            padding: "12px",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            minWidth: "200px",
            maxWidth: "250px"
          }}
        >
          <h4 style={{ margin: 0, color: "#6cf", fontSize: "0.9rem" }}>Drawing Tools</h4>

          {/* Tool Selection */}
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>Tool:</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
              <button
                onClick={() => setDrawTool("freehand")}
                style={{
                  padding: "6px",
                  background: drawTool === "freehand" ? "#6cf" : "#333",
                  border: "1px solid #555",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: "#fff"
                }}
                title="Freehand Draw"
              >
                ✏️ Draw
              </button>
              <button
                onClick={() => setDrawTool("line")}
                style={{
                  padding: "6px",
                  background: drawTool === "line" ? "#6cf" : "#333",
                  border: "1px solid #555",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: "#fff"
                }}
                title="Line Tool"
              >
                📏 Line
              </button>
              <button
                onClick={() => setDrawTool("rect")}
                style={{
                  padding: "6px",
                  background: drawTool === "rect" ? "#6cf" : "#333",
                  border: "1px solid #555",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: "#fff"
                }}
                title="Rectangle Tool"
              >
                ▭ Rect
              </button>
              <button
                onClick={() => setDrawTool("circle")}
                style={{
                  padding: "6px",
                  background: drawTool === "circle" ? "#6cf" : "#333",
                  border: "1px solid #555",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: "#fff"
                }}
                title="Circle Tool"
              >
                ⬤ Circle
              </button>
              <button
                onClick={() => setDrawTool("eraser")}
                style={{
                  padding: "6px",
                  background: drawTool === "eraser" ? "#6cf" : "#333",
                  border: "1px solid #555",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  color: "#fff",
                  gridColumn: "1 / -1"
                }}
                title="Eraser"
              >
                🧹 Eraser
              </button>
            </div>
          </div>

          {/* Color Palette */}
          {drawTool !== "eraser" && (
            <div>
              <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>Color:</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "4px", marginBottom: "6px" }}>
                {["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff", "#ffff00",
                  "#ff00ff", "#00ffff", "#ff8800", "#8800ff", "#888888", "#ff88cc"].map(color => (
                  <button
                    key={color}
                    onClick={() => setDrawColor(color)}
                    style={{
                      width: "24px",
                      height: "24px",
                      background: color,
                      border: drawColor === color ? "2px solid #fff" : "1px solid #555",
                      cursor: "pointer",
                      padding: 0
                    }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                style={{
                  width: "100%",
                  height: "30px",
                  cursor: "pointer",
                  border: "1px solid #555"
                }}
              />
            </div>
          )}

          {/* Brush Size */}
          <div>
            <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>
              Brush Size: {drawWidth}px
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={drawWidth}
              onChange={(e) => setDrawWidth(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Opacity */}
          {drawTool !== "eraser" && (
            <div>
              <label style={{ fontSize: "0.75rem", display: "block", marginBottom: "4px" }}>
                Opacity: {Math.round(drawOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={drawOpacity * 100}
                onChange={(e) => setDrawOpacity(Number(e.target.value) / 100)}
                style={{ width: "100%" }}
              />
            </div>
          )}

          {/* Fill Toggle for Shapes */}
          {(drawTool === "rect" || drawTool === "circle") && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                id="drawFilled"
                type="checkbox"
                checked={drawFilled}
                onChange={(e) => setDrawFilled(e.target.checked)}
              />
              <label htmlFor="drawFilled" style={{ fontSize: "0.75rem" }}>Filled</label>
            </div>
          )}

          {/* Clear All Button */}
          <button
            onClick={() => net?.send({ t: "clear-drawings" })}
            style={{
              padding: "8px",
              background: "#f66",
              border: "none",
              cursor: "pointer",
              fontSize: "0.75rem",
              color: "#fff",
              marginTop: "8px"
            }}
          >
            🗑️ Clear All Drawings
          </button>
        </div>
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
              style={{
                padding: "4px 8px",
                background: "#6c6",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "#fff"
              }}
            >
              New Player
            </button>
            <button
              onClick={() => {
                if (confirm("Clear all old tokens/players? This will remove disconnected players but keep your own token.")) {
                  net?.send({ t: "clear-all-tokens" });
                }
              }}
              style={{
                padding: "4px 8px",
                background: "#f66",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "#fff"
              }}
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
          <div>
            <button
              onClick={() => {
                const url = prompt("Enter map image URL:");
                if (url && url.trim()) {
                  setMapBackgroundURL(url.trim());
                }
              }}
              style={{
                padding: "4px 12px",
                background: "#6cf",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
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
          net={net}
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
        <h3 style={{ margin: "0 0 8px 0", color: "#6cf" }}>Party</h3>
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
                onNameInputChange={setNameInput}
                onNameEdit={(uid, name) => {
                  setNameInput(name);
                  setEditingPlayerUID(uid);
                }}
                onNameSubmit={(name) => {
                  renamePlayer(name);
                  setEditingPlayerUID(null);
                }}
                onPortraitLoad={() => {
                  const url = prompt("Enter image URL:");
                  if (url && url.trim()) {
                    setPortraitURL(url.trim());
                  }
                }}
                onToggleMic={toggleMic}
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
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              background: "#f66",
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontSize: "0.9rem",
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
    </div>
  );
};
