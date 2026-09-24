import { useState } from "react";
import type { KickDraft } from "../../features/atlas/useKickedInDoor";
import type { MainLayoutProps } from "../props/MainLayoutProps";
import { MobileLayout } from "../MobileLayout";

// These shell tests observe routing through controlled props. The separate
// lifetime composition uses the real App-level hook, including draft creation.
export function KickLayoutUnderTest(props: MainLayoutProps) {
  const source = props.kick;
  const initialDraft = (): KickDraft | null =>
    source
      ? {
          name: "Dungeon",
          seed: 77,
          renamed: false,
          recipe: source.settings.recipe,
          linkType: source.settings.linkType,
        }
      : null;
  const [draft, setDraft] = useState<KickDraft | null>(() =>
    source?.open ? initialDraft() : null,
  );
  if (!source) return <MobileLayout {...props} />;
  return (
    <MobileLayout
      {...props}
      kick={{
        ...source,
        open: draft !== null,
        draft,
        updateDraft: (patch) =>
          setDraft((current) => (current ? { ...current, ...patch } : current)),
        openKick: () => {
          source.openKick();
          setDraft((current) => current ?? initialDraft());
        },
        closeKick: () => {
          source.closeKick();
          setDraft(null);
        },
        kick: (request) => {
          source.kick(request);
          setDraft(null);
        },
      }}
    />
  );
}
