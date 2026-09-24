import React from "react";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../../initiative/components/InitiativeModal";
import { CharacterCreationModal } from "../../players/components/CharacterCreationModal";
import { DMElevationModal } from "../../dm/components/DMElevationModal";
import { useEscapeOwner } from "../useEscapeOwner";

export const kinds = ["initiative", "character", "dm"] as const;
export type ModalKind = (typeof kinds)[number];
export const character: SnapshotCharacter = {
  id: "owned-modal-character",
  type: "pc",
  name: "Owned modal",
  hp: 10,
  maxHp: 10,
  initiativeModifier: 2,
};
export const actions = () => ({
  close: vi.fn(),
  set: vi.fn(),
  roll: vi.fn(),
  create: vi.fn(() => true),
  elevate: vi.fn(),
  bootstrap: vi.fn(),
  revoke: vi.fn(),
});
export type Actions = ReturnType<typeof actions>;

export function ActualModal({
  kind,
  calls,
  open = true,
  loading = false,
  close = calls.close,
}: {
  kind: ModalKind;
  calls: Actions;
  open?: boolean;
  loading?: boolean;
  close?: () => void;
}) {
  if (kind === "initiative")
    return open ? (
      <InitiativeModal
        character={character}
        isLoading={loading}
        onClose={close}
        onSetInitiative={calls.set}
        onRollInitiative={calls.roll}
      />
    ) : null;
  if (kind === "character")
    return (
      <CharacterCreationModal
        isOpen={open}
        isCreating={loading}
        onCreateCharacter={calls.create}
        onClose={close}
      />
    );
  return (
    <DMElevationModal
      isOpen={open}
      mode="elevate"
      isLoading={loading}
      error={null}
      currentIsDM={false}
      onElevate={calls.elevate}
      onBootstrap={calls.bootstrap}
      onRevoke={calls.revoke}
      onClose={close}
    />
  );
}

export function LowerOwners({ tool, selection }: { tool: () => void; selection: () => void }) {
  useEscapeOwner(() => ({
    kind: "tool",
    name: "fixture tool",
    active: true,
    order: 0,
    handle: tool,
  }));
  useEscapeOwner(() => ({
    kind: "selection",
    name: "fixture selection",
    active: true,
    order: 0,
    handle: selection,
  }));
  return null;
}

export function PendingGesture({
  pending,
  cancelled,
}: {
  pending: React.MutableRefObject<boolean>;
  cancelled: (reason: string) => void;
}) {
  useEscapeOwner(() => ({
    kind: "gesture",
    name: "fixture live stroke",
    active: pending.current,
    order: 1,
    label: "Cancel stroke",
    handle: (reason) => {
      pending.current = false;
      cancelled(reason);
    },
  }));
  return null;
}

export function Controlled({
  kind,
  calls,
  loading,
  tool,
  selection,
}: {
  kind: ModalKind;
  calls: Actions;
  loading: boolean;
  tool: () => void;
  selection: () => void;
}) {
  const [open, setOpen] = React.useState(true);
  return (
    <>
      <LowerOwners tool={tool} selection={selection} />
      <button onClick={() => setOpen(true)}>Reopen modal</button>
      <ActualModal
        kind={kind}
        calls={calls}
        open={open}
        loading={loading}
        close={() => {
          calls.close();
          setOpen(false);
        }}
      />
    </>
  );
}

export function overlay(): HTMLElement {
  const node = document.querySelector<HTMLElement>("[data-modal-overlay]");
  if (!node) throw new Error("The real modal did not render its connected overlay");
  return node;
}

export function escape(
  target: HTMLElement,
  init: KeyboardEventInit = {},
  before?: (event: KeyboardEvent) => void,
) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  before?.(event);
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}
