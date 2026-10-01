import { SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES } from "@herobyte/shared";

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * What the heaviest new map can still cost on top of the maps already saved. The mint
 * weigh counts the new document itself AND the scene it installs once the party stands
 * on it (see SESSION_MINT_CEILING_BYTES), so a `large` warehouse — the heaviest building —
 * costs its 270 KB stored PLUS up to 190 KB of compiled scene, the maxima measured in
 * wsLimits: about 460 KB all in. Closer than this to the ceiling a large map may be refused,
 * so the panel says "nearly full" before it says "full"; a smaller map may still fit, which
 * is why it says "a large map".
 */
export const NEW_MAP_ALLOWANCE_BYTES = (270 + 190) * 1024;

type Room = "room" | "nearly-full" | "full" | "too-big";

function roomFor(bytes: number): Room {
  if (bytes > WS_MAX_MESSAGE_BYTES) return "too-big";
  if (bytes > SESSION_MINT_CEILING_BYTES) return "full";
  if (bytes + NEW_MAP_ALLOWANCE_BYTES > SESSION_MINT_CEILING_BYTES) return "nearly-full";
  return "room";
}

/** What can still be made, and what to do next. The numbers behind it are the tooltip and the help. */
const OUTCOME: Record<Room, string> = {
  room: "Room for more maps.",
  "nearly-full": "Nearly full — a large map may be refused. Delete a map you no longer need.",
  full: "Full — new maps are refused. Delete a map to make room.",
  "too-big":
    "Too big to restore — a table backup of this campaign would not load back. Delete a map.",
};

/**
 * The campaign's room beside the map list (U9: an outcome, not the byte arithmetic).
 * It used to print the export's weight against the mint ceiling and explain the scene a
 * new map installs; those numbers are this line's tooltip and the DM help's "How many
 * maps fit", and the refusal a DM actually meets still says what was refused and why.
 * `bytes` is null until a list reply has said; then nothing renders, rather than a
 * number that means nothing.
 */
export function CampaignWeight({ bytes, maps }: { bytes: number | null; maps: number }) {
  if (bytes === null) return null;
  const room = roomFor(bytes);
  return (
    <p
      role="status"
      data-testid="campaign-weight"
      data-room={room}
      className="jrpg-text-small"
      title={`Campaign ${megabytes(bytes)} of ${megabytes(SESSION_MINT_CEILING_BYTES)}`}
      style={{ margin: "6px 0 0", color: room === "room" ? undefined : "#ff9b8f" }}
    >
      {maps} map{maps === 1 ? "" : "s"} · {OUTCOME[room]}
    </p>
  );
}
