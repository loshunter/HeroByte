// The DM menu is a lazy chunk on BOTH layouts, and a chunk that fails to load
// throws during render. Without a boundary of its own that reaches the app
// root, which replaces the entire table with a full-page error — and a table
// is a live shared thing, not a page you can casually reload.
//
// The realistic trigger is not a bug: a deploy invalidates the hashed chunk
// names while a session is open, so the FIRST DM elevation after it 404s.
//
// THERE IS NO "TRY AGAIN" HERE, deliberately. It was offered once and could
// never have worked: React caches a lazy payload's REJECTION permanently
// (react 18.3.1 — lazyInitializer re-runs the import only while `_status ===
// Uninitialized`, and a rejected payload re-throws its stored error on every
// later render), so retrying re-renders the same dead lazy and throws again.
// The browser's module map caches the failed fetch too, so even a freshly
// constructed lazy would not re-request it. A reload is the only thing that
// recovers this, which is why it is the only thing on offer.

import React from "react";

export function DMMenuLoadFailure(): JSX.Element {
  return (
    <div role="alert" className="dm-menu-load-failure">
      <p>
        The DM tools could not be loaded. This usually means the table was updated while you were
        connected — reloading picks up the new version. The rest of the table is unaffected.
      </p>
      <button type="button" className="jrpg-button" onClick={() => window.location.reload()}>
        Reload the page
      </button>
    </div>
  );
}
