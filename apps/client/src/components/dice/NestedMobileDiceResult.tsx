import type { ComponentProps } from "react";
import { useEscapeRootContext } from "../../features/interaction/useEscapeOwner";
import { MobileResultOverlay } from "./MobileResultOverlay";

// This specific inline child shares its roller's stacking context; portals do not infer it.
export function NestedMobileDiceResult(
  props: Omit<ComponentProps<typeof MobileResultOverlay>, "containingRoot">,
) {
  const containingRoot = useEscapeRootContext();
  if (!containingRoot) throw new Error("NestedMobileDiceResult requires the MobileDiceRoller root");
  return <MobileResultOverlay {...props} containingRoot={containingRoot} />;
}
