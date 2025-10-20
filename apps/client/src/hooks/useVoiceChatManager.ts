/**
 * Voice Chat Manager Hook
 *
 * Manages microphone state and peer-to-peer voice chat connections.
 * Combines microphone access with WebRTC signaling for multiplayer voice.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 14, 29, 137, 262-274)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useVoiceChatManager
 */

import React from "react";
import type { RoomSnapshot, ClientMessage, Player } from "@shared";
import { useMicrophone } from "./useMicrophone";
import { useVoiceChat } from "../ui/useVoiceChat";

/**
 * Options for useVoiceChatManager hook
 */
export interface UseVoiceChatManagerOptions {
  /**
   * Current player's unique ID
   */
  uid: string;

  /**
   * Current room state snapshot
   */
  snapshot: RoomSnapshot | null;

  /**
   * Function to send messages to the server
   */
  sendMessage: (message: ClientMessage) => void;

  /**
   * Function to register RTC signal handler for WebRTC connections
   */
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
}

/**
 * Return values from useVoiceChatManager hook
 */
export interface UseVoiceChatManagerReturn {
  /**
   * Whether the microphone is currently enabled
   */
  micEnabled: boolean;

  /**
   * Toggle microphone on/off
   */
  toggleMic: () => Promise<void>;
}

/**
 * Hook to manage voice chat state and connections
 *
 * Features:
 * - Microphone access and control
 * - P2P voice connections to other players
 * - Automatic connection management based on room state
 * - Real-time audio level detection and broadcast
 *
 * @example
 * ```tsx
 * const { micEnabled, toggleMic } = useVoiceChatManager({
 *   uid: "player-1",
 *   snapshot,
 *   sendMessage,
 *   registerRtcHandler,
 * });
 * ```
 */
export function useVoiceChatManager({
  uid,
  snapshot,
  sendMessage,
  registerRtcHandler,
}: UseVoiceChatManagerOptions): UseVoiceChatManagerReturn {
  // Get microphone state and controls
  const { micEnabled, micStream, toggleMic } = useMicrophone({ sendMessage });

  // Get list of other players for P2P voice connections
  const otherPlayerUIDs = React.useMemo(() => {
    return snapshot?.players?.filter((p: Player) => p.uid !== uid).map((p: Player) => p.uid) || [];
  }, [snapshot?.players, uid]);

  // Manage P2P voice connections
  useVoiceChat({
    sendMessage,
    onRtcSignal: registerRtcHandler,
    uid,
    otherPlayerUIDs,
    enabled: micEnabled,
    stream: micStream,
  });

  return {
    micEnabled,
    toggleMic,
  };
}
