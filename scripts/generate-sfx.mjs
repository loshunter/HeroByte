#!/usr/bin/env node
// ============================================================================
// GENERATE SFX — SNES S-DSP flavoured one-shot sample assets
// ============================================================================
// Synthesizes short sound effects and writes them as low-bitrate PCM WAV files
// (16 kHz mono, amplitude quantized to ~8 bits) into apps/client/public/sfx.
// The low sample rate + bit quantization gives the crunchy "stored sample"
// character of the SNES; the runtime engine adds the hardware-style echo.
//
// Regenerate with:  node scripts/generate-sfx.mjs   (or: pnpm gen:sfx)
// These files are real samples — replace any WAV with a recorded one-shot and
// it will inherit the same in-engine echo treatment.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 16000; // Lo-fi, SNES-ish
const QUANT_LEVELS = 128; // ~7-8 bit crunch
const TAU = Math.PI * 2;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "apps", "client", "public", "sfx");

// ---------------------------------------------------------------------------
// Signal helpers (operate on Float32 arrays, range roughly [-1, 1])
// ---------------------------------------------------------------------------

function seconds(t) {
  return Math.max(1, Math.round(SAMPLE_RATE * t));
}

/** Exponential decay envelope value at sample i of n. */
function decay(i, n, rate = 5) {
  return Math.exp((-rate * i) / n);
}

/** Simple linear attack-decay envelope. */
function ad(i, n, attack = 0.02) {
  const a = Math.max(1, Math.floor(n * attack));
  if (i < a) return i / a;
  return 1 - (i - a) / (n - a);
}

function sine(freq, i) {
  return Math.sin((TAU * freq * i) / SAMPLE_RATE);
}

function square(freq, i) {
  return sine(freq, i) >= 0 ? 1 : -1;
}

function noise() {
  return Math.random() * 2 - 1;
}

/** One-pole lowpass to tame harsh digital highs (Gaussian-ish smoothing). */
function lowpass(samples, cutoff = 0.35) {
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev += cutoff * (samples[i] - prev);
    samples[i] = prev;
  }
  return samples;
}

function normalize(samples, peak = 0.9) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const scale = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  return samples;
}

// ---------------------------------------------------------------------------
// Individual voices — each returns a Float32Array
// ---------------------------------------------------------------------------

function diceRattle() {
  const n = seconds(0.5);
  const out = new Float32Array(n);
  // A handful of short noise "clicks" like tumbling dice.
  const clicks = [0, 0.08, 0.15, 0.21, 0.28, 0.34, 0.4];
  for (const start of clicks) {
    const s = Math.floor(start * SAMPLE_RATE);
    const len = seconds(0.035);
    for (let i = 0; i < len && s + i < n; i++) {
      out[s + i] += noise() * decay(i, len, 9) * 0.8;
    }
  }
  return normalize(lowpass(out, 0.5), 0.7);
}

function diceLand() {
  const n = seconds(0.28);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const thump = sine(90 - (30 * i) / n, i) * decay(i, n, 7);
    const grit = noise() * decay(i, n, 18) * 0.5;
    out[i] = thump * 0.9 + grit;
  }
  return normalize(lowpass(out, 0.45));
}

function critSting() {
  const n = seconds(0.7);
  const out = new Float32Array(n);
  // Ascending major arpeggio: C5 E5 G5 C6.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const step = Math.floor(n / notes.length);
  for (let k = 0; k < notes.length; k++) {
    const s = k * step;
    const len = k === notes.length - 1 ? n - s : step + seconds(0.05);
    for (let i = 0; i < len && s + i < n; i++) {
      const tone = square(notes[k], i) * 0.4 + sine(notes[k] * 2, i) * 0.2;
      out[s + i] += tone * ad(i, len, 0.03) * 0.8;
    }
  }
  return normalize(lowpass(out, 0.55), 0.85);
}

function failThud() {
  const n = seconds(0.5);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // Descending detuned wobble sinking into a low thud.
    const f = 220 - (150 * i) / n;
    const wob = (sine(f, i) + sine(f * 1.02, i)) * 0.5;
    out[i] = wob * decay(i, n, 4) * 0.9 + noise() * decay(i, n, 20) * 0.2;
  }
  return normalize(lowpass(out, 0.4));
}

function damage() {
  const n = seconds(0.18);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const hit = noise() * decay(i, n, 16) * 0.7;
    const body = sine(140, i) * decay(i, n, 10) * 0.6;
    out[i] = hit + body;
  }
  return normalize(lowpass(out, 0.5));
}

function heal() {
  const n = seconds(0.6);
  const out = new Float32Array(n);
  // Bell-like rising shimmer (sine partials).
  const base = 660;
  for (let i = 0; i < n; i++) {
    const rise = 1 + (0.5 * i) / n;
    const bell =
      sine(base * rise, i) * 0.5 +
      sine(base * 2 * rise, i) * 0.25 +
      sine(base * 3 * rise, i) * 0.12;
    out[i] = bell * ad(i, n, 0.05) * decay(i, n, 2.5);
  }
  return normalize(lowpass(out, 0.6), 0.8);
}

function buttonBlip() {
  const n = seconds(0.06);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = square(880, i) * ad(i, n, 0.1) * 0.6;
  }
  return normalize(lowpass(out, 0.6), 0.6);
}

function tokenPlace() {
  const n = seconds(0.12);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = 500 - (200 * i) / n; // slight downward chirp = "set down"
    out[i] = sine(f, i) * decay(i, n, 8) * 0.7 + noise() * decay(i, n, 25) * 0.2;
  }
  return normalize(lowpass(out, 0.5), 0.7);
}

function turnAdvance() {
  const n = seconds(0.45);
  const out = new Float32Array(n);
  // Two-note "your turn" chime: G5 then C6.
  const notes = [783.99, 1046.5];
  const step = Math.floor(n / 2);
  for (let k = 0; k < notes.length; k++) {
    const s = k * step;
    const len = n - s;
    for (let i = 0; i < len && s + i < n; i++) {
      out[s + i] += sine(notes[k], i) * ad(i, len, 0.04) * decay(i, len, 3) * 0.7;
    }
  }
  return normalize(lowpass(out, 0.6), 0.8);
}

function ping() {
  const n = seconds(0.32);
  const out = new Float32Array(n);
  // Bright sonar-ish blip with a small upward chirp, long-ish for the echo tail.
  for (let i = 0; i < n; i++) {
    const f = 1000 + 500 * (i / n);
    out[i] = (sine(f, i) * 0.6 + sine(f * 1.5, i) * 0.2) * decay(i, n, 6);
  }
  return normalize(lowpass(out, 0.6), 0.7);
}

function sweep(up) {
  const n = seconds(0.14);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const f = up ? 400 + 700 * p : 1100 - 700 * p;
    out[i] = square(f, i) * ad(i, n, 0.1) * 0.4;
  }
  return normalize(lowpass(out, 0.6), 0.5);
}

// ---------------------------------------------------------------------------
// WAV encoding (16-bit PCM mono, amplitude quantized for lo-fi crunch)
// ---------------------------------------------------------------------------

function encodeWav(samples) {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Quantize to QUANT_LEVELS steps for that low-bitrate sample grit.
    const q = Math.round(samples[i] * QUANT_LEVELS) / QUANT_LEVELS;
    const clamped = Math.max(-1, Math.min(1, q));
    buffer.writeInt16LE(Math.round(clamped * 32767), offset);
    offset += 2;
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const VOICES = {
  "dice-rattle": diceRattle,
  "dice-land": diceLand,
  "crit-sting": critSting,
  "fail-thud": failThud,
  damage: damage,
  heal: heal,
  "button-blip": buttonBlip,
  "token-place": tokenPlace,
  "turn-advance": turnAdvance,
  ping: ping,
  "ui-open": () => sweep(true),
  "ui-close": () => sweep(false),
};

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, make] of Object.entries(VOICES)) {
  const wav = encodeWav(make());
  const file = join(OUT_DIR, `${name}.wav`);
  writeFileSync(file, wav);
  console.log(`  wrote ${name}.wav (${(wav.length / 1024).toFixed(1)} KB)`);
}
console.log(`Done. ${Object.keys(VOICES).length} SFX written to ${OUT_DIR}`);
