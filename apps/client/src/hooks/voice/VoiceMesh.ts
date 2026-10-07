// ============================================================================
// VOICE MESH
// ============================================================================
// Who this browser holds a voice connection with, and how each one is made.
// No React: the hook feeds it the roster (the players the server says are in
// the call) and the signals that arrive, and it reports streams and link states.
//
// The rule that keeps two people from failing to hear each other: of every pair,
// ONLY the player with the lower uid places the call. When both sides called at
// once (the old hook did, on enabling the mic), each received an offer while
// holding its own, then an answer while `stable`, and simple-peer destroyed both
// peers for good (reproduced with simple-peer 9.11.1 in Chromium, 2026-10-06).
// Late joining needs no extra step: the roster is what tells the caller that
// someone new is in the call, whichever of the two joined first.
//
// A connection that drops, errors or never connects is forgotten and, while both
// are still in the call, called again by the same lower side after a pause.
//
// One gap the roster cannot see: a player whose tab died and came straight back
// (a reload the server never saw close) is still listed, so a caller holding a
// connection to the dead tab would not call the new one until that connection
// times out. A joining player therefore says hello to everyone who calls IT; a
// caller that receives a hello calls again, whatever it thinks it holds.

import type { Instance as Peer, SignalData } from "simple-peer";

export type VoiceLink = "connecting" | "connected" | "failing";

/** Not a WebRTC signal: "I am (back) in the call, call me". Never reaches simple-peer. */
const HELLO = { type: "hello" } as unknown as SignalData;
const isHello = (signal: SignalData) => (signal as { type?: string }).type === "hello";
/** A call younger than this is still on its way: a hello does not replace it. */
const HELLO_FRESH_MS = 2000;

export interface VoiceMeshOptions {
  selfUid: string;
  /** Builds a simple-peer instance; injected so tests need no WebRTC. */
  createPeer: (initiator: boolean, stream: MediaStream) => Peer;
  sendSignal: (target: string, signal: SignalData) => void;
  onStream: (uid: string, stream: MediaStream) => void;
  onStreamGone: (uid: string) => void;
  onLinksChange: (links: Record<string, VoiceLink>) => void;
  /** Pause before calling again after a lost connection. */
  retryMs?: number;
  /** A connection not up by now is abandoned (and, by the caller, retried). */
  connectTimeoutMs?: number;
  /** Someone still not connected after this long shows as "failing". */
  failingAfterMs?: number;
  /**
   * How long someone may be missing from the roster before the connection to
   * them is dropped (0: at once). Longer than a socket reconnect (the server
   * forgets a player's presence when their socket drops, and the first retry
   * waits two seconds), so a blip whose audio link survived costs nothing; and
   * a client flicking in and out of the call on purpose costs nobody a
   * connection torn down and rebuilt each time. Someone who really left hangs
   * up their own end at once, so their audio stops regardless.
   */
  leaveGraceMs?: number;
  now?: () => number;
}

interface PeerEntry {
  peer: Peer;
  connected: boolean;
  openedAt: number;
  timeout: ReturnType<typeof setTimeout>;
}

export class VoiceMesh {
  private stream: MediaStream | null = null;
  private roster = new Set<string>();
  /** When each roster member was first seen in the call (for "failing"). */
  private seenAt = new Map<string, number>();
  private peers = new Map<string, PeerEntry>();
  private retries = new Map<string, ReturnType<typeof setTimeout>>();
  private leaving = new Map<string, ReturnType<typeof setTimeout>>();
  private failingTimer: ReturnType<typeof setInterval> | null = null;
  private lastLinks = "";
  private readonly retryMs: number;
  private readonly connectTimeoutMs: number;
  private readonly failingAfterMs: number;
  private readonly leaveGraceMs: number;
  private readonly now: () => number;

  constructor(private readonly options: VoiceMeshOptions) {
    this.retryMs = options.retryMs ?? 1000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 15000;
    this.failingAfterMs = options.failingAfterMs ?? 10000;
    this.leaveGraceMs = options.leaveGraceMs ?? 5000;
    this.now = options.now ?? Date.now;
  }

  /** Join: from now on this browser takes part with this (local) stream. */
  start(stream: MediaStream): void {
    this.stream = stream;
    this.failingTimer = setInterval(() => this.publishLinks(), 1000);
    this.reconcile();
  }

  /** Leave: every connection closes and nothing is called again. */
  stop(): void {
    this.stream = null;
    if (this.failingTimer) clearInterval(this.failingTimer);
    this.failingTimer = null;
    this.retries.forEach((timer) => clearTimeout(timer));
    this.retries.clear();
    this.leaving.forEach((timer) => clearTimeout(timer));
    this.leaving.clear();
    [...this.peers.keys()].forEach((uid) => this.drop(uid));
    this.seenAt.clear();
    this.publishLinks();
  }

  /** The other players in the call (never this one), from the latest snapshot. */
  setRoster(uids: readonly string[]): void {
    const next = new Set(uids.filter((uid) => uid !== this.options.selfUid));
    const at = this.now();
    next.forEach((uid) => {
      if (!this.seenAt.has(uid)) this.seenAt.set(uid, at);
    });
    this.roster = next;
    [...this.seenAt.keys()].forEach((uid) => {
      if (!next.has(uid)) this.seenAt.delete(uid);
    });
    this.reconcile();
  }

  /**
   * Tell everyone who calls THIS player (the lower uids in the call) to call now.
   * Sent once the roster is known on joining, and again after a reconnect.
   */
  announce(): void {
    if (!this.stream) return;
    this.roster.forEach((uid) => {
      if (!this.isCaller(uid)) this.options.sendSignal(uid, HELLO);
    });
  }

  /**
   * Back after a reconnect: calls still being made were made while offline
   * (their signals were dropped), so they start over now instead of waiting
   * out their connect timeout. Connections that are up are kept.
   */
  resync(): void {
    if (!this.stream) return;
    this.retries.forEach((timer) => clearTimeout(timer));
    this.retries.clear();
    [...this.peers.entries()].forEach(([uid, entry]) => {
      if (!entry.connected) this.drop(uid);
    });
    this.reconcile();
  }

  /** A signal relayed by the server from another player. */
  handleSignal(from: string, signal: SignalData): void {
    if (!this.stream) return;
    if (isHello(signal)) {
      // simple-peer destroys itself on data it does not know: never pass a hello on.
      // A call placed in the last two seconds is left to finish (joining
      // together, the roster and the hello both ask for one). Anything else is
      // replaced: a connection that is up may be to a tab that died, and an older
      // half-made call was made to a tab that has since come back.
      const existing = this.peers.get(from);
      const fresh =
        existing && !existing.connected && this.now() - existing.openedAt < HELLO_FRESH_MS;
      if (this.isCaller(from) && !fresh) this.open(from, true);
      return;
    }
    // An offer always starts a fresh answering connection. Normally only a
    // higher uid receives one, but a client from before this rule (mid-deploy)
    // may still call anyone: answering it is what lets the pair connect.
    if (signal.type === "offer") this.open(from, false);
    this.peers.get(from)?.peer.signal(signal);
  }

  private reconcile(): void {
    // Someone who left the call: hang up. An answering connection opened for
    // a caller the roster does not list YET is kept — the offer can outrun the
    // snapshot that announces them — until the connect timeout settles it.
    this.peers.forEach((entry, uid) => {
      if (this.roster.has(uid)) {
        const pending = this.leaving.get(uid);
        if (pending) clearTimeout(pending);
        this.leaving.delete(uid);
        return;
      }
      if (!this.isCaller(uid) && !entry.connected) return;
      if (this.leaveGraceMs <= 0) {
        this.drop(uid);
        return;
      }
      if (this.leaving.has(uid)) return;
      this.leaving.set(
        uid,
        setTimeout(() => {
          this.leaving.delete(uid);
          if (!this.roster.has(uid)) this.drop(uid);
          this.publishLinks();
        }, this.leaveGraceMs),
      );
    });
    if (this.stream) {
      this.roster.forEach((uid) => {
        if (this.isCaller(uid) && !this.peers.has(uid) && !this.retries.has(uid)) {
          this.open(uid, true);
        }
      });
    }
    this.publishLinks();
  }

  private isCaller(uid: string): boolean {
    return this.options.selfUid < uid;
  }

  private open(uid: string, initiator: boolean): void {
    if (!this.stream) return;
    this.drop(uid);
    let peer: Peer;
    try {
      peer = this.options.createPeer(initiator, this.stream);
    } catch (error) {
      // No WebRTC in this browser (simple-peer throws ERR_WEBRTC_SUPPORT): the
      // person shows as failing; calling again would only throw again.
      console.error("Voice connection could not be created:", error);
      this.publishLinks();
      return;
    }
    const entry: PeerEntry = {
      peer,
      connected: false,
      openedAt: this.now(),
      timeout: setTimeout(() => {
        if (this.peers.get(uid) === entry && !entry.connected) this.lost(uid, entry);
      }, this.connectTimeoutMs),
    };
    this.peers.set(uid, entry);
    // Events from a connection that has since been replaced are ignored.
    const current = () => this.peers.get(uid) === entry;
    peer.on("signal", (signal: SignalData) => {
      if (current()) this.options.sendSignal(uid, signal);
    });
    peer.on("stream", (stream: MediaStream) => {
      if (current()) this.options.onStream(uid, stream);
    });
    peer.on("connect", () => {
      if (!current()) return;
      entry.connected = true;
      clearTimeout(entry.timeout);
      this.publishLinks();
    });
    peer.on("error", () => {
      if (current()) this.lost(uid, entry);
    });
    peer.on("close", () => {
      if (current()) this.lost(uid, entry);
    });
    this.publishLinks();
  }

  private lost(uid: string, entry: PeerEntry): void {
    if (this.peers.get(uid) !== entry) return;
    this.drop(uid);
    // A drop of a WORKING link restarts the clock, so one that heals within
    // seconds never reads as failing. A link that never connected keeps its
    // clock: retrying it must not hide "Can't reach" every few seconds.
    if (entry.connected && this.roster.has(uid)) this.seenAt.set(uid, this.now());
    if (this.stream && this.isCaller(uid) && this.roster.has(uid) && !this.retries.has(uid)) {
      this.retries.set(
        uid,
        setTimeout(() => {
          this.retries.delete(uid);
          this.reconcile();
        }, this.retryMs),
      );
    }
    this.publishLinks();
  }

  private drop(uid: string): void {
    const pending = this.leaving.get(uid);
    if (pending) clearTimeout(pending);
    this.leaving.delete(uid);
    const entry = this.peers.get(uid);
    if (!entry) return;
    this.peers.delete(uid);
    clearTimeout(entry.timeout);
    try {
      entry.peer.destroy();
    } catch {
      // Already torn down by the library.
    }
    this.options.onStreamGone(uid);
  }

  private publishLinks(): void {
    const links: Record<string, VoiceLink> = {};
    if (this.stream) {
      const at = this.now();
      this.roster.forEach((uid) => {
        if (this.peers.get(uid)?.connected) links[uid] = "connected";
        else
          links[uid] =
            at - (this.seenAt.get(uid) ?? at) >= this.failingAfterMs ? "failing" : "connecting";
      });
    }
    const key = JSON.stringify(links);
    if (key === this.lastLinks) return;
    this.lastLinks = key;
    this.options.onLinksChange(links);
  }
}
