import { SESSION_MINT_CEILING_BYTES, WS_MAX_MESSAGE_BYTES } from "@herobyte/shared";

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * The campaign's weight beside the map list: what its session export weighs
 * against the mint ceiling (a mint — new map, import, generate, a kicked-in
 * door — is refused past it) and, past the wire limit, against what a load
 * accepts. `bytes` is null until a list reply has said; then nothing renders,
 * rather than a number that means nothing.
 */
export function CampaignWeight({ bytes, maps }: { bytes: number | null; maps: number }) {
  if (bytes === null) return null;
  const overWire = bytes > WS_MAX_MESSAGE_BYTES;
  const pastCeiling = bytes > SESSION_MINT_CEILING_BYTES;
  const note = overWire
    ? " — past what a load accepts: a save will NOT load back. Delete a map."
    : pastCeiling
      ? " — past the mint ceiling: delete a map to make room."
      : "";
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
