// ============================================================================
// NPC EDITOR FIELDS — the DM menu editor's input buffers and their resync
// ============================================================================
// Each field is a local buffer the DM types into, re-filled from the NPC as
// the server confirms changes. The rule that matters is WHEN it re-fills.

import { useEffect, useState } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";

export function useNpcEditorFields(npc: SnapshotCharacter, isUpdating: boolean) {
  const [name, setName] = useState(npc.name);
  const [hpInput, setHpInput] = useState(String(npc.hp));
  const [maxHpInput, setMaxHpInput] = useState(String(npc.maxHp));
  const [tempHpInput, setTempHpInput] = useState(String(npc.tempHp ?? 0));
  const [initiativeModifierInput, setInitiativeModifierInput] = useState(
    String(npc.initiativeModifier ?? 0),
  );
  const [portrait, setPortrait] = useState(npc.portrait ?? "");
  const [tokenImage, setTokenImage] = useState(npc.tokenImage ?? "");
  const [stance, setStance] = useState(npc.disposition ?? "hostile");

  // Resync on the NPC's VALUES, never on the object: `npc` is a fresh object
  // per broadcast (a player moving a token, a die rolled), and resyncing on
  // that wiped a half-typed name or HP. And NOT while this NPC's update is in
  // flight: a broadcast then can still carry the old values, which put the
  // optimistic Stance back to the old word, greyed out. useNpcUpdate holds
  // isUpdating (scoped to this NPC by NPCsTab) until the snapshot MATCHES, so
  // this re-runs on fresh data — and on a refused update, puts the fields back.
  const {
    name: serverName,
    hp,
    maxHp,
    tempHp,
    initiativeModifier,
    portrait: serverPortrait,
    tokenImage: serverTokenImage,
    disposition,
  } = npc;
  useEffect(() => {
    if (isUpdating) return;
    setName(serverName);
    setHpInput(String(hp));
    setMaxHpInput(String(maxHp));
    setTempHpInput(String(tempHp ?? 0));
    setInitiativeModifierInput(String(initiativeModifier ?? 0));
    setPortrait(serverPortrait ?? "");
    setTokenImage(serverTokenImage ?? "");
    setStance(disposition ?? "hostile");
  }, [
    serverName,
    hp,
    maxHp,
    tempHp,
    initiativeModifier,
    serverPortrait,
    serverTokenImage,
    disposition,
    isUpdating,
  ]);

  return {
    name,
    setName,
    hpInput,
    setHpInput,
    maxHpInput,
    setMaxHpInput,
    tempHpInput,
    setTempHpInput,
    initiativeModifierInput,
    setInitiativeModifierInput,
    portrait,
    setPortrait,
    tokenImage,
    setTokenImage,
    stance,
    setStance,
  };
}
