// ============================================================================
// USE VOICE
// ============================================================================
// The table's voice call, as simple as a Discord call: Join once (the browser
// asks for the mic the first time), then Mute / Unmute and Leave. Muting
// silences the outgoing mic and keeps every connection, so you still hear
// everyone. The server keeps who is in the call (Player.voice), which is what
// shows a call before you join and tells each browser whom to connect to.
//
// Voice comes back by itself: after a network blip the server forgets who was
// in the call, so the state is sent again on every re-authentication; after a
// reload the tab remembers it and rejoins (in the same muted or live state).
//
// The connections themselves are VoiceMesh's; the other voices are played by
// RemoteAudio; the speaking glow is MicMeter's.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import type { SignalData } from "simple-peer";
import { describeMicFailure, readMicEnvironment } from "../micFailure";
import { releaseMicNotice, setMicNotice } from "../micNotice";
import { VoiceMesh, type VoiceLink } from "./VoiceMesh";
import { RemoteAudio } from "./remoteAudio";
import { MicMeter } from "./micMeter";
import { forgetVoice, recallVoice, rememberVoice } from "./voiceMemory";

export type VoiceState = "off" | "joining" | "live" | "muted";

export interface VoiceApi {
  state: VoiceState;
  /** Everyone the server says is in the call right now, this player included. */
  inCall: { uid: string; name: string; muted: boolean }[];
  /** This browser's connection to each other person in the call. */
  links: Record<string, VoiceLink>;
  /** A voice could not start playing until the next tap. */
  audioBlocked: boolean;
  /** Join the call; `muted` joins with the mic already muted (a reload that was muted). */
  join: (muted?: boolean) => Promise<void>;
  leave: () => void;
  toggleMute: () => void;
  /** Start any voice the browser refused to play; call it from a tap. */
  resumeAudio: () => void;
}

interface UseVoiceOptions {
  uid: string;
  snapshot: RoomSnapshot | null;
  sendMessage: (message: ClientMessage) => void;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  /** True while this tab is authenticated to the table (false during a blip). */
  authenticated: boolean;
}

/** Why voice could not start when it was not the microphone's fault. */
const NO_WEBRTC =
  "This browser cannot do voice calls. Try a current Chrome, Edge, Firefox or Safari.";
const NOT_LOADED = "Voice could not load. Reload the page, then press Join voice again.";
const NOT_LISTED = "The table no longer lists you, so you left the voice call.";
const MIC_STOPPED =
  "Your mic stopped (unplugged, or the browser or another app turned it off), so you left the call. Press Join voice to come back.";

class VoiceUnavailable extends Error {}

export function useVoice({
  uid,
  snapshot,
  sendMessage,
  registerRtcHandler,
  authenticated,
}: UseVoiceOptions): VoiceApi {
  const [state, setState] = useState<VoiceState>("off");
  const [links, setLinks] = useState<Record<string, VoiceLink>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const stateRef = useRef<VoiceState>("off");
  const streamRef = useRef<MediaStream | null>(null);
  const meshRef = useRef<VoiceMesh | null>(null);
  const audioRef = useRef<RemoteAudio | null>(null);
  const meterRef = useRef<MicMeter | null>(null);
  const sendRef = useRef(sendMessage);
  sendRef.current = sendMessage;

  const setVoiceState = useCallback((next: VoiceState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // Keyed on its CONTENT: every snapshot brings new arrays, and a new list here
  // would re-render every consumer (each Party card) on every broadcast.
  const connected = new Set(snapshot?.users ?? []);
  // (JSON, not separator characters: a player's name can contain anything.)
  const inCallKey = JSON.stringify(
    (snapshot?.players ?? [])
      .filter((player) => player.voice && connected.has(player.uid))
      .map((player) => [player.uid, player.voice, player.name]),
  );
  const inCall = useMemo(
    () =>
      (JSON.parse(inCallKey) as [string, string, string][]).map(([personUid, voice, name]) => ({
        uid: personUid,
        name,
        muted: voice === "muted",
      })),
    [inCallKey],
  );
  const listed = !snapshot || snapshot.players.some((player) => player.uid === uid);

  // One handler for the whole session: a mesh that is not running ignores
  // signals, so nothing answers a call once this player has left voice.
  useEffect(() => {
    registerRtcHandler((from, signal) => meshRef.current?.handleSignal(from, signal as SignalData));
  }, [registerRtcHandler]);

  const rosterKey = inCall
    .map((person) => person.uid)
    .sort()
    .join(",");
  const rosterKeyRef = useRef(rosterKey);
  rosterKeyRef.current = rosterKey;
  // After a reconnect the snapshot is gone until the table answers: the hello
  // that asks old callers to call again waits for the roster it is sent to.
  const announcePending = useRef(false);
  const hasSnapshot = Boolean(snapshot);
  const hasSnapshotRef = useRef(hasSnapshot);
  hasSnapshotRef.current = hasSnapshot;
  useEffect(() => {
    // No snapshot (this tab's socket is down) says nothing about who is in the
    // call: keep the connections, which may well still be carrying audio.
    if (!hasSnapshot) return;
    meshRef.current?.setRoster(rosterKey ? rosterKey.split(",") : []);
    if (announcePending.current) {
      announcePending.current = false;
      meshRef.current?.announce();
    }
  }, [rosterKey, hasSnapshot]);

  const teardown = useCallback(() => {
    meshRef.current?.stop();
    meshRef.current = null;
    audioRef.current?.clear();
    audioRef.current = null;
    meterRef.current?.stop();
    meterRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLinks({});
  }, []);

  // Each join is numbered: one that was left (and maybe joined again) while
  // the mic prompt was open, or whose table unmounted, finds a newer number and
  // bows out.
  const attemptRef = useRef(0);
  const leaveRef = useRef<() => void>(() => {});
  const join = useCallback(
    async (muted = false) => {
      if (stateRef.current !== "off") return;
      const attempt = ++attemptRef.current;
      setVoiceState("joining");
      setMicNotice(null);
      let stream: MediaStream | null = null;
      try {
        if (typeof window.RTCPeerConnection === "undefined") throw new VoiceUnavailable(NO_WEBRTC);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        // A tab left open across a deploy can no longer fetch the old voice chunk.
        const { default: SimplePeer } = await import("simple-peer").catch(() => {
          throw new VoiceUnavailable(NOT_LOADED);
        });
        // Left while the mic prompt was open: release what the browser handed over.
        // (Read through a widened type: TS still narrows the ref from the guard above the await.)
        if (attempt !== attemptRef.current || (stateRef.current as VoiceState) !== "joining") {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const local = stream;
        local.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
          // The mic can stop on its own (unplugged, taken by another app): leave
          // and say so, rather than show a live call that sends nothing.
          track.addEventListener("ended", () => {
            if (streamRef.current !== local) return;
            leaveRef.current();
            // Shown wherever Join voice is, whichever control was pressed last.
            releaseMicNotice();
            setMicNotice(MIC_STOPPED);
          });
        });
        streamRef.current = local;
        const audio = new RemoteAudio(setAudioBlocked);
        audioRef.current = audio;
        const meter = new MicMeter((level) => sendRef.current({ t: "mic-level", level }));
        try {
          meter.start(stream);
          meter.setMuted(muted);
          meterRef.current = meter;
        } catch (error) {
          // The speaking glow is decoration: the call goes on without it.
          console.warn("Voice meter unavailable:", error);
        }
        const mesh = new VoiceMesh({
          selfUid: uid,
          createPeer: (initiator, local) =>
            new SimplePeer({ initiator, stream: local, trickle: true }),
          sendSignal: (target, signal) => sendRef.current({ t: "rtc-signal", target, signal }),
          onStream: (peerUid, remote) => audio.attach(peerUid, remote),
          onStreamGone: (peerUid) => audio.detach(peerUid),
          onLinksChange: setLinks,
        });
        meshRef.current = mesh;
        const next = muted ? "muted" : "live";
        setVoiceState(next);
        rememberVoice(next);
        // Presence first: the server relays signals only between players in the
        // call, and this socket's messages arrive in the order they are sent.
        sendRef.current({ t: "voice-state", state: next });
        mesh.start(local);
        mesh.setRoster(rosterKeyRef.current ? rosterKeyRef.current.split(",") : []);
        mesh.announce();
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        if (attempt !== attemptRef.current) return;
        teardown();
        setVoiceState("off");
        forgetVoice();
        console.error("Voice join failed:", error);
        setMicNotice(
          error instanceof VoiceUnavailable
            ? error.message
            : describeMicFailure(error, readMicEnvironment()),
        );
      }
    },
    [setVoiceState, teardown, uid],
  );

  const leave = useCallback(() => {
    if (stateRef.current === "off") return;
    const wasIn = stateRef.current !== "joining";
    attemptRef.current += 1;
    teardown();
    setVoiceState("off");
    forgetVoice();
    if (wasIn) sendRef.current({ t: "voice-state", state: "off" });
  }, [setVoiceState, teardown]);
  leaveRef.current = leave;

  const toggleMute = useCallback(() => {
    const current = stateRef.current;
    if (current !== "live" && current !== "muted") return;
    const next = current === "live" ? "muted" : "live";
    streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = next === "live"));
    meterRef.current?.setMuted(next === "muted");
    setVoiceState(next);
    rememberVoice(next);
    sendRef.current({ t: "voice-state", state: next });
  }, [setVoiceState]);

  const resumeAudio = useCallback(() => audioRef.current?.resume(), []);

  // Back after a blip (the server cleared this player's voice on disconnect),
  // or first arrival after a reload that was in the call: take the seat again.
  useEffect(() => {
    if (!authenticated) return;
    const current = stateRef.current;
    if (current === "live" || current === "muted") {
      sendRef.current({ t: "voice-state", state: current });
      // Half-made calls from before (their signals were dropped while offline)
      // start over, and anyone holding a connection to this tab from before the
      // blip is asked to call again once the roster is back.
      meshRef.current?.resync();
      // Effects run in order: when the table's answer came in this same render,
      // the roster is already set and nothing will re-run, so say hello now.
      if (hasSnapshotRef.current) meshRef.current?.announce();
      else announcePending.current = true;
      return;
    }
    const remembered = recallVoice();
    if (current === "off" && remembered) void join(remembered === "muted");
  }, [authenticated, join]);

  // The reload memory is honoured for a minute after the page went away: refresh
  // it then, so a long call still comes back after a reload.
  useEffect(() => {
    const onHide = () => {
      const current = stateRef.current;
      if (current === "live" || current === "muted") rememberVoice(current);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Removed from the table while in the call (the DM's clear-all): the server no
  // longer relays this player's signals, so leave rather than show a dead call.
  useEffect(() => {
    if (listed || !authenticated) return;
    if (stateRef.current !== "live" && stateRef.current !== "muted") return;
    leaveRef.current();
    releaseMicNotice();
    setMicNotice(NOT_LISTED);
  }, [listed, authenticated]);

  // Leaving the table (unmount) hangs up and releases the mic, including a join
  // still waiting on the mic prompt (it must not start a call nothing shows), and
  // forgets the call: the gate that unmounted it (another tab, a conflict) must
  // not rejoin it unasked. A reload never unmounts, so its memory survives.
  useEffect(
    () => () => {
      attemptRef.current += 1;
      stateRef.current = "off";
      teardown();
      forgetVoice();
    },
    [teardown],
  );

  return useMemo(
    () => ({ state, inCall, links, audioBlocked, join, leave, toggleMute, resumeAudio }),
    [state, inCall, links, audioBlocked, join, leave, toggleMute, resumeAudio],
  );
}
