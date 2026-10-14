// ============================================================================
// TOKEN PICTURE CONTROL — the settings windows' way into the creator (C4)
// ============================================================================
// Replaces the "Token Image URL" field in the player's and the NPC's settings
// windows: the current picture, a "Token picture…" button that opens the
// creator, and Clear. A link still works (it lives in the creator, and one
// that cannot be framed is set as is). The creator is a lazy chunk; each
// "Try again" makes a fresh lazy component, because React caches a lazy
// payload's rejection for good.

import { Suspense, lazy, useMemo, useState } from "react";
import type { TokenSize } from "@herobyte/shared";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

export interface TokenPictureControlProps {
  /** The picture on file now. */
  imageUrl?: string;
  /** Sets the picture (a URL; "" never arrives here, Clear has its own). */
  onApply: (url: string) => void;
  onClear?: () => void;
  name?: string;
  tokenSize?: TokenSize;
  color?: string;
}

const loadWindow = () => import("./TokenCreatorWindow");

export function TokenPictureControl({
  imageUrl,
  onApply,
  onClear,
  name,
  tokenSize,
  color,
}: TokenPictureControlProps) {
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // A new lazy per attempt: a failed chunk load can be tried again.
  const Window = useMemo(() => lazy(loadWindow), [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
        Token picture
      </span>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {imageUrl ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt="Token preview"
            style={{
              width: "60px",
              height: "60px",
              flexShrink: 0,
              objectFit: "cover",
              borderRadius: "8px",
              border: "2px solid var(--jrpg-border-gold)",
            }}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          <JRPGButton
            variant="primary"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            title="Choose a picture, then move, zoom and turn it inside the token"
            style={{ fontSize: "10px", padding: "8px", minHeight: "44px" }}
          >
            Token picture…
          </JRPGButton>
          {imageUrl && onClear && (
            <JRPGButton onClick={onClear} style={{ fontSize: "10px", padding: "6px 8px" }}>
              Clear picture
            </JRPGButton>
          )}
        </div>
      </div>
      {open && (
        <ErrorBoundary
          key={attempt}
          fallback={
            <div role="alert" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <p className="jrpg-text-small" style={{ margin: 0 }}>
                The token picture window could not be loaded. Your picture is unchanged.
              </p>
              <JRPGButton
                onClick={() => setAttempt((n) => n + 1)}
                style={{ fontSize: "10px", padding: "6px 8px" }}
              >
                Try again
              </JRPGButton>
            </div>
          }
        >
          <Suspense
            fallback={
              <p className="jrpg-text-small" role="status" style={{ margin: 0 }}>
                Opening…
              </p>
            }
          >
            <Window
              name={name}
              tokenSize={tokenSize}
              color={color}
              onApply={onApply}
              onClose={() => setOpen(false)}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
