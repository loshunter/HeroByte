// ============================================================================
// SNES S-DSP FLAVOUR — Web Audio echo bus
// ============================================================================
// The SNES S-DSP had a hardware echo unit: a feedback delay line with an 8-tap
// FIR filter in the loop, which is what gives so many SNES games their signature
// "in a cave" reverb. We approximate it with a DelayNode + feedback gain + a
// lowpass biquad standing in for the FIR's high-frequency roll-off. A wet/dry
// send lets each sound choose how drenched it is.

export interface EchoBus {
  /** Route dry signal here for reverb. */
  readonly send: GainNode;
  /** Final wet output; connect to the master gain. */
  readonly output: GainNode;
}

export interface EchoOptions {
  /** Echo delay in seconds (S-DSP maxed near 0.24s). */
  delaySeconds?: number;
  /** Feedback coefficient 0..1 (higher = longer tail). */
  feedback?: number;
  /** FIR-approximating lowpass cutoff in Hz. */
  toneHz?: number;
}

/**
 * Build an S-DSP-style echo bus. Send dry audio into `bus.send`; connect
 * `bus.output` to your master gain. The dry path is left to the caller so each
 * one-shot can mix its own wet/dry balance.
 */
export function createEchoBus(ctx: BaseAudioContext, options: EchoOptions = {}): EchoBus {
  const { delaySeconds = 0.13, feedback = 0.32, toneHz = 2600 } = options;

  const send = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = Math.min(0.24, Math.max(0.02, delaySeconds));

  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = Math.min(0.85, Math.max(0, feedback));

  // Stand-in for the S-DSP's FIR filter: roll off highs each pass so the tail
  // darkens naturally instead of turning to harsh digital hiss.
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = toneHz;

  const output = ctx.createGain();
  output.gain.value = 1;

  // send -> delay -> tone -> output, with tone -> feedback -> delay loop.
  send.connect(delay);
  delay.connect(tone);
  tone.connect(output);
  tone.connect(feedbackGain);
  feedbackGain.connect(delay);

  return { send, output };
}
