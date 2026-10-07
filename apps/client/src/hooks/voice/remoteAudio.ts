// ============================================================================
// REMOTE AUDIO
// ============================================================================
// Plays the other players' voices: one <audio> element per person, kept in a
// hidden holder so it can be stopped and removed when they leave (the old hook
// created an element per stream and never let go of it).
//
// Browsers may refuse to start sound that no tap started. Joining is a press,
// and Safari also relaxes the rule while a page captures the microphone, so it
// normally plays; but this is per browser and not something to rely on. When a
// play() is refused — a reload that rejoined by itself, a stricter browser —
// `blocked` turns on and the next tap, click or key anywhere on the page (or the
// "tap to hear" control) starts every voice again. On release, not on press: a
// touch counts as a tap that may start sound when it lifts (pointerup, touchend),
// and a tap on the map lifts without ever becoming a click.

/** Events that count as a tap or key which may start sound (on release, for touch). */
export const WAKE_EVENTS = ["click", "pointerup", "touchend", "keydown"] as const;

export class RemoteAudio {
  private holder: HTMLElement | null = null;
  private elements = new Map<string, HTMLAudioElement>();
  private blocked = false;
  private readonly onGesture = () => this.resume();

  constructor(private readonly onBlockedChange: (blocked: boolean) => void) {}

  attach(uid: string, stream: MediaStream): void {
    this.detach(uid);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.dataset.voicePeer = uid;
    audio.srcObject = stream;
    this.ensureHolder().appendChild(audio);
    this.elements.set(uid, audio);
    this.play(audio);
  }

  detach(uid: string): void {
    const audio = this.elements.get(uid);
    if (!audio) return;
    this.elements.delete(uid);
    audio.pause();
    audio.srcObject = null;
    audio.remove();
    if (this.elements.size === 0) this.setBlocked(false);
  }

  /** Start every voice again; call it inside a tap or click. */
  resume(): void {
    if (!this.blocked) return;
    const started = [...this.elements.values()].map((audio) => audio.play());
    // Stay blocked (the control stays up) while any voice is still refused; a
    // play that failed for another reason (a voice replaced mid-resume) is not.
    void Promise.allSettled(started).then((results) => {
      const refused = results.some(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof DOMException &&
          result.reason.name === "NotAllowedError",
      );
      if (!refused) this.setBlocked(false);
    });
  }

  clear(): void {
    [...this.elements.keys()].forEach((uid) => this.detach(uid));
    this.setBlocked(false);
    this.holder?.remove();
    this.holder = null;
  }

  private play(audio: HTMLAudioElement): void {
    const started = audio.play();
    // Older engines return nothing from play(); there is nothing to catch then.
    if (started && typeof started.catch === "function") {
      started.catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          this.setBlocked(true);
        }
      });
    }
  }

  private setBlocked(blocked: boolean): void {
    if (this.blocked === blocked) return;
    this.blocked = blocked;
    if (blocked) {
      for (const type of WAKE_EVENTS) document.addEventListener(type, this.onGesture, true);
    } else {
      for (const type of WAKE_EVENTS) document.removeEventListener(type, this.onGesture, true);
    }
    this.onBlockedChange(blocked);
  }

  private ensureHolder(): HTMLElement {
    if (!this.holder) {
      this.holder = document.createElement("div");
      this.holder.dataset.testid = "voice-audio";
      this.holder.hidden = true;
      document.body.appendChild(this.holder);
    }
    return this.holder;
  }
}
