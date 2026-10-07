// The speaking-glow meter: samples ten times a second and sends a level only when
// it crosses the glow threshold (0.1) or moves by 0.05; muting sends one zero and
// then only silence; stopping sends a closing zero if the last level was not zero.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MicMeter, shouldSendLevel } from "../micMeter";

describe("shouldSendLevel", () => {
  it.each([
    [0, 0, false],
    [0, 0.04, false],
    [0, 0.05, true],
    [0.08, 0.1, true],
    [0.1, 0.09, true],
    [0.12, 0.08, true],
    [0.3, 0.33, false],
    [0.3, 0.36, true],
    [0.5, 0.44, true],
    [0.6, 0.62, false],
    [0.02, 0.06, false],
  ])("last %s -> next %s: %s", (last, next, expected) => {
    expect(shouldSendLevel(last, next)).toBe(expected);
  });
});

describe("MicMeter", () => {
  // Every frequency bin reads `bin`; the level is bin / 255.
  let bin = 0;
  let contexts: FakeContext[] = [];

  class FakeContext {
    state = "running";
    resume = vi.fn(() => Promise.resolve());
    close = vi.fn(() => Promise.resolve());
    analyser = {
      fftSize: 0,
      frequencyBinCount: 4,
      getByteFrequencyData: (data: Uint8Array) => data.fill(bin),
    };
    source = { connect: vi.fn() };
    constructor() {
      contexts.push(this);
    }
    createAnalyser() {
      return this.analyser;
    }
    createMediaStreamSource() {
      return this.source;
    }
  }

  const STREAM = {} as MediaStream;
  const level = (value: number) => Math.round(value * 255);
  const original = (window as { AudioContext?: unknown }).AudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    bin = 0;
    contexts = [];
    (window as { AudioContext?: unknown }).AudioContext = FakeContext;
  });
  afterEach(() => {
    vi.useRealTimers();
    (window as { AudioContext?: unknown }).AudioContext = original;
  });

  it("connects the stream to an analyser and sends nothing while silent", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    expect(contexts[0].source.connect).toHaveBeenCalledWith(contexts[0].analyser);
    vi.advanceTimersByTime(1000);
    expect(send).not.toHaveBeenCalled();
    meter.stop();
  });

  it("samples every 100 ms and sends a level that crosses the threshold", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    bin = level(0.4);
    vi.advanceTimersByTime(99);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeCloseTo(0.4, 2);
    meter.stop();
  });

  it("a steady voice costs nothing; a small wobble costs nothing; a big change is sent", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    bin = level(0.4);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(1000);
    expect(send).toHaveBeenCalledTimes(1);
    bin = level(0.42);
    vi.advanceTimersByTime(500);
    expect(send).toHaveBeenCalledTimes(1);
    bin = level(0.6);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBeCloseTo(0.6, 2);
    meter.stop();
  });

  it("setMuted(true) sends 0 once, then only zero is ever measured (nothing more is sent)", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    bin = level(0.5);
    vi.advanceTimersByTime(100);
    send.mockClear();
    meter.setMuted(true);
    expect(send.mock.calls).toEqual([[0]]);
    bin = level(0.9);
    vi.advanceTimersByTime(2000);
    expect(send.mock.calls).toEqual([[0]]);
    meter.setMuted(false);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBeCloseTo(0.9, 2);
    meter.stop();
  });

  it("setMuted(true) after silence sends nothing", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    meter.setMuted(true);
    vi.advanceTimersByTime(500);
    expect(send).not.toHaveBeenCalled();
    meter.stop();
  });

  it("stop sends a closing 0 when the last level was not zero, stops sampling and closes the context", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    bin = level(0.5);
    vi.advanceTimersByTime(100);
    send.mockClear();
    meter.stop();
    expect(send.mock.calls).toEqual([[0]]);
    expect(contexts[0].close).toHaveBeenCalled();
    bin = level(0.9);
    vi.advanceTimersByTime(1000);
    expect(send.mock.calls).toEqual([[0]]);
  });

  it("stop after silence sends nothing", () => {
    const send = vi.fn();
    const meter = new MicMeter(send);
    meter.start(STREAM);
    vi.advanceTimersByTime(300);
    meter.stop();
    expect(send).not.toHaveBeenCalled();
  });

  it("a suspended context is resumed by the next press anywhere", () => {
    class Suspended extends FakeContext {
      state = "suspended";
    }
    (window as { AudioContext?: unknown }).AudioContext = Suspended;
    const meter = new MicMeter(vi.fn());
    meter.start(STREAM);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(contexts[0].resume).toHaveBeenCalledTimes(1);
    meter.stop();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(contexts[0].resume).toHaveBeenCalledTimes(1);
  });

  it.each(["createAnalyser", "createMediaStreamSource"] as const)(
    "%s throwing: start rethrows, the context is closed once, nothing is sampled",
    (broken) => {
      class Broken extends FakeContext {
        createAnalyser() {
          if (broken === "createAnalyser") throw new Error("no analyser");
          return super.createAnalyser();
        }
        createMediaStreamSource() {
          if (broken === "createMediaStreamSource") throw new Error("no source");
          return super.createMediaStreamSource();
        }
      }
      (window as { AudioContext?: unknown }).AudioContext = Broken;
      const send = vi.fn();
      const meter = new MicMeter(send);
      expect(() => meter.start(STREAM)).toThrow(
        broken === "createAnalyser" ? "no analyser" : "no source",
      );
      expect(contexts).toHaveLength(1);
      expect(contexts[0].close).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(send).not.toHaveBeenCalled();
      // A later stop has nothing left to close.
      meter.stop();
      expect(contexts[0].close).toHaveBeenCalledTimes(1);
    },
  );

  it("does nothing where there is no AudioContext", () => {
    delete (window as { AudioContext?: unknown }).AudioContext;
    const send = vi.fn();
    const meter = new MicMeter(send);
    expect(() => meter.start(STREAM)).not.toThrow();
    vi.advanceTimersByTime(1000);
    meter.stop();
    expect(send).not.toHaveBeenCalled();
  });
});
