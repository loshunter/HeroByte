// ============================================================================
// USE MICROPHONE HOOK
// ============================================================================
// Manages microphone state, audio analysis, and visual feedback
// Handles browser audio permissions and real-time level detection

import { useState, useRef, useEffect, useCallback } from "react";
import type { ClientMessage } from "@herobyte/shared";
import { describeMicFailure, readMicEnvironment } from "./micFailure";
import { setMicNotice } from "./micNotice";

interface UseMicrophoneOptions {
  sendMessage: (message: ClientMessage) => void;
}

interface UseMicrophoneReturn {
  micEnabled: boolean;
  micLevel: number;
  micStream: MediaStream | null;
  toggleMic: () => Promise<void>;
}

/**
 * Hook to manage microphone state and audio analysis
 *
 * Features:
 * - Browser microphone access with permissions handling
 * - Real-time audio level detection (0-1 normalized)
 * - Automatic cleanup on unmount
 * - Broadcasts mic level to server for visual feedback
 *
 * Example usage:
 * ```tsx
 * const { micEnabled, micLevel, micStream, toggleMic } = useMicrophone({
 *   sendMessage
 * });
 * ```
 */
export function useMicrophone({ sendMessage }: UseMicrophoneOptions): UseMicrophoneReturn {
  const [micEnabled, setMicEnabled] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // A second press while the first start is still waiting on the browser (the permission prompt,
  // or the device) would start the mic twice: two streams, two level loops, and a mute that
  // stopped only the second. Ignore it until the first settles.
  const startingRef = useRef(false);

  /**
   * Toggle microphone on/off
   * Starts/stops audio analysis for visual feedback
   */
  const toggleMic = useCallback(async () => {
    if (!micEnabled && startingRef.current) return;
    // Any earlier failure notice is about the last try, not this one.
    setMicNotice(null);
    if (micEnabled) {
      // Turn off mic
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
        setMicStream(null);
      }
      setMicEnabled(false);
      setMicLevel(0);
      sendMessage({ t: "mic-level", level: 0 });
    } else {
      // Turn on mic
      let stream: MediaStream | null = null;
      let audioContext: AudioContext | null = null;
      startingRef.current = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        setMicStream(stream);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const detectLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalized = average / 255; // Normalize to 0-1
          setMicLevel(normalized);
          sendMessage({ t: "mic-level", level: normalized });
          animationFrameRef.current = requestAnimationFrame(detectLevel);
        };

        detectLevel();
        setMicEnabled(true);
      } catch (err) {
        // The browser may already have handed over a stream (it is why its "mic in use"
        // light is on): when the setup after it fails, nothing else would ever stop it.
        stream?.getTracks().forEach((track) => track.stop());
        audioContext?.close().catch(() => {});
        audioContextRef.current = null;
        analyserRef.current = null;
        setMicStream(null);
        // The raw error is for the console; the person gets what to do about it, beside
        // the control, until the next try (a toast would vanish before the settings
        // page it sends them to was open).
        console.error("Mic access error:", err);
        setMicNotice(describeMicFailure(err, readMicEnvironment()));
      } finally {
        startingRef.current = false;
      }
    }
  }, [micEnabled, micStream, sendMessage]);

  /**
   * Cleanup audio context and animation frame on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    micEnabled,
    micLevel,
    micStream,
    toggleMic,
  };
}
