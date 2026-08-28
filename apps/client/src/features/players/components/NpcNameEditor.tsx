// Renaming an NPC, in place.
//
// This replaced a DOUBLE-CLICK into window.prompt(). Both halves of that were
// desktop-only: a double-click is a gesture a touch device does not have, and
// prompt() is a blocking modal that cannot be styled, cannot be cancelled
// cleanly on iOS, and freezes the tab while it is up. So renaming an NPC was
// unreachable on a surface a mobile DM has had since M4b.
//
// It is a wrapper around the player card's NameEditor rather than a second
// implementation, so the two cards open, commit and cancel identically.
//
// The buffer is LOCAL, deliberately. The player panel learned this the hard
// way: one shared `nameInput` across cards meant typing in one appeared in
// every other open card, and the settings window rendered it blank because it
// sat outside the inline editor's own gate.

import React, { useState } from "react";
import { NameEditor } from "./NameEditor";

interface NpcNameEditorProps {
  id: string;
  name: string;
  /** DM only. A player sees the name and cannot open the editor at all. */
  canEdit: boolean;
  onRename: (id: string, name: string) => void;
}

export function NpcNameEditor({ id, name, canEdit, onRename }: NpcNameEditorProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(name);

  return (
    <div className="player-card-title">
      <NameEditor
        isEditing={editing}
        isMe={canEdit}
        playerName={name}
        playerUid={id}
        nameInput={input}
        onNameInputChange={setInput}
        onNameEdit={() => {
          setInput(name);
          setEditing(true);
        }}
        onNameSubmit={(value) => {
          setEditing(false);
          const next = value.trim();
          // An emptied box means "I changed my mind", not "call it nothing" —
          // and the server rejects a blank name anyway (S8's whitespace fix),
          // so sending one would round-trip to an error nobody asked for.
          if (!next || next === name) return;
          onRename(id, next);
        }}
      />
    </div>
  );
}
