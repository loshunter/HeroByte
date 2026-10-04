import { useState } from "react";
import { KickPanel, type KickPanelProps } from "../KickPanel";
import { defaultName, freshSeed } from "../kickDefaults";
import type { KickDraft } from "../useKickedInDoor";

// A stateful consumer for field-only tests. Real session lifetime is exercised
// separately with useKickedInDoor and the actual mobile shell.
export function ControlledKickPanel(props: KickPanelProps) {
  const [draft, setDraft] = useState<KickDraft>(() => ({
    name: defaultName(props.atlasNodes, props.kick.settings.recipe),
    recipe: props.kick.settings.recipe,
    seed: freshSeed(),
    linkType: props.kick.settings.linkType,
    renamed: false,
  }));
  return (
    <KickPanel
      {...props}
      kick={{
        ...props.kick,
        draft,
        updateDraft: (patch) => setDraft((current) => ({ ...current, ...patch })),
      }}
    />
  );
}
