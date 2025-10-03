// ============================================================================
// DRAGGABLE WINDOW - SNES-style window that can be moved around
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';

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
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on a button
    if ((e.target as HTMLElement).closest('button')) {
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
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: `clamp(${minWidth}px, ${width}px, ${maxWidth}px)`,
        height: height ? `${height}px` : 'auto',
        maxHeight: 'calc(100vh - 40px)',
        zIndex,
        background:
          'repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 50% / 2px 2px, linear-gradient(180deg, #2a2845 0%, #1a1835 50%, #0f0e2a 100%)',
        border: '6px solid var(--hero-gold)',
        borderRadius: '12px',
        boxShadow:
          '0 0 0 2px var(--hero-navy-dark), 0 8px 24px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Title bar - draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="jrpg-text-command"
        style={{
          background: 'var(--jrpg-gold)',
          padding: '12px 20px',
          color: 'var(--jrpg-navy)',
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          position: 'relative',
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.3)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          border: '2px solid var(--jrpg-border-outer)',
          textShadow: 'none',
        }}
      >
        {title}
        {onClose && (
          <button
            onClick={onClose}
            className="jrpg-button jrpg-button-danger"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '24px',
              height: '24px',
              padding: 0,
              fontSize: '14px',
              lineHeight: '1',
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
          overflow: 'auto',
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
};
