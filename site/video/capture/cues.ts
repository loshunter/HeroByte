// When the narration says a phrase: the start of its first word, in seconds into the chapter.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

type Word = { w: string; s: number; e: number };
type Timing = { chapters: { file: string; duration: number; words: Word[] }[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function loadCues(lesson: string) {
  const file = path.resolve(here, "..", "narration-timing", `${lesson}.json`);
  const timing = JSON.parse(fs.readFileSync(file, "utf8")) as Timing;
  return (chapter: number) => {
    const ch = timing.chapters[chapter - 1];
    const words = ch.words.map((w) => ({ ...w, n: norm(w.w) }));
    /** Start of `phrase` (its nth occurrence), plus `offset` seconds. */
    const cue = (phrase: string, offset = 0, nth = 1) => {
      const want = phrase.split(/\s+/).map(norm).filter(Boolean);
      let seen = 0;
      for (let i = 0; i + want.length <= words.length; i++) {
        if (want.every((p, k) => words[i + k].n === p) && ++seen === nth) return words[i].s + offset;
      }
      throw new Error(`chapter ${chapter}: no "${phrase}" in the narration`);
    };
    return { cue, duration: ch.duration };
  };
}
