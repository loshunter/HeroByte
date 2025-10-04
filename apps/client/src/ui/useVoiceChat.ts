import { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import type { ClientMessage } from "@shared";

interface VoiceChatOptions {
  sendMessage: (msg: ClientMessage) => void;
  onRtcSignal: (handler: (from: string, signal: any) => void) => void;
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
  const otherPlayerUIDsStr = JSON.stringify(otherPlayerUIDs);

  useEffect(() => {
    if (!enabled || !stream) {
      // Clean up all peers when disabled
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
    const handleRtcSignal = (from: string, signal: any) => {
      let peer = peersRef.current.get(from);

      if (!peer) {
        // Create a new peer connection (not initiator, because they initiated)
        peer = new SimplePeer({
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
      peer.signal(signal);
    };

    onRtcSignal(handleRtcSignal);

    // Initiate connections to other players
    otherPlayerUIDs.forEach((targetUID) => {
      if (!peersRef.current.has(targetUID)) {
        // Create a new peer connection (initiator)
        const peer = new SimplePeer({
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRtcSignal, uid, otherPlayerUIDsStr, enabled, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach((peer) => peer.destroy());
      peersRef.current.clear();
    };
  }, []);

  return { connectedPeers };
}
