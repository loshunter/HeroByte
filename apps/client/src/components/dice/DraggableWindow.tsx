// ============================================================================
// DRAGGABLE WINDOW - SNES-style window that can be moved around
// ============================================================================

import React, { useState, useRef, useEffect } from "react";

interface DraggableWindowProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  initialX?: number;
  initialY?: number;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  height?: number;
  zIndex?: number;
  storageKey?: string; // Optional key for localStorage persistence
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  title,
  children,
  onClose,
  initialX = 100,
  initialY = 100,
  width = 600,
  minWidth = 400,
  maxWidth = 800,
  height,
  zIndex = 1000,
  storageKey,
}) => {
  // Load position from localStorage if storageKey is provided
  const getInitialPosition = () => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`herobyte-window-position-${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Validate the saved position
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            // Ensure position is within viewport bounds
            const maxX = window.innerWidth - 200; // Leave at least 200px visible
            const maxY = window.innerHeight - 100; // Leave at least 100px visible
            return {
              x: Math.max(0, Math.min(parsed.x, maxX)),
              y: Math.max(0, Math.min(parsed.y, maxY)),
            };
          }
        }
      } catch (error) {
        console.warn("Failed to load window position from localStorage:", error);
      }
    }
    return { x: initialX, y: initialY };
  };

  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on a button or on mobile
    if ((e.target as HTMLElement).closest("button") || isMobile) {
      return;
    }

    e.preventDefault();

    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMobile) {
        const newPosition = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
        setPosition(newPosition);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // Save position to localStorage when dragging ends
      if (storageKey && !isMobile) {
        try {
          localStorage.setItem(`herobyte-window-position-${storageKey}`, JSON.stringify(position));
        } catch (error) {
          console.warn("Failed to save window position to localStorage:", error);
        }
      }
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, position, storageKey, isMobile]);

  // Handle window resize - ensure window stays visible and toggle mobile mode
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (!mobile) {
        const maxX = window.innerWidth - 200;
        const maxY = window.innerHeight - 100;

        if (position.x > maxX || position.y > maxY) {
          const newPosition = {
            x: Math.max(0, Math.min(position.x, maxX)),
            y: Math.max(0, Math.min(position.y, maxY)),
          };
          setPosition(newPosition);

          // Save adjusted position
          if (storageKey) {
            try {
              localStorage.setItem(
                `herobyte-window-position-${storageKey}`,
                JSON.stringify(newPosition),
              );
            } catch (error) {
              console.warn("Failed to save adjusted window position:", error);
            }
          }
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, storageKey]);

  const mobileStyles: React.CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    maxHeight: "100vh",
    zIndex: zIndex + 100, // Boost z-index for mobile overlay
    background: "var(--jrpg-navy)", // Solid background for mobile
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const desktopStyles: React.CSSProperties = {
    position: "fixed",
    left: position.x,
    top: position.y,
    width: `clamp(${minWidth}px, ${width}px, ${maxWidth}px)`,
    height: height ? `${height}px` : "auto",
    maxHeight: "calc(100vh - 40px)",
    zIndex,
    background:
      "repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 50% / 2px 2px, linear-gradient(180deg, #2a2845 0%, #1a1835 50%, #0f0e2a 100%)",
    border: "6px solid var(--hero-gold)",
    borderRadius: "12px",
    boxShadow:
      "0 0 0 2px var(--hero-navy-dark), 0 8px 24px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.1)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    cursor: isDragging ? "grabbing" : "default",
  };

  return (
    <div ref={windowRef} style={isMobile ? mobileStyles : desktopStyles}>
      {/* Title bar - draggable on desktop */}
      <div
        onMouseDown={handleMouseDown}
        className="jrpg-text-command"
        style={{
          background: "var(--jrpg-gold)",
          padding: isMobile ? "16px 20px" : "12px 20px",
          color: "var(--jrpg-navy)",
          fontSize: isMobile ? "16px" : "12px",
          fontWeight: "bold",
          textAlign: "center",
          position: "relative",
          boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
          cursor: isMobile ? "default" : isDragging ? "grabbing" : "grab",
          userSelect: "none",
          border: isMobile ? "none" : "2px solid var(--jrpg-border-outer)",
          borderBottom: isMobile
            ? "2px solid var(--jrpg-border-gold)"
            : "2px solid var(--jrpg-border-outer)",
          textShadow: "none",
        }}
      >
        {title}
        {onClose && (
          <button
            onClick={onClose}
            className="jrpg-button jrpg-button-danger"
            style={{
              position: "absolute",
              right: isMobile ? "12px" : "8px",
              top: "50%",
              transform: "translateY(-50%)",
              width: isMobile ? "32px" : "24px",
              height: isMobile ? "32px" : "24px",
              padding: 0,
              fontSize: isMobile ? "18px" : "14px",
              lineHeight: "1",
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          pointerEvents: "auto",
          padding: isMobile ? "16px" : "0", // Add padding on mobile content
        }}
      >
        {children}
      </div>
    </div>
  );
};
