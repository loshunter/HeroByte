// The map-edit palette is a lazy chunk, and a chunk that fails to load throws
// during render. Without a boundary of its own that reaches the app root, which
// replaces the entire table with a full-page error — and a table is a live
// shared thing, not a page you can casually reload.
//
// The realistic trigger is not a bug: a deploy invalidates the hashed chunk
// names while a session is open, so the FIRST map-edit arm after it 404s.
//
// This one offers an EXIT as well as a reload, which the DM-menu twin does not
// need. Losing the palette here is worse than losing a menu: map-edit mode is
// still armed, and the palette is where ✕ Close lives — so without a way out
// the DM keeps a canvas whose interaction rules have changed. `onClose` is
// `setActiveTool(null)` from the props bag (useMapEditState), computed on every
// render and in no way dependent on the chunk that just failed, so the button
// works. The header's map-edit toggle is a second exit; it is mentioned rather
// than relied upon, because a DM reading an error should not have to hunt.
//
// THERE IS NO "TRY AGAIN" HERE, deliberately, for the reason DMMenuLoadFailure
// records: React caches a lazy payload's REJECTION permanently (react 18.3.1),
// so retrying re-renders the same dead lazy and throws again. A retry that
// cannot recover was shipped once at this exact seam already.

import React from "react";

interface MapEditToolbarLoadFailureProps {
  /** Leaves map-edit mode. Not the chunk's — safe to call when it failed. */
  onClose: () => void;
}

export function MapEditToolbarLoadFailure({
  onClose,
}: MapEditToolbarLoadFailureProps): JSX.Element {
  return (
    <div role="alert" className="map-edit-load-failure">
      <p>
        The map tools could not be loaded. This usually means the table was updated while you were
        connected — reloading picks up the new version. The table itself is unaffected, and nothing
        you have already drawn is lost.
      </p>
      <button type="button" className="jrpg-button" onClick={onClose}>
        Leave map editing
      </button>
      <button type="button" className="jrpg-button" onClick={() => window.location.reload()}>
        Reload the page
      </button>
    </div>
  );
}
