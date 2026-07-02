import type { RoomState } from "../model.js";

export interface RoomStore {
  get(roomId: string): RoomState | undefined;
  set(roomId: string, state: RoomState): void;
  /** Remove the room everywhere, including durable storage. */
  delete(roomId: string): void;
  /**
   * Drop the room from memory WITHOUT touching durable storage — used by
   * idle-room unload, where the room must be restorable later.
   */
  evict(roomId: string): void;
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

  // For the in-memory store, durable storage is the per-room state file that
  // StatePersistence owns — dropping the map entry loses nothing.
  evict(roomId: string): void {
    this.rooms.delete(roomId);
  }

  listRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }
}
