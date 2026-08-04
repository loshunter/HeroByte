// ============================================================================
// useDiceBuild — the roller's brain, shared by the desktop and mobile surfaces
// ============================================================================
// DiceRoller and MobileDiceRoller held two copies of this logic. They drifted:
// only the desktop one ever played a sound, so phones rolled in silence and
// never got a crit sting. S5 has to touch both anyway (the roll becomes
// asynchronous), so the duplication goes now rather than becoming three copies
// with advantage and visibility added to each.
//
// The shape that changed: a roll used to be computed locally and displayed
// immediately. Now the client sends a formula and the ANSWER ARRIVES LATER, in
// the next snapshot. This hook owns that wait, and the two ways it can go
// wrong: a roll the server refuses (checked BEFORE sending, so it never
// happens silently) and a roll whose answer is slow (the settle reads the
// newest roll at fire time, so a late answer cannot be shown as a later
// roll's).

import { useCallback, useEffect, useRef, useState } from "react";
import { parseDiceFormula } from "@herobyte/shared";
import type { DiceRollMode, DiceVisibility } from "@herobyte/shared";
import type { Build, DieType, RollResult } from "./types";
import type { RollLogEntry } from "./rollLogTypes";
import { formulaFromBuild } from "./diceLogic";
import { generateUUID } from "../../utils/uuid";
import { useSfx, detectRollFlavor } from "../../features/juice";

/** How long the dice tumble before a result is shown, even if it arrived sooner. */
const ANIMATION_MS = 600;
/**
 * How long before the ROLL button is given back on a roll that has not come
 * home. The request is NOT abandoned — a late answer still lands — this only
 * stops the controls being held hostage by a dropped frame or a reconnect.
 */
const RESPONSE_TIMEOUT_MS = 6000;

export interface UseDiceBuildOptions {
  /** Ask the server to roll. The result comes back via `latestOwnRoll`. */
  onRoll?: (request: { formula: string; mode: DiceRollMode; visibility: DiceVisibility }) => void;
  /** Newest roll in history authored by this player, straight from the snapshot. */
  latestOwnRoll?: RollLogEntry | null;
}

export function useDiceBuild({ onRoll, latestOwnRoll }: UseDiceBuildOptions) {
  const [build, setBuild] = useState<Build>([]);
  const [mode, setMode] = useState<DiceRollMode>("normal");
  const [visibility, setVisibility] = useState<DiceVisibility>("public");
  const [result, setResult] = useState<RollResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  /** Why the last roll was refused, or null. Shown next to the ROLL button. */
  const [error, setError] = useState<string | null>(null);
  const { play } = useSfx();

  // Which roll was newest when we asked. Anything newer than this is ours.
  const baselineId = useRef<string | null>(null);
  const awaiting = useRef(false);
  const settleScheduled = useRef(false);
  const rollStartedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Read at settle time rather than captured when the answer arrives — see the
  // resolution effect.
  const latestRef = useRef(latestOwnRoll);
  latestRef.current = latestOwnRoll;

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const addDie = useCallback((die: DieType) => {
    setError(null);
    setBuild((current) => {
      const existing = current.find((token) => token.kind === "die" && token.die === die);
      if (existing) {
        return current.map((token) =>
          token.id === existing.id && token.kind === "die"
            ? { ...token, qty: token.qty + 1 }
            : token,
        );
      }
      return [...current, { kind: "die", die, qty: 1, id: generateUUID() }];
    });
  }, []);

  const addModifier = useCallback((value: number) => {
    setError(null);
    setBuild((current) => [...current, { kind: "mod", value, id: generateUUID() }]);
  }, []);

  const clearBuild = useCallback(() => {
    setBuild([]);
    setResult(null);
    setError(null);
  }, []);

  /** Roll a formula outright — how macros roll, and how the build strip rolls. */
  const rollFormula = useCallback(
    (formula: string, macroMode: DiceRollMode = mode) => {
      if (!onRoll || isAnimating || !formula) return;

      // Check BEFORE sending, with the same parser the server validates with.
      // The build strip can assemble things the server refuses — seventeen +1
      // chips crosses TERMS_MAX, and two dice at ×99 crosses TOTAL_DICE_MAX —
      // and the server drops those silently. Without this the roll simply
      // vanished and the ROLL button sat dead for six seconds.
      const parsed = parseDiceFormula(formula);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }

      clearTimers();
      setError(null);
      baselineId.current = latestOwnRoll?.id ?? null;
      awaiting.current = true;
      settleScheduled.current = false;
      rollStartedAt.current = Date.now();
      setIsAnimating(true);
      play("diceRattle");
      onRoll({ formula, mode: macroMode, visibility });
      timers.current.push(
        setTimeout(() => {
          // Give the controls back, but stay ARMED: the request is not
          // abandoned, so an answer that arrives late still shows. Clearing
          // `awaiting` here instead would strand a slow roll's result forever.
          setIsAnimating(false);
        }, RESPONSE_TIMEOUT_MS),
      );
    },
    [clearTimers, isAnimating, latestOwnRoll, mode, onRoll, play, visibility],
  );

  const roll = useCallback(() => {
    if (build.length === 0) return;
    rollFormula(formulaFromBuild(build), mode);
  }, [build, mode, rollFormula]);

  // The answer arrives here, one snapshot later.
  useEffect(() => {
    if (!awaiting.current || !latestOwnRoll) return;
    if (latestOwnRoll.id === baselineId.current) return;
    if (settleScheduled.current) return;
    settleScheduled.current = true;

    // Let the dice finish tumbling if they got back early; show immediately if
    // the round trip already took longer than the animation.
    const remaining = Math.max(0, ANIMATION_MS - (Date.now() - rollStartedAt.current));
    timers.current.push(
      setTimeout(() => {
        // Read the NEWEST own roll now rather than the one that woke this
        // effect. A slow answer can land after the player has rolled again;
        // capturing here would show the stale roll's numbers as the new
        // roll's result and then discard the real one.
        const settled = latestRef.current;
        awaiting.current = false;
        settleScheduled.current = false;
        setIsAnimating(false);
        if (!settled) return;
        setResult(settled);
        play("diceLand");
        const flavor = detectRollFlavor(settled);
        if (flavor === "crit") play("critSting");
        else if (flavor === "fumble") play("failThud");
      }, remaining),
    );
  }, [latestOwnRoll, play]);

  return {
    build,
    setBuild,
    mode,
    setMode,
    visibility,
    setVisibility,
    result,
    setResult,
    isAnimating,
    error,
    addDie,
    addModifier,
    clearBuild,
    roll,
    rollFormula,
  };
}
