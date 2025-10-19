// ============================================================================
// TOAST NOTIFICATION COMPONENT
// ============================================================================
// Non-blocking feedback messages with auto-dismiss and JRPG styling

import React, { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
}

interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (message.duration === 0) return;

    const dismissTimeout = setTimeout(() => {
      setIsExiting(true);
    }, message.duration ?? 3000);

    return () => clearTimeout(dismissTimeout);
  }, [message.duration]);

  useEffect(() => {
    if (!isExiting) return;

    const exitTimeout = setTimeout(() => {
      onDismiss(message.id);
    }, 300); // Match animation duration

    return () => clearTimeout(exitTimeout);
  }, [isExiting, message.id, onDismiss]);

  const getStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      padding: "12px 16px",
      borderRadius: "6px",
      border: "2px solid",
      marginBottom: "8px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "0.875rem",
      fontWeight: 600,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      animation: isExiting ? "toast-exit 0.3s ease-out forwards" : "toast-enter 0.3s ease-out",
      cursor: "pointer",
    };

    switch (message.type) {
      case "success":
        return {
          ...baseStyles,
          background: "var(--jrpg-success-bg, #1a3d2e)",
          borderColor: "var(--jrpg-success-border, #5affad)",
          color: "var(--jrpg-success-text, #5affad)",
        };
      case "error":
        return {
          ...baseStyles,
          background: "var(--jrpg-error-bg, #3d1a1a)",
          borderColor: "var(--jrpg-error-border, #ff5a5a)",
          color: "var(--jrpg-error-text, #ff5a5a)",
        };
      case "warning":
        return {
          ...baseStyles,
          background: "var(--jrpg-warning-bg, #3d2e1a)",
          borderColor: "var(--jrpg-warning-border, #ffc107)",
          color: "var(--jrpg-warning-text, #ffc107)",
        };
      case "info":
      default:
        return {
          ...baseStyles,
          background: "var(--jrpg-info-bg, #1a2a3d)",
          borderColor: "var(--jrpg-info-border, #5a9fff)",
          color: "var(--jrpg-info-text, #5a9fff)",
        };
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
      default:
        return "ℹ";
    }
  };

  return (
    <div style={getStyles()} onClick={() => onDismiss(message.id)} title="Click to dismiss">
      <span style={{ fontSize: "1.2rem" }}>{getIcon()}</span>
      <span style={{ flex: 1 }}>{message.message}</span>
    </div>
  );
};

export interface ToastContainerProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ messages, onDismiss }) => {
  if (messages.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes toast-enter {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes toast-exit {
            from {
              opacity: 1;
              transform: translateY(0);
            }
            to {
              opacity: 0;
              transform: translateY(-20px);
            }
          }
        `}
      </style>
      <div
        style={{
          position: "fixed",
          top: "80px",
          right: "20px",
          zIndex: 10000,
          maxWidth: "400px",
          pointerEvents: "auto",
        }}
      >
        {messages.map((msg) => (
          <Toast key={msg.id} message={msg} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
};
