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
}

type Pending = { resolve: () => void; reject: (error: Error) => void };

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
    ({ roomId, roomPassword, dmPassword }: CreateRoomInput) =>
      new Promise<void>((resolve, reject) => {
        if (pending.current) {
          reject(new Error("A table is already being created."));
          return;
        }
        pending.current = { resolve, reject };
        sendMessage({
          t: "create-room",
          roomId,
          roomPassword,
          ...(dmPassword ? { dmPassword } : {}),
        });
      }),
    [sendMessage],
  );
}
