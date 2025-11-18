// ============================================================================
// MAP LOADING COMPONENT
// ============================================================================
// Simple loading fallback shown while MapBoard lazy-loads
// Used in React.Suspense boundary for code splitting

import React from "react";
import { Spinner } from "./Spinner";

export const MapLoading: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        backgroundColor: "var(--jrpg-dark-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <Spinner size={40} />
        <div
          style={{
            color: "var(--jrpg-gold)",
            fontSize: "0.875rem",
            fontFamily: "var(--jrpg-font)",
          }}
        >
          Loading map...
        </div>
      </div>
    </div>
  );
};
