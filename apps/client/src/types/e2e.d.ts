import type { RoomSnapshot, ClientMessage, MeasureEvent } from "@herobyte/shared";

type HeroByteE2EState = {
  snapshot?: RoomSnapshot | null;
  uid?: string;
  gridSize?: number;
  cam?: { x: number; y: number; scale: number };
  setCam?: (cam: { x: number; y: number; scale: number }) => void;
  viewport?: { width: number; height: number };
  sendMessage?: (message: ClientMessage) => void;
  /**
   * Other players' live measurements (S6). Exposed because they are relayed
   * on their own channel and never land in a snapshot — without this there is
   * no way to assert one arrived short of reading canvas pixels.
   */
  remoteMeasurements?: MeasureEvent[];
};

declare global {
  interface Window {
    __HERO_BYTE_E2E__?: HeroByteE2EState;
  }
}

export {};
