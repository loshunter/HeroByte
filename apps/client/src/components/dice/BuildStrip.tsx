// ============================================================================
// BUILD STRIP - Token chip display
// ============================================================================

import React from "react";
import type { Build } from "./types";
import { DiceToken } from "./DiceToken";

interface BuildStripProps {
  build: Build;
  onUpdateBuild: (build: Build) => void;
  isAnimating?: boolean;
}

export const BuildStrip: React.FC<BuildStripProps> = ({
  build,
  onUpdateBuild,
  isAnimating = false,
}) => {
  const removeToken = (id: string) => {
    onUpdateBuild(build.filter((t) => t.id !== id));
  };

  const updateTokenQty = (id: string, qty: number) => {
    onUpdateBuild(build.map((t) => (t.id === id && t.kind === "die" ? { ...t, qty } : t)));
  };

  const updateTokenMod = (id: string, value: number) => {
    onUpdateBuild(build.map((t) => (t.id === id && t.kind === "mod" ? { ...t, value } : t)));
  };

  if (build.length === 0) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--hero-text-dim)",
          fontSize: "14px",
          fontStyle: "italic",
        }}
      >
        Add dice to start building your roll...
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        padding: "12px",
        overflowX: "auto",
        scrollBehavior: "smooth",
        alignItems: "center",
        minHeight: "72px",
      }}
    >
      {build.map((token, index) => (
        <React.Fragment key={token.id}>
          {index > 0 && token.kind === "mod" && token.value >= 0 && (
            <div
              style={{
                fontSize: "24px",
                color: "var(--hero-text-accent)",
                fontWeight: "bold",
              }}
            >
              +
            </div>
          )}
          {index > 0 && token.kind === "mod" && token.value < 0 && (
            <div
              style={{
                fontSize: "24px",
                color: "var(--hero-text-accent)",
                fontWeight: "bold",
              }}
            >
              −
            </div>
          )}
          <DiceToken
            token={token}
            onRemove={() => removeToken(token.id)}
            onUpdateQty={token.kind === "die" ? (qty) => updateTokenQty(token.id, qty) : undefined}
            onUpdateMod={
              token.kind === "mod" ? (value) => updateTokenMod(token.id, value) : undefined
            }
            isAnimating={isAnimating}
          />
        </React.Fragment>
      ))}
    </div>
  );
};
