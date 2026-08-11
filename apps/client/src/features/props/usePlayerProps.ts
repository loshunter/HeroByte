/**
 * usePlayerProps Hook
 *
 * The player-side prop senders: create (with scatter count), update, delete,
 * plus the "which of these are mine" derivation the panel lists.
 *
 * Lives in features/props, NOT features/dm — the DM folder is a lazy chunk
 * that only loads on elevation, and this hook must ship to every player the
 * moment the table's player-props toggle is on.
 *
 * Create carries the same single-flight guard as the DM's usePropCreation:
 * one create in the air, confirmed by watching the snapshot's prop count
 * grow. A scatter is still ONE flight — `count` rides the one message and the
 * server loops, so any growth confirms the batch.
 *
 * @module features/props/usePlayerProps
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ClientMessage, Prop, RoomSnapshot, TokenSize } from "@herobyte/shared";

export interface CreatePlayerPropInput {
  label: string;
  imageUrl: string;
  size: TokenSize;
  /** How many to scatter. 1 places a single prop at the viewport centre. */
  count: number;
}

export interface UsePlayerPropsOptions {
  snapshot: RoomSnapshot | null;
  /** This player's uid — the owner filter for the panel's list. */
  uid: string;
  sendMessage: (message: ClientMessage) => void;
  /** Current camera, so the server can place the prop at the viewport centre. */
  camera: { x: number; y: number; scale: number };
}

export interface UsePlayerPropsReturn {
  /** Props this player owns — the only ones the server lets them manage. */
  ownProps: Prop[];
  isCreating: boolean;
  creationError: string | null;
  createProps: (input: CreatePlayerPropInput) => void;
  updateProp: (prop: Prop, updates: { label: string; imageUrl: string; size: TokenSize }) => void;
  deleteProp: (id: string) => void;
}

export function usePlayerProps(options: UsePlayerPropsOptions): UsePlayerPropsReturn {
  const { snapshot, uid, sendMessage, camera } = options;

  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const prevPropCountRef = useRef<number>(0);

  const ownProps = useMemo(
    () => (snapshot?.props ?? []).filter((prop) => prop.owner === uid),
    [snapshot?.props, uid],
  );

  // Track the baseline count while idle so the in-flight check below has
  // something honest to compare against.
  useEffect(() => {
    if (!isCreating) {
      prevPropCountRef.current = snapshot?.props?.length ?? 0;
    }
  }, [snapshot?.props, isCreating]);

  // Any growth confirms the create — a scatter of 6 grows by up to 6, a
  // single by 1, and either way the batch was one message and one broadcast.
  useEffect(() => {
    if (!isCreating) return;
    const currentCount = snapshot?.props?.length ?? 0;
    if (currentCount > prevPropCountRef.current) {
      prevPropCountRef.current = currentCount;
      setIsCreating(false);
      setCreationError(null);
    }
  }, [snapshot?.props, isCreating]);

  const createProps = useCallback(
    (input: CreatePlayerPropInput) => {
      if (isCreating) {
        console.warn("[usePlayerProps] Prop creation already in progress");
        return;
      }
      setIsCreating(true);
      setCreationError(null);

      sendMessage({
        t: "create-prop",
        label: input.label,
        imageUrl: input.imageUrl,
        // The dispatcher overwrites a non-DM's owner with the sender anyway;
        // sending our own uid keeps the message honest rather than leaning on
        // the overwrite.
        owner: uid,
        size: input.size,
        viewport: { x: camera.x, y: camera.y, scale: camera.scale },
        count: input.count > 1 ? input.count : undefined,
      });

      setTimeout(() => {
        setIsCreating((prev) => {
          if (prev) {
            // Still in flight after 5s: the likeliest cause is the DM flipped
            // the toggle off between our render and our send.
            setCreationError("Prop creation timed out — the DM may have turned props off.");
            return false;
          }
          return prev;
        });
      }, 5000);
    },
    [isCreating, sendMessage, uid, camera.x, camera.y, camera.scale],
  );

  const updateProp = useCallback(
    (prop: Prop, updates: { label: string; imageUrl: string; size: TokenSize }) => {
      sendMessage({
        t: "update-prop",
        id: prop.id,
        label: updates.label,
        imageUrl: updates.imageUrl,
        // Unchanged on purpose — and the server ignores a player's owner
        // field anyway; a player edit can't re-home a prop.
        owner: prop.owner,
        size: updates.size,
      });
    },
    [sendMessage],
  );

  const deleteProp = useCallback(
    (id: string) => {
      sendMessage({ t: "delete-prop", id });
    },
    [sendMessage],
  );

  return { ownProps, isCreating, creationError, createProps, updateProp, deleteProp };
}
