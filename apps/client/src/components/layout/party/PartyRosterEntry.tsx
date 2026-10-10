// ============================================================================
// PARTY ROSTER ENTRY
// ============================================================================
// One compact Party row: portrait, name, HP, a condition summary and Focus.
// Selecting it opens that character's full card in the inspector; every other
// action (HP edits, conditions, settings) lives in that card, so this row
// carries no second copy of them.

import type React from "react";
import { keylineFor, textOn } from "@herobyte/shared";
import { sanitizeText } from "../../../utils/sanitize";
import type { RosterEntryView } from "./rosterEntryView";

interface PartyRosterEntryProps {
  view: RosterEntryView;
  selected: boolean;
  /** The id of the inspector this row's selection opens. */
  inspectorId: string;
  onSelect: (event: React.MouseEvent<HTMLButtonElement>, characterId: string) => void;
  onFocus: (tokenId: string) => void;
}

function hpState(current: number, max: number): "high" | "medium" | "low" {
  const percent = max > 0 ? (current / max) * 100 : 0;
  return percent > 66 ? "high" : percent > 33 ? "medium" : "low";
}

function Vitals({ view }: { view: RosterEntryView }): JSX.Element {
  const { hp, conditions } = view;
  const [first, ...rest] = conditions;
  return (
    <div className="party-roster__vitals">
      {hp.kind === "exact" ? (
        <span className="party-roster__hp" data-hp-state={hpState(hp.current, hp.max)}>
          <span className="party-roster__hp-text">
            HP {hp.current}
            {hp.temp ? ` (+${hp.temp})` : ""}/{hp.max}
          </span>
          <span className="party-roster__hp-track" aria-hidden="true">
            <span
              className="party-roster__hp-fill"
              style={{
                width: `${Math.max(0, Math.min(100, (hp.current / (hp.max || 1)) * 100))}%`,
              }}
            />
          </span>
        </span>
      ) : (
        <span className="party-roster__hp party-roster__hp--redacted">
          {hp.badge === "bloodied" ? "🩸 Bloodied" : hp.badge === "healthy" ? "Healthy" : "HP ???"}
        </span>
      )}
      {first && (
        <span
          className="party-roster__conditions"
          role="img"
          aria-label={`Conditions: ${conditions.map((c) => c.label).join(", ")}`}
          title={conditions.map((c) => c.label).join(", ")}
        >
          {first.emoji} {first.label}
          {rest.length > 0 ? ` +${rest.length}` : ""}
        </span>
      )}
    </div>
  );
}

export function PartyRosterEntry({
  view,
  selected,
  inspectorId,
  onSelect,
  onFocus,
}: PartyRosterEntryProps): JSX.Element {
  const name = sanitizeText(view.name);
  const tag = view.tag ? sanitizeText(view.tag) : null;
  const classes = [
    "party-roster__entry",
    `party-roster__entry--${view.kind}`,
    view.isMe ? "party-roster__entry--me" : "",
    view.isCurrentTurn ? "party-roster__entry--current-turn" : "",
    selected ? "party-roster__entry--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // The row's state reads aloud with its name: the visible tags are inside
  // the button, so the label says the same thing rather than hiding it.
  const label = [
    tag ? `${name} (${tag})` : name,
    view.isCurrentTurn ? "current turn" : "",
    view.initiative !== undefined ? `initiative ${view.initiative}` : "",
    view.hiddenFromPlayers ? "hidden from players" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li className={classes} data-character-id={view.characterId}>
      <button
        type="button"
        className="party-roster__select"
        aria-expanded={selected}
        aria-controls={selected ? inspectorId : undefined}
        aria-label={`${label}: details`}
        onClick={(event) => onSelect(event, view.characterId)}
      >
        <span
          className="party-roster__portrait"
          // A keyline edge outside the ring: a deep colour's ring vanished on the row.
          style={{ borderColor: view.ring, boxShadow: `0 0 0 1px ${keylineFor(view.ring)}` }}
        >
          {view.portrait ? (
            <img src={view.portrait} alt="" draggable={false} />
          ) : (
            <span
              className="party-roster__initial"
              // Black or white, whichever reads (textOn): white was 1.3:1 on the default green.
              // The stylesheet's dark shadow only helps white letters.
              style={{
                backgroundColor: view.ring,
                color: textOn(view.ring),
                textShadow: textOn(view.ring) === "#000000" ? "none" : undefined,
              }}
            >
              {name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </span>
        <span className="party-roster__heading">
          <span className="party-roster__name" title={name}>
            {name}
          </span>
          <span className="party-roster__meta">
            {view.isCurrentTurn && <span className="party-roster__turn">Turn</span>}
            {view.initiative !== undefined && (
              <span className="party-roster__init">Init {view.initiative}</span>
            )}
            {view.hiddenFromPlayers && <span className="party-roster__tag">Hidden</span>}
            {tag && <span className="party-roster__tag">{tag}</span>}
          </span>
        </span>
      </button>
      <Vitals view={view} />
      {view.focusTokenId ? (
        <button
          type="button"
          className="party-roster__focus"
          aria-label={`Focus ${name}`}
          title="Center the map on this token"
          onClick={() => onFocus(view.focusTokenId as string)}
        >
          🎯
        </button>
      ) : (
        <span
          className="party-roster__focus party-roster__focus--none"
          role="img"
          aria-label={`${name} has no token on the map`}
          title="No token on the map"
        >
          —
        </span>
      )}
    </li>
  );
}
