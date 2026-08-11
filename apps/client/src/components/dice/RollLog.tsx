// ============================================================================
// ROLL LOG - the desktop window over RollLogContent
// ============================================================================
// The tabs, clear button and entries live in RollLogContent, shared with the
// mobile shell's log screen. This file is only the DraggableWindow dressing —
// which is exactly the part the mobile path no longer wants: a desktop window
// pretending to be a phone surface is how the log's ✕ ended up 24px on every
// tablet and landscape phone.

import React from "react";
import { DraggableWindow } from "./DraggableWindow";
import { RollLogContent, type RollLogContentProps } from "./RollLogContent";

interface RollLogProps extends RollLogContentProps {
  onClose?: () => void;
}

export const RollLog: React.FC<RollLogProps> = ({ onClose, ...content }) => {
  return (
    <DraggableWindow
      title="⚂ ROLL LOG"
      onClose={onClose}
      initialX={window.innerWidth - 420}
      initialY={100}
      width={400}
      minWidth={350}
      maxWidth={500}
      height={600}
      storageKey="roll-log"
      zIndex={999}
    >
      <RollLogContent {...content} />
    </DraggableWindow>
  );
};
