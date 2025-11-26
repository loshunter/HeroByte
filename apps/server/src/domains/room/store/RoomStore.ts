import type { RoomState } from "../model.js";

export interface RoomStore {
  get(roomId: string): RoomState | undefined;
  set(roomId: string, state: RoomState): void;
  delete(roomId: string): void;
  listRoomIds(): string[];
}

export class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, RoomState>();

  get(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  set(roomId: string, state: RoomState): void {
    this.rooms.set(roomId, state);
  }

  delete(roomId: string): void {
    this.rooms.delete(roomId);
  }

  listRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}
