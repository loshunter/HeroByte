// ============================================================================
// USE MICROPHONE HOOK
// ============================================================================
// Manages microphone state, audio analysis, and visual feedback
// Handles browser audio permissions and real-time level detection

import { useState, useRef, useEffect, useCallback } from "react";
import type { ClientMessage } from "@shared";

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

  /**
   * Toggle microphone on/off
   * Starts/stops audio analysis for visual feedback
   */
  const toggleMic = useCallback(async () => {
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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        microphone.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

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
        console.error("Mic access error:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert(`Microphone error: ${errorMsg}\n\nCheck Safari Settings → Websites → Microphone`);
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
