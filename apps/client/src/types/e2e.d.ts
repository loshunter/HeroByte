import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";

type HeroByteE2EState = {
  snapshot?: RoomSnapshot | null;
  uid?: string;
  gridSize?: number;
  cam?: { x: number; y: number; scale: number };
  setCam?: (cam: { x: number; y: number; scale: number }) => void;
  viewport?: { width: number; height: number };
  sendMessage?: (message: ClientMessage) => void;
};

declare global {
  interface Window {
    __HERO_BYTE_E2E__?: HeroByteE2EState;
  }
}

export {};
