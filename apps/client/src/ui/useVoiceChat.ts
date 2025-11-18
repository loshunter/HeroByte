/**
 * Voice Chat Hook with Lazy Simple-Peer Loading
 *
 * Performance Optimization:
 * SimplePeer (~30 KB gzipped) is dynamically imported only when the hook
 * is enabled (mic is turned on), deferring the WebRTC dependency until needed.
 */
import { useEffect, useRef, useState } from "react";
import type { ClientMessage } from "@shared";

// Type-only import (no runtime cost)
import type SimplePeer from "simple-peer";
import type { SignalData } from "simple-peer";

interface VoiceChatOptions {
  sendMessage: (msg: ClientMessage) => void;
  onRtcSignal: (handler: (from: string, signal: unknown) => void) => void;
  uid: string;
  otherPlayerUIDs: string[];
  enabled: boolean;
  stream: MediaStream | null;
}

export function useVoiceChat({
  sendMessage,
  onRtcSignal,
  uid,
  otherPlayerUIDs,
  enabled,
  stream,
}: VoiceChatOptions) {
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [SimplePeerConstructor, setSimplePeerConstructor] = useState<typeof SimplePeer | null>(
    null,
  );
  const otherPlayerUIDsStr = JSON.stringify(otherPlayerUIDs);

  // Lazy load SimplePeer only when voice chat is enabled
  useEffect(() => {
    if (enabled && !SimplePeerConstructor) {
      console.log("[VoiceChat] Loading SimplePeer library...");
      import("simple-peer")
        .then((module) => {
          setSimplePeerConstructor(() => module.default);
          console.log("[VoiceChat] SimplePeer loaded successfully");
        })
        .catch((err) => {
          console.error("[VoiceChat] Failed to load SimplePeer:", err);
        });
    }
  }, [enabled, SimplePeerConstructor]);

  useEffect(() => {
    if (!enabled || !stream || !SimplePeerConstructor) {
      // Clean up all peers when disabled or module not loaded yet
      peersRef.current.forEach((peer) => {
        try {
          peer.destroy();
        } catch (e) {
          console.error("Error destroying peer:", e);
        }
      });
      peersRef.current.clear();
      setConnectedPeers([]);
      return;
    }

    // Handle incoming RTC signals
    const handleRtcSignal = (from: string, signal: unknown) => {
      let peer = peersRef.current.get(from);

      if (!peer) {
        // Create a new peer connection (not initiator, because they initiated)
        peer = new SimplePeerConstructor({
          initiator: false,
          stream: stream,
          trickle: true,
        });

        peer.on("signal", (signal) => {
          sendMessage({ t: "rtc-signal", target: from, signal });
        });

        peer.on("stream", (remoteStream) => {
          console.log("Received stream from", from);
          // Play the remote stream
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play();
        });

        peer.on("connect", () => {
          console.log("Connected to", from);
          setConnectedPeers((prev) => [...prev.filter((p) => p !== from), from]);
        });

        peer.on("close", () => {
          console.log("Disconnected from", from);
          peersRef.current.delete(from);
          setConnectedPeers((prev) => prev.filter((p) => p !== from));
        });

        peer.on("error", (err) => {
          console.error("Peer error with", from, err);
          peersRef.current.delete(from);
          setConnectedPeers((prev) => prev.filter((p) => p !== from));
        });

        peersRef.current.set(from, peer);
      }

      // Signal the peer
      peer.signal(signal as SignalData);
    };

    onRtcSignal(handleRtcSignal);

    // Initiate connections to other players
    otherPlayerUIDs.forEach((targetUID) => {
      if (!peersRef.current.has(targetUID)) {
        // Create a new peer connection (initiator)
        const peer = new SimplePeerConstructor({
          initiator: true,
          stream: stream,
          trickle: true,
        });

        peer.on("signal", (signal) => {
          sendMessage({ t: "rtc-signal", target: targetUID, signal });
        });

        peer.on("stream", (remoteStream) => {
          console.log("Received stream from", targetUID);
          // Play the remote stream
          const audio = new Audio();
          audio.srcObject = remoteStream;
          audio.play();
        });

        peer.on("connect", () => {
          console.log("Connected to", targetUID);
          setConnectedPeers((prev) => [...prev.filter((p) => p !== targetUID), targetUID]);
        });

        peer.on("close", () => {
          console.log("Disconnected from", targetUID);
          peersRef.current.delete(targetUID);
          setConnectedPeers((prev) => prev.filter((p) => p !== targetUID));
        });

        peer.on("error", (err) => {
          console.error("Peer error with", targetUID, err);
          peersRef.current.delete(targetUID);
          setConnectedPeers((prev) => prev.filter((p) => p !== targetUID));
        });

        peersRef.current.set(targetUID, peer);
      }
    });

    // Clean up peers for players who left
    peersRef.current.forEach((peer, peerUID) => {
      if (!otherPlayerUIDs.includes(peerUID)) {
        peer.destroy();
        peersRef.current.delete(peerUID);
        setConnectedPeers((prev) => prev.filter((p) => p !== peerUID));
      }
    });
  }, [onRtcSignal, uid, otherPlayerUIDsStr, enabled, stream, sendMessage, SimplePeerConstructor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach((peer) => peer.destroy());
      peersRef.current.clear();
    };
  }, []);

  return { connectedPeers };
}
