/**
 * AuthenticationGate Style Constants
 *
 * Styling definitions for the authentication gate UI components.
 * Extracted from AuthenticationGate.tsx for better code organization.
 *
 * @module features/auth/AuthenticationGate.styles
 */

import type React from "react";

export const authGateContainerStyle: React.CSSProperties = {
  alignItems: "center",
  background: "radial-gradient(circle at top, #101020 0%, #050509 100%)",
  display: "flex",
  height: "100vh",
  justifyContent: "center",
  padding: "24px",
};

export const authGateCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(17, 24, 39, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "12px",
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.5)",
  color: "#f8fafc",
  maxWidth: "400px",
  padding: "32px",
  width: "100%",
};

export const authGateErrorStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: "0.95rem",
  margin: "0",
};

export const authGateHintStyle: React.CSSProperties = {
  color: "#cbd5f5",
  fontSize: "0.85rem",
  marginTop: "16px",
};

export const authInputStyle: React.CSSProperties = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.5)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontFamily: "inherit",
  fontSize: "1rem",
  padding: "12px",
  width: "100%",
};

export const authPrimaryButtonStyle: React.CSSProperties = {
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

export const authSecondaryButtonStyle: React.CSSProperties = {
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
