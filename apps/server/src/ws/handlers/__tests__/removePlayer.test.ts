// remove-player: the DM clears an ABSENT player's seat — row, PCs, stray
// tokens, selections — and nothing else. Routed through the real
// MessageRouter so the DM gate, the connected-roster refusal and the
// turn-safe delete are all the production path, not the function alone.

import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageRouter } from "../../messageRouter.js";
import { RoomService } from "../../../domains/room/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { MapService } from "../../../domains/map/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { PropService } from "../../../domains/prop/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { AuthService } from "../../../domains/auth/service.js";
import { validateMessage } from "../../../middleware/validation.js";
import { HELD_SOCKET_TTL_MS, REMOVE_PLAYER_GRACE_MS, removePlayer } from "../removePlayer.js";
import type { WebSocketServer, WebSocket } from "ws";

// Scratch state file per test file: a bare RoomService writes the REAL
// apps/server/herobyte-state.json that the dev server reads.
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "removePlayer-state.json");

describe("remove-player", () => {
  let messageRouter: MessageRouter;
  let roomService: RoomService;
  let playerService: PlayerService;
  let tokenService: TokenService;
  let characterService: CharacterService;
  let selectionService: SelectionService;

  const dmUid = "dm-1";
  const liveUid = "live-1";
  const ghostUid = "ghost-1";
  let dmSocket: WebSocket;
  let liveSockets: Map<string, Map<WebSocket, number>>;
  /** Every remove-player-refused frame the DM's socket received. */
  const refusalsSent = () =>
    (dmSocket.send as unknown as { mock: { calls: [string][] } }).mock.calls
      .map(([raw]) => JSON.parse(raw) as { t: string; uid?: string; reason?: string })
      .filter((m) => m.t === "remove-player-refused");

  const state = () => roomService.getState();
  const pcsOf = (uid: string) =>
    state().characters.filter((c) => c.type === "pc" && c.ownedByPlayerUID === uid);
  const tokensOf = (uid: string) => state().tokens.filter((t) => t.owner === uid);
  const rowOf = (uid: string) => state().players.find((p) => p.uid === uid);

  /** A PC with a linked token, owned by uid. */
  const seat = (uid: string, name: string, initiative?: number) => {
    const s = state();
    const c = characterService.createCharacter(s, name, 50, "", "pc");
    c.ownedByPlayerUID = uid;
    if (initiative !== undefined) c.initiative = initiative;
    const token = tokenService.createToken(s, uid, 2, 2);
    characterService.linkToken(s, c.id, token.id);
    return c.id;
  };

  beforeEach(() => {
    roomService = new RoomService({ stateFile: TEST_STATE_FILE });
    playerService = new PlayerService();
    tokenService = new TokenService();
    characterService = new CharacterService();
    selectionService = new SelectionService();
    const mockUidToWs = new Map<string, WebSocket>();
    liveSockets = new Map();
    dmSocket = { readyState: 1, send: vi.fn() } as unknown as WebSocket;
    mockUidToWs.set(dmUid, dmSocket);

    roomService.setState({
      players: [
        { uid: dmUid, name: "DM", isDM: true, hp: 10, maxHp: 10, statusEffects: [] },
        { uid: liveUid, name: "Live", isDM: false, hp: 10, maxHp: 10, statusEffects: [] },
        {
          uid: ghostUid,
          name: "Ghost",
          isDM: false,
          hp: 10,
          maxHp: 10,
          statusEffects: [],
          lastHeartbeat: Date.now() - 10 * 60 * 1000, // gone ten minutes
        },
      ],
      characters: [],
    });
    // The connected roster: the ghost is not in it.
    state().users = [dmUid, liveUid];

    messageRouter = new MessageRouter(
      roomService,
      playerService,
      tokenService,
      new MapService(),
      new DiceService(),
      characterService,
      new PropService(),
      selectionService,
      new AuthService(),
      {} as WebSocketServer,
      mockUidToWs,
      vi.fn(() => new Set<WebSocket>()),
      undefined,
      undefined,
      liveSockets,
    );
  });

  it("the DM clears an absent player's seat: row, PCs, their tokens, a stray token, their selection — and nobody else's", () => {
    seat(ghostUid, "Ghost A");
    seat(ghostUid, "Ghost B");
    const stray = tokenService.createToken(state(), ghostUid, 9, 9); // no character behind it
    const liveChar = seat(liveUid, "Live PC");
    selectionService.selectObject(state(), ghostUid, stray.id);
    const save = vi.spyOn(roomService, "saveState");

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(rowOf(ghostUid)).toBeUndefined();
    expect(pcsOf(ghostUid)).toHaveLength(0);
    expect(tokensOf(ghostUid)).toHaveLength(0);
    expect(state().selectionState.get(ghostUid)).toBeUndefined();
    // The others are exactly as they were.
    expect(rowOf(liveUid)).toBeDefined();
    expect(rowOf(dmUid)).toBeDefined();
    expect(pcsOf(liveUid).map((c) => c.id)).toEqual([liveChar]);
    expect(tokensOf(liveUid)).toHaveLength(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("an OPEN socket with no authenticated seat — the password form, or the reconnect window after a restart — counts as connected", () => {
    seat(ghostUid, "Ghost A");
    liveSockets.set(
      ghostUid,
      new Map([[{ readyState: 1, send: vi.fn() } as unknown as WebSocket, Date.now()]]),
    );
    const save = vi.spyOn(roomService, "saveState");

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(rowOf(ghostUid)).toBeDefined();
    expect(pcsOf(ghostUid)).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    expect(refusalsSent()).toEqual([
      { t: "remove-player-refused", uid: ghostUid, reason: "connected" },
    ]);
  });

  it("a HELD second socket — a tab on the password form that outlived the registered tab — is a live one too", () => {
    seat(ghostUid, "Ghost A");
    // Nothing registered for the ghost (the first tab closed and was cleaned
    // up), but a held newcomer is still open.
    liveSockets.set(
      ghostUid,
      new Map([[{ readyState: 1, send: vi.fn() } as unknown as WebSocket, Date.now()]]),
    );

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(rowOf(ghostUid)).toBeDefined();
    expect(refusalsSent()).toEqual([
      { t: "remove-player-refused", uid: ghostUid, reason: "connected" },
    ]);
  });

  it("a held socket that has CLOSED does not hold the seat", () => {
    seat(ghostUid, "Ghost A");
    liveSockets.set(
      ghostUid,
      new Map([[{ readyState: 3, send: vi.fn() } as unknown as WebSocket, Date.now()]]),
    );
    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);
    expect(rowOf(ghostUid)).toBeUndefined();
  });

  it("a socket parked on the password form longer than the heartbeat window no longer holds the seat — a zombie cannot pin it forever", () => {
    seat(ghostUid, "Ghost A");
    liveSockets.set(
      ghostUid,
      new Map([
        [
          { readyState: 1, send: vi.fn() } as unknown as WebSocket,
          Date.now() - HELD_SOCKET_TTL_MS - 1,
        ],
      ]),
    );
    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);
    expect(rowOf(ghostUid)).toBeUndefined();
    expect(refusalsSent()).toEqual([]);
  });

  it("a CLOSED socket left in the map is not a live one", () => {
    seat(ghostUid, "Ghost A");
    liveSockets.set(
      ghostUid,
      new Map([[{ readyState: 3, send: vi.fn() } as unknown as WebSocket, Date.now()]]),
    );
    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);
    expect(rowOf(ghostUid)).toBeUndefined();
  });

  it("an NPC the absent uid had CLAIMED stays, unclaimed — a dangling claim would seat the returning uid with nothing", () => {
    const s = state();
    const troll = characterService.createCharacter(s, "Troll", 80, "", "npc");
    characterService.claimCharacter(s, troll.id, ghostUid);
    expect(s.characters.find((c) => c.id === troll.id)?.ownedByPlayerUID).toBe(ghostUid);

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    const after = state().characters.find((c) => c.id === troll.id);
    expect(after).toBeDefined();
    expect(after?.ownedByPlayerUID ?? undefined).toBeUndefined();
    expect(rowOf(ghostUid)).toBeUndefined();
  });

  it("a claimed NPC's token — even one the absent uid OWNS — stays with the NPC and passes to the DM who cleared the seat", () => {
    const s = state();
    const troll = characterService.createCharacter(s, "Troll", 80, "", "npc");
    characterService.claimCharacter(s, troll.id, ghostUid);
    const trollToken = tokenService.createToken(s, ghostUid, 4, 4);
    characterService.linkToken(s, troll.id, trollToken.id);
    seat(ghostUid, "Ghost A");

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    const piece = state().tokens.find((t) => t.id === trollToken.id);
    expect(piece).toBeDefined();
    expect(piece?.owner).toBe(dmUid); // not a uid that may return and move it
    expect(state().characters.find((c) => c.id === troll.id)?.tokenId).toBe(trollToken.id);
    expect(pcsOf(ghostUid)).toHaveLength(0);
    expect(rowOf(ghostUid)).toBeUndefined();
  });

  it("two of the seat's PCs in the order, the first acting: the turn lands on the survivor behind them, the round holds", () => {
    seat(ghostUid, "Ghost A", 20);
    seat(ghostUid, "Ghost B", 15);
    const livePc = seat(liveUid, "Live PC", 10);
    const s = state();
    s.combatActive = true;
    s.combatRound = 2;
    s.currentTurnCharacterId = pcsOf(ghostUid)[0]!.id;

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(state().currentTurnCharacterId).toBe(livePc);
    expect(state().combatRound).toBe(2);
  });

  it("the seat's acting PC is LAST in the order: the turn wraps to the top and the round steps exactly once", () => {
    const livePc = seat(liveUid, "Live PC", 20);
    const ghostPc = seat(ghostUid, "Ghost A", 10);
    const s = state();
    s.combatActive = true;
    s.combatRound = 2;
    s.currentTurnCharacterId = ghostPc;

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(state().currentTurnCharacterId).toBe(livePc);
    expect(state().combatRound).toBe(3);
  });

  it("a seat dropped in the last minute waits: the heartbeat grace refuses it, and the DM is told", () => {
    seat(ghostUid, "Ghost A");
    rowOf(ghostUid)!.lastHeartbeat = Date.now() - REMOVE_PLAYER_GRACE_MS / 2; // a blip ago
    const save = vi.spyOn(roomService, "saveState");

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(rowOf(ghostUid)).toBeDefined();
    expect(pcsOf(ghostUid)).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
    expect(refusalsSent()).toEqual([
      { t: "remove-player-refused", uid: ghostUid, reason: "recent" },
    ]);
  });

  it("a minute after the last heartbeat the seat goes — the grace is a window, not a lock", () => {
    seat(ghostUid, "Ghost A");
    rowOf(ghostUid)!.lastHeartbeat = Date.now() - REMOVE_PLAYER_GRACE_MS - 1;
    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);
    expect(rowOf(ghostUid)).toBeUndefined();
    expect(refusalsSent()).toEqual([]);
  });

  it("the connected refusal reaches the DM as a frame, not silence", () => {
    seat(liveUid, "Live PC");
    messageRouter.route({ t: "remove-player", uid: liveUid }, dmUid);
    expect(refusalsSent()).toEqual([
      { t: "remove-player-refused", uid: liveUid, reason: "connected" },
    ]);
  });

  it("a uid whose only residue is a selection entry: that entry goes, and it is broadcast (nothing mutates before the emptiness test)", () => {
    const s = state();
    const someToken = tokenService.createToken(s, liveUid, 1, 1);
    selectionService.selectObject(s, "gone-uid", someToken.id);
    expect(s.selectionState.has("gone-uid")).toBe(true);
    const result = removePlayer(
      {
        playerService,
        characterService,
        tokenService,
        selectionService,
        hasLiveSocket: () => false,
      },
      s,
      "gone-uid",
      dmUid,
    );
    expect(result).toEqual({ broadcast: true, save: true });
    expect(s.selectionState.has("gone-uid")).toBe(false);
  });

  it("a player cannot — not even to remove an absent one", () => {
    seat(ghostUid, "Ghost A");
    const save = vi.spyOn(roomService, "saveState");
    messageRouter.route({ t: "remove-player", uid: ghostUid }, liveUid);
    expect(rowOf(ghostUid)).toBeDefined();
    expect(pcsOf(ghostUid)).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("a CONNECTED player is refused: the seat belongs to whoever is sitting in it", () => {
    seat(liveUid, "Live PC");
    const save = vi.spyOn(roomService, "saveState");
    messageRouter.route({ t: "remove-player", uid: liveUid }, dmUid);
    expect(rowOf(liveUid)).toBeDefined();
    expect(pcsOf(liveUid)).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("the DM's own seat is refused as SELF — before the connected gate, which would also catch it", () => {
    state().users = [liveUid]; // even with the DM gone from the roster
    const save = vi.spyOn(roomService, "saveState");
    messageRouter.route({ t: "remove-player", uid: dmUid }, dmUid);
    expect(rowOf(dmUid)).toBeDefined();
    expect(save).not.toHaveBeenCalled();
    expect(refusalsSent()).toEqual([{ t: "remove-player-refused", uid: dmUid, reason: "self" }]);
  });

  it("a uid with nothing at the table is a no-op: no broadcast, no save — and the DM hears why", () => {
    const save = vi.spyOn(roomService, "saveState");
    messageRouter.route({ t: "remove-player", uid: "never-here" }, dmUid);
    expect(save).not.toHaveBeenCalled();
    expect(refusalsSent()).toEqual([
      { t: "remove-player-refused", uid: "never-here", reason: "nothing" },
    ]);
  });

  it("a non-DM's attempt is refused SILENTLY: no frame back, so the nack is not an oracle", () => {
    seat(ghostUid, "Ghost A");
    const liveSocket = { readyState: 1, send: vi.fn() } as unknown as WebSocket;
    (messageRouter as unknown as { uidToWs: Map<string, WebSocket> }).uidToWs?.set(
      liveUid,
      liveSocket,
    );
    messageRouter.route({ t: "remove-player", uid: ghostUid }, liveUid);
    expect(rowOf(ghostUid)).toBeDefined();
    expect((liveSocket.send as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(
      0,
    );
  });

  it("a token the absent uid owns that an NPC stands on is the NPC's, and stays", () => {
    // A former DM placed a troll and left; the troll keeps its token.
    const s = state();
    const troll = characterService.createCharacter(s, "Troll", 80, "", "npc");
    const trollToken = tokenService.createToken(s, ghostUid, 4, 4);
    characterService.linkToken(s, troll.id, trollToken.id);
    seat(ghostUid, "Ghost A");

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(rowOf(ghostUid)).toBeUndefined();
    expect(pcsOf(ghostUid)).toHaveLength(0);
    expect(state().characters.find((c) => c.id === troll.id)?.tokenId).toBe(trollToken.id);
    // The piece stays with the troll AND its move authority passes to the DM
    // who cleared the seat: a returning uid does not drive the monsters it placed.
    expect(state().tokens.find((t) => t.id === trollToken.id)?.owner).toBe(dmUid);
  });

  it("removing the seat of the ACTING combatant passes the turn to the next in order instead of skipping a round", () => {
    const ghostPc = seat(ghostUid, "Ghost A", 20);
    const livePc = seat(liveUid, "Live PC", 10);
    const s = state();
    s.combatActive = true;
    s.combatRound = 2;
    s.currentTurnCharacterId = ghostPc;

    messageRouter.route({ t: "remove-player", uid: ghostUid }, dmUid);

    expect(state().currentTurnCharacterId).toBe(livePc);
    expect(state().combatRound).toBe(2);
  });

  it("the validator wants a uid: empty, missing, oversized or non-string is refused before routing", () => {
    expect(validateMessage({ t: "remove-player", uid: "ghost-1" }).valid).toBe(true);
    expect(validateMessage({ t: "remove-player", uid: "" }).valid).toBe(false);
    expect(validateMessage({ t: "remove-player" }).valid).toBe(false);
    expect(validateMessage({ t: "remove-player", uid: 42 }).valid).toBe(false);
    expect(validateMessage({ t: "remove-player", uid: "x".repeat(129) }).valid).toBe(false);
    // The uid alphabet is the connect handshake's (ConnectionLifecycleManager).
    expect(validateMessage({ t: "remove-player", uid: "bad uid!" }).valid).toBe(false);
    expect(validateMessage({ t: "remove-player", uid: "ok_uid-1" }).valid).toBe(true);
  });
});
