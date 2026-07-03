import { describe, expect, it } from "vitest";
import { createSeededRng } from "../rng.js";

describe("createSeededRng", () => {
  it("produces an identical sequence for the same seed", () => {
    const first = createSeededRng(1234);
    const second = createSeededRng(1234);
    const sequenceA = [first(), first(), first(), first()];
    const sequenceB = [second(), second(), second(), second()];

    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);

    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1) across many draws", () => {
    const rng = createSeededRng(99);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("keeps distinct large seeds distinct (float64-hash regression)", () => {
    // These pairs collided byte-for-byte when the seed hash multiplied in
    // float64: above ~3.4M the product rounds away its low bits, collapsing
    // the upper half of the 32-bit seed range to ~2^21 streams.
    const pairs: Array<[number, number]> = [
      [4168737170, 3489788145],
      [4026531840, 4027264379],
    ];
    for (const [seedA, seedB] of pairs) {
      const a = createSeededRng(seedA);
      const b = createSeededRng(seedB);
      expect([a(), a(), a(), a()]).not.toEqual([b(), b(), b(), b()]);
    }
  });

  it("gives adjacent high seeds unique first draws across a wide sample", () => {
    const seen = new Set<number>();
    for (let seed = 4026531840; seed < 4026533840; seed += 1) {
      seen.add(createSeededRng(seed)());
    }
    expect(seen.size).toBe(2000);
  });

  it("treats seed 0 and negative/float seeds as valid distinct streams", () => {
    const zero = createSeededRng(0);
    const negative = createSeededRng(-7);
    const float = createSeededRng(0.5);

    expect(zero()).not.toEqual(negative());
    expect(typeof float()).toBe("number");
  });
});
