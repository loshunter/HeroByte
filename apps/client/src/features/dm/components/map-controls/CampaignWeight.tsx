import { SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES } from "@herobyte/shared";

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * The campaign's weight beside the map list: what its session export weighs
 * against the mint ceiling and, past the wire limit, against what a load
 * accepts. A mint — new map, import, generate, a kicked-in door — is refused
 * when the export, with the scene the new map installs SWAPPED for the one on
 * the table (compiled walls, terrain, scenery — up to ~0.18 MB at `large`,
 * less whatever the current scene already weighs), would pass the ceiling; so
 * a mint can be refused before this number reaches it, and the note says so.
 * `bytes` is null until a list reply has said; then nothing renders, rather
 * than a number that means nothing.
 */
export function CampaignWeight({ bytes, maps }: { bytes: number | null; maps: number }) {
  if (bytes === null) return null;
  const overWire = bytes > WS_MAX_MESSAGE_BYTES;
  const pastCeiling = bytes > SESSION_MINT_CEILING_BYTES;
  const note = overWire
    ? " — past what a load accepts: a save will NOT load back. Delete a map."
    : pastCeiling
      ? " — past the mint ceiling: delete a map to make room."
      : " — a new map also costs the scene it installs, so a mint can be refused up to ~0.18 MB before this reaches the ceiling (less when the party is already on a large map).";
  return (
    <p
      role="status"
      data-testid="campaign-weight"
      className="jrpg-text-small"
      style={{ margin: "6px 0 0", color: pastCeiling ? "#ff9b8f" : undefined }}
    >
      Campaign {megabytes(bytes)} of {megabytes(SESSION_MINT_CEILING_BYTES)} · {maps} map
      {maps === 1 ? "" : "s"}
      {note}
    </p>
  );
}
