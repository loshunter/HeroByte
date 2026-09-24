import type { ComponentProps } from "react";
import { useEscapeRootContext } from "../../features/interaction/useEscapeOwner";
import { ResultPanel } from "./ResultPanel";

export function NestedDiceResult(
  props: Omit<ComponentProps<typeof ResultPanel>, "containingRoot">,
) {
  const containingRoot = useEscapeRootContext();
  if (!containingRoot) throw new Error("NestedDiceResult requires the DiceRoller frame root");
  return <ResultPanel {...props} containingRoot={containingRoot} />;
}
