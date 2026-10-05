/**
 * A locked token, prop or drawing cannot be moved or deleted by ANYONE, the DM
 * included, until the DM unlocks it (owner, 2026-10-04). Single actions are refused
 * and the sender is told (`locked-refused`); bulk actions skip the locked pieces and
 * say so (`kept`). Driven through the real router and real services, every road.
 */

import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, Drawing } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { AuthService } from "../../domains/auth/service.js";

const STATE_FILE = path.join(process.cwd(), ".tmp", "pieceLock-state.json");
const DM = "dm-1";
const PLAYER = "player-1";
const GHOST = "ghost-1";

type Frame = { t: string; ids?: string[]; kept?: boolean };

describe("the piece lock — no move, no delete, for anyone, until unlocked", () => {
  let router: MessageRouter;
  let room: RoomService;
  let tokens: TokenService;
  let characters: CharacterService;
  let props: PropService;
  const sockets = new Map<string, WebSocket>();

  const state = () => room.getState();
  const framesTo = (uid: string): Frame[] =>
    (sockets.get(uid)!.send as unknown as { mock: { calls: [string][] } }).mock.calls.map(
      ([raw]) => JSON.parse(raw) as Frame,
    );
  const refusalsTo = (uid: string) => framesTo(uid).filter((f) => f.t === "locked-refused");
  const send = (message: ClientMessage, uid: string) => router.route(message, uid);
  /** Rebuild the scene graph (as every broadcast does) and lock these pieces as the DM. */
  const lock = (...sceneIds: string[]) => {
    room.createSnapshot();
    expect(room.lockSelectedObjects(DM, sceneIds)).toBe(sceneIds.length);
  };
  const line = (id: string, owner: string): Drawing => ({
    id,
    owner,
    type: "freehand",
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ],
    color: "#f00",
    width: 2,
    opacity: 1,
  });

  beforeEach(() => {
    room = new RoomService({ stateFile: STATE_FILE });
    tokens = new TokenService();
    characters = new CharacterService();
    props = new PropService();
    sockets.clear();
    for (const uid of [DM, PLAYER]) {
      sockets.set(uid, { readyState: 1, send: vi.fn() } as unknown as WebSocket);
    }
    room.setState({
      players: [
        { uid: DM, name: "DM", isDM: true, hp: 10, maxHp: 10, statusEffects: [] },
        { uid: PLAYER, name: "P", isDM: false, hp: 10, maxHp: 10, statusEffects: [] },
        {
          uid: GHOST,
          name: "Ghost",
          isDM: false,
          hp: 10,
          maxHp: 10,
          statusEffects: [],
          lastHeartbeat: Date.now() - 10 * 60 * 1000,
        },
      ],
    });
    state().users = [DM, PLAYER];
    router = new MessageRouter(
      room,
      new PlayerService(),
      tokens,
      new MapService(),
      new DiceService(),
      characters,
      props,
      new SelectionService(),
      new AuthService(),
      {} as WebSocketServer,
      sockets,
      vi.fn(() => new Set<WebSocket>()),
      undefined,
      undefined,
      new Map(),
    );
  });

  describe("moves", () => {
    it("a drag (transform) of a locked token is refused for the DM and the owner alike", () => {
      const token = tokens.createToken(state(), PLAYER, 1, 1);
      lock(`token:${token.id}`);
      for (const uid of [DM, PLAYER]) {
        send({ t: "transform-object", id: `token:${token.id}`, position: { x: 5, y: 5 } }, uid);
        expect(refusalsTo(uid).at(-1)).toEqual({ t: "locked-refused", ids: [`token:${token.id}`] });
      }
      expect(state().tokens[0]).toMatchObject({ x: 1, y: 1 });
    });

    it("the lock toggle itself still rides transform-object, so the DM can unlock", () => {
      const token = tokens.createToken(state(), DM, 1, 1);
      lock(`token:${token.id}`);
      send({ t: "transform-object", id: `token:${token.id}`, locked: false }, DM);
      send({ t: "transform-object", id: `token:${token.id}`, position: { x: 4, y: 4 } }, DM);
      expect(state().tokens[0]).toMatchObject({ x: 4, y: 4 });
      expect(refusalsTo(DM)).toHaveLength(0);
    });

    it("a step (keys / d-pad) refuses the locked piece and moves the rest", () => {
      const locked = tokens.createToken(state(), DM, 1, 1);
      const free = tokens.createToken(state(), DM, 3, 3);
      lock(`token:${locked.id}`);
      send({ t: "step-object", ids: [`token:${locked.id}`, `token:${free.id}`], dx: 1, dy: 0 }, DM);
      expect(state().tokens.find((t) => t.id === locked.id)).toMatchObject({ x: 1, y: 1 });
      expect(state().tokens.find((t) => t.id === free.id)).toMatchObject({ x: 4, y: 3 });
      expect(refusalsTo(DM).at(-1)?.ids).toEqual([`token:${locked.id}`]);
    });

    it("the legacy move frame, a resize and a drag preview are refused for a locked token", () => {
      const token = tokens.createToken(state(), PLAYER, 1, 1);
      lock(`token:${token.id}`);
      send({ t: "move", id: token.id, x: 6, y: 6 }, DM);
      send({ t: "set-token-size", tokenId: token.id, size: "huge" }, DM);
      send({ t: "set-token-size", tokenId: token.id, size: "huge" }, PLAYER);
      expect(state().tokens[0]).toMatchObject({ x: 1, y: 1, size: "medium" });
      expect(refusalsTo(DM)).toHaveLength(2);
      expect(refusalsTo(PLAYER)).toHaveLength(1);
    });

    it("a locked prop and a locked drawing are refused a drag too, for the DM", () => {
      const prop = props.createProp(
        state(),
        "Crate",
        "",
        DM,
        "medium",
        { x: 0, y: 0, scale: 1 },
        50,
      );
      state().drawings.push(line("d-1", DM));
      const start = { x: prop.x, y: prop.y };
      lock(`prop:${prop.id}`, "drawing:d-1");
      send({ t: "transform-object", id: `prop:${prop.id}`, position: { x: 9, y: 9 } }, DM);
      send({ t: "transform-object", id: "drawing:d-1", position: { x: 9, y: 9 } }, DM);
      expect(refusalsTo(DM).map((f) => f.ids)).toEqual([[`prop:${prop.id}`], ["drawing:d-1"]]);
      expect(state().props[0]).toMatchObject(start);
    });

    it("move-drawing: refused while locked, and never for someone else's drawing", () => {
      state().drawings.push(line("mine", PLAYER), line("theirs", DM));
      send({ t: "select-drawing", id: "theirs" }, PLAYER);
      send({ t: "move-drawing", id: "theirs", dx: 10, dy: 10 }, PLAYER);
      expect(state().drawings.find((d) => d.id === "theirs")!.points[0]).toEqual({ x: 0, y: 0 });

      lock("drawing:mine");
      send({ t: "select-drawing", id: "mine" }, PLAYER);
      send({ t: "move-drawing", id: "mine", dx: 10, dy: 10 }, PLAYER);
      expect(state().drawings.find((d) => d.id === "mine")!.points[0]).toEqual({ x: 0, y: 0 });
      expect(refusalsTo(PLAYER).at(-1)?.ids).toEqual(["drawing:mine"]);
    });
  });

  describe("single deletes are refused, with the reason", () => {
    it("Delete Token, for the DM", () => {
      const token = tokens.createToken(state(), PLAYER, 1, 1);
      lock(`token:${token.id}`);
      send({ t: "delete-token", id: token.id }, DM);
      expect(state().tokens).toHaveLength(1);
      expect(refusalsTo(DM).at(-1)?.ids).toEqual([`token:${token.id}`]);
    });

    it("deleting a character or an NPC whose token is locked, and placing the NPC's token again", () => {
      const pc = characters.createCharacter(state(), "Aria", 10, "", "pc");
      pc.ownedByPlayerUID = PLAYER;
      const pcToken = tokens.createToken(state(), PLAYER, 1, 1);
      characters.linkToken(state(), pc.id, pcToken.id);
      const npc = characters.createCharacter(state(), "Goblin", 7, "", "npc");
      const npcToken = tokens.createToken(state(), DM, 2, 2);
      characters.linkToken(state(), npc.id, npcToken.id);
      lock(`token:${pcToken.id}`, `token:${npcToken.id}`);

      send({ t: "delete-player-character", characterId: pc.id }, PLAYER);
      send({ t: "delete-player-character", characterId: pc.id }, DM);
      send({ t: "delete-npc", id: npc.id }, DM);
      send({ t: "place-npc-token", id: npc.id }, DM);

      expect(
        state()
          .characters.map((c) => c.id)
          .sort(),
      ).toEqual([npc.id, pc.id].sort());
      expect(
        state()
          .tokens.map((t) => t.id)
          .sort(),
      ).toEqual([npcToken.id, pcToken.id].sort());
      expect(refusalsTo(PLAYER)).toHaveLength(1);
      expect(refusalsTo(DM)).toHaveLength(3);
    });

    it("the eraser (delete-drawing and erase-partial) and a prop's Delete", () => {
      state().drawings.push(line("d-1", PLAYER));
      const prop = props.createProp(
        state(),
        "Crate",
        "",
        DM,
        "medium",
        { x: 0, y: 0, scale: 1 },
        50,
      );
      lock("drawing:d-1", `prop:${prop.id}`);
      send({ t: "delete-drawing", id: "d-1" }, PLAYER);
      send({ t: "erase-partial", deleteId: "d-1", segments: [] }, PLAYER);
      send({ t: "delete-prop", id: prop.id }, DM);
      expect(state().drawings.map((d) => d.id)).toEqual(["d-1"]);
      expect(state().props).toHaveLength(1);
      expect(refusalsTo(PLAYER)).toHaveLength(2);
      expect(refusalsTo(DM).at(-1)?.ids).toEqual([`prop:${prop.id}`]);
    });

    it("undo that would remove a locked drawing is refused, not skipped to an older step", () => {
      send({ t: "draw", drawing: line("first", PLAYER) }, PLAYER);
      send({ t: "draw", drawing: line("second", PLAYER) }, PLAYER);
      lock("drawing:second");
      send({ t: "undo-drawing" }, PLAYER);
      expect(
        state()
          .drawings.map((d) => d.id)
          .sort(),
      ).toEqual(["first", "second"]);
      expect(refusalsTo(PLAYER).at(-1)?.ids).toEqual(["drawing:second"]);
    });

    it("redo that would remove a locked drawing (a partial erase's original) is refused", () => {
      send({ t: "draw", drawing: line("d-1", PLAYER) }, PLAYER);
      send(
        {
          t: "erase-partial",
          deleteId: "d-1",
          segments: [
            {
              points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
              ],
            },
          ],
        } as ClientMessage,
        PLAYER,
      );
      send({ t: "undo-drawing" }, PLAYER); // the original comes back, the pieces go
      expect(state().drawings.map((d) => d.id)).toEqual(["d-1"]);
      lock("drawing:d-1");
      send({ t: "redo-drawing" }, PLAYER); // would remove the original again
      expect(state().drawings.map((d) => d.id)).toEqual(["d-1"]);
      expect(refusalsTo(PLAYER).at(-1)?.ids).toEqual(["drawing:d-1"]);
    });
  });

  describe("bulk deletes go ahead, keep the locked pieces, and say so", () => {
    it("Clear all drawings", () => {
      state().drawings.push(line("keep", DM), line("go", DM));
      lock("drawing:keep");
      send({ t: "clear-drawings" }, DM);
      expect(state().drawings.map((d) => d.id)).toEqual(["keep"]);
      expect(refusalsTo(DM).at(-1)).toEqual({
        t: "locked-refused",
        ids: ["drawing:keep"],
        kept: true,
      });
    });

    it("REMOVE an absent seat: the seat and its characters go, its locked tokens stay (now the DM's)", () => {
      const pc = characters.createCharacter(state(), "Ghost PC", 10, "", "pc");
      pc.ownedByPlayerUID = GHOST;
      const pcToken = tokens.createToken(state(), GHOST, 1, 1);
      characters.linkToken(state(), pc.id, pcToken.id);
      const strayLocked = tokens.createToken(state(), GHOST, 5, 5);
      const strayFree = tokens.createToken(state(), GHOST, 6, 6);
      lock(`token:${pcToken.id}`, `token:${strayLocked.id}`);

      send({ t: "remove-player", uid: GHOST }, DM);

      expect(state().players.some((p) => p.uid === GHOST)).toBe(false);
      expect(state().characters.some((c) => c.id === pc.id)).toBe(false);
      const left = state().tokens.map((t) => ({ id: t.id, owner: t.owner }));
      expect(left).toEqual(
        expect.arrayContaining([
          { id: pcToken.id, owner: DM },
          { id: strayLocked.id, owner: DM },
        ]),
      );
      expect(left.some((t) => t.id === strayFree.id)).toBe(false);
      const refusal = refusalsTo(DM).at(-1);
      expect(refusal?.kept).toBe(true);
      expect(refusal?.ids?.sort()).toEqual(
        [`token:${pcToken.id}`, `token:${strayLocked.id}`].sort(),
      );
    });

    it("a character file's drawings (sync-player-drawings) keep the player's locked ones", () => {
      state().drawings.push(line("locked", PLAYER), line("free", PLAYER));
      lock("drawing:locked");
      send({ t: "sync-player-drawings", drawings: [line("imported", PLAYER)] }, PLAYER);
      expect(
        state()
          .drawings.map((d) => d.id)
          .sort(),
      ).toEqual(["imported", "locked"]);
      expect(refusalsTo(PLAYER).at(-1)).toMatchObject({ ids: ["drawing:locked"], kept: true });
    });
  });

  it("unlocked pieces are untouched by the rule", () => {
    const token = tokens.createToken(state(), PLAYER, 1, 1);
    state().drawings.push(line("d-1", PLAYER));
    room.createSnapshot();
    send({ t: "transform-object", id: `token:${token.id}`, position: { x: 2, y: 2 } }, PLAYER);
    send({ t: "delete-drawing", id: "d-1" }, PLAYER);
    expect(state().tokens[0]).toMatchObject({ x: 2, y: 2 });
    expect(state().drawings).toHaveLength(0);
    expect(refusalsTo(PLAYER)).toHaveLength(0);
  });
});
