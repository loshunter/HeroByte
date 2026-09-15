import { SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES } from "@herobyte/shared";

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * The campaign's weight beside the map list: what its session export weighs
 * against the mint ceiling and, past the wire limit, against what a load
 * accepts. A mint — new map, import, generate, a kicked-in door — is refused
 * when the export PLUS the scene the new map installs (its compiled walls,
 * terrain and scenery, up to ~0.15 MB at `large`) would pass the ceiling, so
 * mints stop a little before this number reaches it; the note says so.
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
      : " — a new map also costs the scene it installs (up to ~0.15 MB), so mints stop before this reaches the ceiling.";
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
