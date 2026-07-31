// ============================================================================
// USE FORK TABLE
// ============================================================================
// Copy the table you're in into a new private one and go there. Mirrors
// useCreateRoom's shape (promise that settles on the server's reply, with a
// timeout so the button can never hang), because the failure modes are the
// same — a queued message on a flaky socket must not leave "Saving…" forever.

import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { generateRoomId, rememberRoom, stashRoomSecret, navigateToRoom } from "./roomDirectory";

export interface ForkTableInput {
  name: string;
  roomPassword: string;
  dmPassword?: string;
}

type Pending = { resolve: () => void; reject: (error: Error) => void };

const REPLY_TIMEOUT_MS = 10_000;

export function useForkTable(
  sendMessage: (message: ClientMessage) => void,
  registerServerEventHandler?: (handler: (message: ServerMessage) => void) => void,
  navigate: (roomId: string) => void = navigateToRoom,
): (input: ForkTableInput) => Promise<void> {
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    if (!registerServerEventHandler) return;
    registerServerEventHandler((message: ServerMessage) => {
      if (!("t" in message)) return;
      if (message.t === "table-forked") {
        pending.current?.resolve();
      } else if (message.t === "table-fork-failed") {
        pending.current?.reject(new Error(message.reason ?? "Couldn't save the table."));
      }
    });
  }, [registerServerEventHandler]);

  return useCallback(
    ({ name, roomPassword, dmPassword }: ForkTableInput) =>
      new Promise<void>((resolve, reject) => {
        if (pending.current) {
          reject(new Error("A table is already being saved."));
          return;
        }
        const roomId = generateRoomId();

        const timer = setTimeout(() => {
          if (!pending.current) return;
          pending.current = null;
          reject(new Error("The server didn't confirm the save. Please try again."));
        }, REPLY_TIMEOUT_MS);

        const settle = (fn: () => void) => {
          pending.current = null;
          clearTimeout(timer);
          fn();
        };

        pending.current = {
          resolve: () =>
            settle(() => {
              // Seed the password and name BEFORE navigating, so the new table
              // authenticates without a second prompt and is already labelled
              // in the picker on arrival.
              stashRoomSecret(roomPassword, roomId);
              rememberRoom(roomId, name);
              resolve();
              navigate(roomId);
            }),
          reject: (error: Error) => settle(() => reject(error)),
        };

        sendMessage({
          t: "fork-table",
          roomId,
          name,
          roomPassword,
          ...(dmPassword ? { dmPassword } : {}),
        });
      }),
    [sendMessage, navigate],
  );
}
