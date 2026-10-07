// ============================================================================
// MIC METER
// ============================================================================
// How loud this player is, for the speaking glow on their portrait. The old hook
// sent a mic-level message on EVERY animation frame (60 a second, 120 on a
// 120 Hz phone), each one a full table broadcast to everyone, which also ate the
// sender's 100-messages-a-second budget. Now it samples ten times a second and
// sends only when the level moves enough to show: silence and a steady level
// cost nothing, and speech at most ten messages a second.

/** Below this the portrait does not glow (PortraitSection's threshold). */
const SPEAKING = 0.1;
/** A change smaller than this would not visibly change the glow. */
const STEP = 0.05;
const SAMPLE_MS = 100;

export function shouldSendLevel(last: number, next: number): boolean {
  if (last >= SPEAKING !== next >= SPEAKING) return true;
  return Math.abs(next - last) >= STEP;
}

export class MicMeter {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSent = 0;
  private muted = false;
  private readonly onGesture = () => {
    void this.context?.resume().catch(() => {});
  };

  constructor(private readonly send: (level: number) => void) {}

  start(stream: MediaStream): void {
    this.stop();
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    // Held before the setup that can throw, so stop() closes it either way.
    this.context = context;
    let analyser: AnalyserNode;
    try {
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
    } catch (error) {
      this.stop();
      throw error;
    }
    // A context made without a tap (a reload rejoining by itself) starts
    // suspended and reads silence: the next click, tap or key anywhere wakes it.
    if (context.state === "suspended") {
      document.addEventListener("click", this.onGesture, true);
      document.addEventListener("keydown", this.onGesture, true);
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    this.timer = setInterval(() => {
      analyser.getByteFrequencyData(data);
      const level = this.muted
        ? 0
        : data.reduce((sum, value) => sum + value, 0) / data.length / 255;
      if (shouldSendLevel(this.lastSent, level)) {
        this.lastSent = level;
        this.send(level);
      }
    }, SAMPLE_MS);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.lastSent !== 0) {
      this.lastSent = 0;
      this.send(0);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener("click", this.onGesture, true);
    document.removeEventListener("keydown", this.onGesture, true);
    void this.context?.close().catch(() => {});
    this.context = null;
    if (this.lastSent !== 0) this.send(0);
    this.lastSent = 0;
  }
}
