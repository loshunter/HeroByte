// The DM menu is a lazy chunk on BOTH layouts, and a chunk that fails to load
// throws during render. Without a boundary of its own that reaches the app
// root, which replaces the entire table with a full-page error — and a table
// is a live shared thing, not a page you can casually reload.
//
// The realistic trigger is not a bug: a deploy invalidates the hashed chunk
// names while a session is open, so the FIRST DM elevation after it 404s.
// Retrying is worth offering because a reload after the deploy usually
// succeeds, and losing only the menu is survivable while losing the table is
// not.

import React from "react";

export function DMMenuLoadFailure({ retry }: { retry: () => void }): JSX.Element {
  return (
    <div role="alert" className="dm-menu-load-failure">
      <p>
        The DM tools could not be loaded. If the table was deployed while you were connected, a
        reload will pick up the new version.
      </p>
      <button type="button" className="jrpg-button" onClick={retry}>
        Try again
      </button>
      <button type="button" className="jrpg-button" onClick={() => window.location.reload()}>
        Reload the page
      </button>
    </div>
  );
}
