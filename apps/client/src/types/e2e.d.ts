import type { RoomSnapshot, ClientMessage } from "@shared";

type HeroByteE2EState = {
  snapshot?: RoomSnapshot | null;
  uid?: string;
  gridSize?: number;
  cam?: { x: number; y: number; scale: number };
  viewport?: { width: number; height: number };
  sendMessage?: (message: ClientMessage) => void;
};

declare global {
  interface Window {
    __HERO_BYTE_E2E__?: HeroByteE2EState;
  }
}

export {};
