// ============================================================================
// SFX ENGINE — sample playback through an S-DSP-style graph
// ============================================================================
// Loads low-bitrate WAV one-shots and plays them by pitching a BufferSource
// (exactly how the SNES S-DSP plays stored BRR samples), routing a portion of
// each voice into a hardware-style echo bus. Designed to degrade to a no-op in
// environments without Web Audio (SSR, jsdom tests).

import { getJuiceSettings } from "./juiceSettings";
import { createEchoBus, type EchoBus } from "./snesDsp";
import { SFX_MANIFEST, type SfxName, type SfxSpec } from "./sfxManifest";

interface PlayOptions {
  /** Multiply the sample's base gain. */
  gainScale?: number;
  /** Override the base playback rate (pitch). */
  rate?: number;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private echo: EchoBus | null = null;
  private readonly buffers = new Map<SfxName, AudioBuffer>();
  private readonly inFlight = new Map<SfxName, Promise<AudioBuffer | null>>();
  private unlockBound: (() => void) | null = null;

  /** True only when Web Audio is actually available. */
  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = getJuiceSettings().volume;
    master.connect(ctx.destination);

    const echo = createEchoBus(ctx);
    echo.output.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.echo = echo;
    return ctx;
  }

  /**
   * Resume a suspended context. Browsers start it suspended until a user
   * gesture; call from a click/keydown handler.
   */
  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  /** Install one-time listeners that unlock audio on the first user gesture. */
  installAutoUnlock(): void {
    if (typeof window === "undefined" || this.unlockBound) return;
    const handler = () => {
      this.resume();
    };
    this.unlockBound = handler;
    window.addEventListener("pointerdown", handler, { once: false });
    window.addEventListener("keydown", handler, { once: false });
    window.addEventListener("touchstart", handler, { once: false });
  }

  /** Preload every (or a subset of) sample so first playback has no latency. */
  async preload(names: SfxName[] = Object.keys(SFX_MANIFEST) as SfxName[]): Promise<void> {
    if (!this.available) return;
    await Promise.all(names.map((name) => this.load(name)));
  }

  private async load(name: SfxName): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(name);
    if (cached) return cached;
    const pending = this.inFlight.get(name);
    if (pending) return pending;

    const ctx = this.ensureContext();
    if (!ctx) return null;

    const spec = SFX_MANIFEST[name];
    const task = (async () => {
      try {
        const response = await fetch(spec.url);
        if (!response.ok) return null;
        const raw = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(raw);
        this.buffers.set(name, buffer);
        return buffer;
      } catch {
        // Missing/undecodable asset — stay silent rather than throw.
        return null;
      } finally {
        this.inFlight.delete(name);
      }
    })();

    this.inFlight.set(name, task);
    return task;
  }

  /** Fire a one-shot. Safe to call before load (it will lazy-load then play). */
  play(name: SfxName, options: PlayOptions = {}): void {
    const settings = getJuiceSettings();
    if (settings.muted || settings.volume <= 0) return;
    if (!this.available) return;

    const buffer = this.buffers.get(name);
    if (!buffer) {
      // Lazy-load, then play once ready (fire-and-forget).
      void this.load(name).then((loaded) => {
        if (loaded) this.playBuffer(name, loaded, options);
      });
      return;
    }
    this.playBuffer(name, buffer, options);
  }

  private playBuffer(name: SfxName, buffer: AudioBuffer, options: PlayOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    const echo = this.echo;
    if (!ctx || !master || !echo) return;
    if (ctx.state === "suspended") void ctx.resume();

    const spec: SfxSpec = SFX_MANIFEST[name];
    // Keep master gain in sync with the live volume setting.
    master.gain.value = getJuiceSettings().volume;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = pitch(spec, options);

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = spec.gain * (options.gainScale ?? 1);
    source.connect(voiceGain);

    // Dry path straight to master.
    voiceGain.connect(master);

    // Wet path into the echo bus per the sample's reverb send.
    if (spec.reverbSend > 0) {
      const wet = ctx.createGain();
      wet.gain.value = spec.reverbSend;
      voiceGain.connect(wet);
      wet.connect(echo.send);
    }

    source.start();
  }
}

function pitch(spec: SfxSpec, options: PlayOptions): number {
  if (options.rate !== undefined) return options.rate;
  if (spec.rateJitter <= 0) return spec.rate;
  // Deterministic-free jitter is fine here; variety matters more than repeatability.
  const jitter = (Math.random() * 2 - 1) * spec.rateJitter;
  return Math.max(0.25, spec.rate + jitter);
}

/** Process-wide singleton engine. */
export const sfxEngine = new SfxEngine();
