// What the capture and the narration timing give the edit, and how to resolve a script's cues.
export type Box = { x: number; y: number; width: number; height: number };
export type Mark = { t: number; nt: number; at?: number; kind: string; label: string; box?: Box; key?: string; value?: string };
export type Rec = { src: string; end: number; view: { width: number; height: number }; dsf: number; marks: Mark[]; fastForward: { from: number; to: number; speed: number }[] };
export type Word = { w: string; s: number; e: number };
export type TimingChapter = { file: string; duration: number; words: Word[] };
export type LessonData = { recordings: Record<string, Rec>; chapters: TimingChapter[] };

/** A moment in a chapter: seconds, a phrase Wren says, or a captured action. */
export type Cue = number | { say: string; off?: number; nth?: number; end?: boolean } | { mark: string; who?: string; nth?: number; off?: number };
/** Something on screen: a captured action's box. */
export type Target = { mark: string; who?: string; nth?: number; pad?: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findMark(rec: Rec | undefined, label: string, nth = 1): Mark | undefined {
  let seen = 0;
  return rec?.marks.find((m) => m.label === label && ++seen === nth);
}

export function makeResolver(data: LessonData, chapter: number) {
  const ch = data.chapters[chapter - 1];
  const words = ch.words.map((w) => ({ ...w, n: norm(w.w) }));
  const rec = (who = "dm") => data.recordings[`ch${chapter}-${who}`];
  const say = (phrase: string, nth = 1, end = false) => {
    const want = phrase.split(/\s+/).map(norm).filter(Boolean);
    let seen = 0;
    for (let i = 0; i + want.length <= words.length; i++) {
      if (want.every((p, k) => words[i + k].n === p) && ++seen === nth) {
        return end ? words[i + want.length - 1].e : words[i].s;
      }
    }
    throw new Error(`chapter ${chapter}: no "${phrase}" in the narration`);
  };
  const time = (cue: Cue): number => {
    if (typeof cue === "number") return cue;
    if ("say" in cue) return say(cue.say, cue.nth, cue.end) + (cue.off ?? 0);
    const m = findMark(rec(cue.who), cue.mark, cue.nth);
    if (!m) throw new Error(`chapter ${chapter}: no mark "${cue.mark}" (${cue.who ?? "dm"})`);
    return m.nt + (cue.off ?? 0);
  };
  const box = (target: Target): Box => {
    const m = findMark(rec(target.who), target.mark, target.nth);
    if (!m?.box) throw new Error(`chapter ${chapter}: no box for "${target.mark}"`);
    const pad = target.pad ?? 6;
    return { x: m.box.x - pad, y: m.box.y - pad, width: m.box.width + pad * 2, height: m.box.height + pad * 2 };
  };
  return { time, box, rec, words: ch.words, duration: ch.duration };
}
