// ============================================================================
// NPC CONDITIONS FIELD
// ============================================================================
// An NPC's conditions, from the DM menu's editor. The Party's NPC window has
// the same picker (U7); this is the phone's route to it (♛ DM → NPCs, where
// the phone Party lists no NPCs) and the desktop DM menu's. The server lets
// the DM set any character's conditions.

import { StatusEffectsPicker } from "../../players/components/StatusEffectsPicker";
import { useStatusEffectsPicker } from "../../players/components/useStatusEffectsPicker";

interface NpcConditionsFieldProps {
  effects: string[];
  onChange: (effects: string[]) => void;
}

export function NpcConditionsField({ effects, onChange }: NpcConditionsFieldProps): JSX.Element {
  const picker = useStatusEffectsPicker(effects, onChange);
  return <StatusEffectsPicker {...picker} />;
}
