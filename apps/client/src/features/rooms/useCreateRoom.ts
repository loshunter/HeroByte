// ============================================================================
// useCreateRoom
// ============================================================================
// Mints a private table from the auth gate: sends `create-room` over the
// already-open (pre-auth) socket and resolves when the server replies
// `room-created`, or rejects with the server's reason on `room-create-failed`.
// One in-flight create at a time.

import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";

export interface CreateRoomInput {
  roomId: string;
  roomPassword: string;
  dmPassword?: string;
  /** Display name, so the table is recognisable as more than a code. */
  name?: string;
}

type Pending = { resolve: () => void; reject: (error: Error) => void };

/** How long to wait for `room-created` before admitting it isn't coming. */
const CREATE_ROOM_TIMEOUT_MS = 10_000;

export function useCreateRoom(
  sendMessage: (message: ClientMessage) => void,
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void,
): (input: CreateRoomInput) => Promise<void> {
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    registerServerEventHandler((message) => {
      if (!("t" in message)) return; // RoomSnapshot has no discriminant
      if (message.t === "room-created") {
        pending.current?.resolve();
        pending.current = null;
      } else if (message.t === "room-create-failed") {
        pending.current?.reject(new Error(message.reason ?? "Unable to create table."));
        pending.current = null;
      }
    });
  }, [registerServerEventHandler]);

  return useCallback(
    ({ roomId, roomPassword, dmPassword, name }: CreateRoomInput) =>
      new Promise<void>((resolve, reject) => {
        if (pending.current) {
          reject(new Error("A table is already being created."));
          return;
        }
        // A create-room sent on a closed socket is silently QUEUED, and that
        // queue only flushes on `auth-ok` — which pre-auth room creation can
        // never reach. Without this timeout the promise never settles and the
        // button sits on "Creating..." forever, recoverable only by reloading.
        const timer = setTimeout(() => {
          if (!pending.current) return;
          pending.current = null;
          reject(new Error("The server didn't respond. Check your connection and try again."));
        }, CREATE_ROOM_TIMEOUT_MS);

        const settle = (fn: () => void) => {
          clearTimeout(timer);
          fn();
        };

        pending.current = {
          resolve: () => settle(resolve),
          reject: (error: Error) => settle(() => reject(error)),
        };
        sendMessage({
          t: "create-room",
          roomId,
          roomPassword,
          ...(dmPassword ? { dmPassword } : {}),
          ...(name ? { name } : {}),
        });
      }),
    [sendMessage],
  );
}
