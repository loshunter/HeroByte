// ============================================================================
// NPC EDITOR COMPONENT
// ============================================================================
// Extracted from DMMenu.tsx as part of Phase 2: Entity Editors refactoring.
// Provides editing interface for NPC properties including name, HP, and images.

import { useState, useEffect } from "react";
import type { NpcDisposition, SnapshotCharacter } from "@herobyte/shared";
import { normalizeHPValues, parseHPInput, parseMaxHPInput } from "@herobyte/shared";
import { JRPGPanel } from "../../../components/ui/JRPGPanel";
import { StatusBanner } from "../../../components/ui/StatusBanner";
import { NPCEditorActions } from "./NPCEditorActions";
import { MovementSpeedField } from "../../players/components/MovementSpeedField";
import { NpcPortraitField } from "./NpcPortraitField";
import { NpcTokenImageField } from "./NpcTokenImageField";
import { NpcStanceSelect } from "./NpcStanceSelect";
import { useNpcAssetPick } from "../hooks/useNpcAssetPick";

interface NPCEditorProps {
  npc: SnapshotCharacter;
  onUpdate: (updates: {
    name: string;
    hp: number;
    maxHp: number;
    tempHp?: number;
    portrait?: string;
    tokenImage?: string;
    initiativeModifier?: number;
    disposition?: NpcDisposition;
  }) => void;
  onPlace: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isUpdating?: boolean;
  updateError?: string | null;
  isPlacingToken?: boolean;
  isDuplicating?: boolean;
  tokenPlacementError?: string | null;
  /** Movement budget: feet per turn (null = the shared default). DM menu only, so DM-only. */
  onSpeedChange?: (speedFeet: number | null) => void;
  /** Movement budget: zero the spend outside a turn boundary. */
  onBudgetReset?: () => void;
}

/**
 * One spelling of the editor's text-field look, which was five identical
 * inline objects. Extracted because the Stance select's optimistic state put
 * this file over the 350-line guard; the object is byte-for-byte what each
 * copy was.
 */
const editableFieldStyle = (isUpdating: boolean) =>
  ({
    width: "100%",
    padding: "4px",
    background: "#111",
    color: "var(--jrpg-white)",
    border: "1px solid var(--jrpg-border-gold)",
    opacity: isUpdating ? 0.5 : 1,
    cursor: isUpdating ? "not-allowed" : "text",
  }) as const;

/** Five stats share one row; on a 375px phone they WRAP rather than squeeze to 60px each. */
const STAT_CELL = { flex: 1, minWidth: "88px" } as const;

export function NPCEditor({
  npc,
  onUpdate,
  onSpeedChange,
  onBudgetReset,
  onPlace,
  onDuplicate,
  onDelete,
  isDuplicating = false,
  isUpdating = false,
  updateError = null,
  isPlacingToken = false,
  tokenPlacementError = null,
}: NPCEditorProps) {
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

  useEffect(() => {
    setName(npc.name);
    setHpInput(String(npc.hp));
    setMaxHpInput(String(npc.maxHp));
    setTempHpInput(String(npc.tempHp ?? 0));
    setInitiativeModifierInput(String(npc.initiativeModifier ?? 0));
    setPortrait(npc.portrait ?? "");
    setTokenImage(npc.tokenImage ?? "");
    setStance(npc.disposition ?? "hostile");
  }, [npc]);

  const commitUpdate = (
    overrides?: Partial<{
      name: string;
      hp: number;
      maxHp: number;
      tempHp?: number;
      portrait?: string;
      tokenImage?: string;
      initiativeModifier?: number;
      disposition?: NpcDisposition;
    }>,
  ) => {
    // Parse HP values
    const baseHp = overrides?.hp ?? parseHPInput(hpInput, 0);
    const baseMaxHp = overrides?.maxHp ?? parseMaxHPInput(maxHpInput, 1);

    // Use new QoL validation: if HP > Max HP, auto-adjust Max HP
    const normalized = normalizeHPValues(baseHp, baseMaxHp);

    // Parse Temp HP
    const baseTempHp = overrides?.tempHp ?? parseHPInput(tempHpInput, 0);
    const parsedTempHp = Math.max(0, baseTempHp);

    // Parse Initiative Modifier
    const baseInitMod = overrides?.initiativeModifier ?? Number(initiativeModifierInput);
    const parsedInitMod = Number.isFinite(baseInitMod) ? Number(baseInitMod) : 0;
    const clampedInitMod = Math.max(-20, Math.min(20, parsedInitMod));

    // Update input fields to reflect normalized values
    setHpInput(String(normalized.hp));
    setMaxHpInput(String(normalized.maxHp));
    setTempHpInput(String(parsedTempHp));
    setInitiativeModifierInput(String(clampedInitMod));

    const nextNameSource = overrides?.name ?? name;
    const trimmedName = nextNameSource.trim();
    const nextPortraitSource = overrides?.portrait ?? portrait;
    const portraitValue = nextPortraitSource.trim();
    const nextTokenImageSource = overrides?.tokenImage ?? tokenImage;
    const tokenImageValue = nextTokenImageSource.trim();

    onUpdate({
      name: trimmedName.length > 0 ? trimmedName : "NPC",
      hp: normalized.hp,
      maxHp: normalized.maxHp,
      tempHp: parsedTempHp > 0 ? parsedTempHp : undefined,
      portrait: portraitValue.length > 0 ? portraitValue : undefined,
      tokenImage: tokenImageValue.length > 0 ? tokenImageValue : undefined,
      initiativeModifier: clampedInitMod,
      // Only when this edit set one. Three things downstream would each
      // survive a bare `disposition: undefined` anyway — useNpcUpdate merges
      // with `??`, JSON.stringify drops undefined values, and the server's
      // updateNPC guards on `!== undefined` — so this is consistency with the
      // other conditional writers, not the load-bearing guard it once claimed
      // to be. The real guard against an HP tweak clearing a stance is
      // useNpcUpdate's merge.
      ...(overrides?.disposition ? { disposition: overrides.disposition } : {}),
    });
  };

  const handleNameBlur = () => commitUpdate({ name });
  const handleHpBlur = () => commitUpdate();
  const handleMaxHpBlur = () => commitUpdate();
  const handleTempHpBlur = () => commitUpdate();
  const handleInitiativeModifierBlur = () => commitUpdate();

  const handlePickAsset = useNpcAssetPick(portrait, (next) => {
    setTokenImage(next.tokenImage);
    if (next.portrait !== undefined) setPortrait(next.portrait);
    // A revealed mimic stops being Neutral (useNpcAssetPick).
    if (next.disposition) setStance(next.disposition);
    commitUpdate(next);
  });

  return (
    <JRPGPanel variant="simple" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <StatusBanner variant="error" message={updateError ?? ""} visible={!!updateError} />
      <StatusBanner
        variant="error"
        message={tokenPlacementError ?? ""}
        visible={!!tokenPlacementError}
      />
      <StatusBanner variant="loading" message="Updating..." visible={isUpdating} />
      <StatusBanner variant="loading" message="Placing token..." visible={isPlacingToken} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <label className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameBlur();
            }}
            disabled={isUpdating}
            style={editableFieldStyle(isUpdating)}
          />
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <label className="jrpg-text-small" style={STAT_CELL}>
          HP
          <input
            type="number"
            min={0}
            value={hpInput}
            onChange={(e) => setHpInput(e.target.value)}
            onBlur={handleHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleHpBlur();
            }}
            disabled={isUpdating}
            style={editableFieldStyle(isUpdating)}
          />
        </label>
        <label className="jrpg-text-small" style={STAT_CELL}>
          Max HP
          <input
            type="number"
            min={1}
            value={maxHpInput}
            onChange={(e) => setMaxHpInput(e.target.value)}
            onBlur={handleMaxHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMaxHpBlur();
            }}
            disabled={isUpdating}
            style={editableFieldStyle(isUpdating)}
          />
        </label>
        <label className="jrpg-text-small" style={STAT_CELL}>
          Temp HP
          <input
            type="number"
            min={0}
            value={tempHpInput}
            onChange={(e) => setTempHpInput(e.target.value)}
            onBlur={handleTempHpBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTempHpBlur();
            }}
            disabled={isUpdating}
            title="Temporary hit points absorbed before regular HP"
            style={editableFieldStyle(isUpdating)}
          />
        </label>
        <label className="jrpg-text-small" style={STAT_CELL}>
          Init Mod
          <input
            type="number"
            min={-20}
            max={20}
            value={initiativeModifierInput}
            onChange={(e) => setInitiativeModifierInput(e.target.value)}
            onBlur={handleInitiativeModifierBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInitiativeModifierBlur();
            }}
            disabled={isUpdating}
            title="Initiative modifier added to d20 rolls"
            style={editableFieldStyle(isUpdating)}
          />
        </label>
        {onSpeedChange && (
          <div style={STAT_CELL}>
            <MovementSpeedField
              value={npc.speed}
              onChange={onSpeedChange}
              budget={
                // No fabricated 0: during the elevation blip the snapshot is
                // still the player's redacted frame, and a monster's spend is
                // simply absent — show nothing rather than a wrong number.
                onBudgetReset && npc.movementUsed !== undefined
                  ? { used: npc.movementUsed, onReset: onBudgetReset }
                  : undefined
              }
              compact
            />
          </div>
        )}
      </div>

      <NpcPortraitField
        portrait={portrait}
        committedPortrait={npc.portrait ?? ""}
        name={npc.name}
        disabled={isUpdating}
        onChange={setPortrait}
        onCommit={(url) => {
          setPortrait(url);
          commitUpdate({ portrait: url });
        }}
      />

      <NpcTokenImageField
        tokenImage={tokenImage}
        committedTokenImage={npc.tokenImage ?? ""}
        name={npc.name}
        disabled={isUpdating}
        onChange={setTokenImage}
        onCommit={(url) => {
          setTokenImage(url);
          commitUpdate({ tokenImage: url });
        }}
        onPickAsset={handlePickAsset}
      />

      <NpcStanceSelect
        value={stance}
        disabled={isUpdating}
        onChange={(disposition) => {
          // Optimistic, like every other field in this editor: the select used
          // to render straight off the snapshot, so it greyed out still showing
          // the OLD stance for the whole round trip and read as "my click did
          // not take" — then flipped a moment later.
          setStance(disposition);
          commitUpdate({ disposition });
        }}
      />

      <NPCEditorActions
        npcName={npc.name}
        onPlace={() => {
          commitUpdate();
          onPlace();
        }}
        // Commit first: duplicating copies what the SERVER holds, so an edit
        // still sitting in the form would be silently dropped from the copy.
        onDuplicate={() => {
          commitUpdate();
          onDuplicate();
        }}
        onDelete={onDelete}
        isUpdating={isUpdating}
        isPlacingToken={isPlacingToken}
        isDuplicating={isDuplicating}
      />
    </JRPGPanel>
  );
}
