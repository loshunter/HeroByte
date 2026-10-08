import type { Cue, Target } from "./data";

/** A lesson's edit, written against narration phrases and captured actions, never raw frames. */
export type LessonScript = {
  slug: string;
  title: string;
  subtitle: string;
  chapters: ChapterScript[];
  outro: { headline: string; next: string };
  /** Whisper's mishearings in the captions, word for word: { "sell.": "cell." }. */
  captionFixes?: Record<string, string>;
};

export type ChapterScript = {
  title: string;
  /** When the chapter cuts to the next (default: narration end + 1 s). */
  end?: Cue;
  zooms?: Zoom[];
  split?: { from: Cue; labels: [string, string] };
  /** A phone recording slides in on the right while the desktop shrinks to the left. */
  phone?: { from: Cue; to?: Cue; label?: string };
  beats: Beat[];
};

export type Zoom = { from: Cue; to: Cue; target?: Target; scale?: number; who?: string };

type Span = { from: Cue; to: Cue };
export type Beat =
  | (Span & {
      kind: "popup";
      title?: string;
      lines?: string[];
      lineAt?: Cue[];
      icon?: string;
      tone?: "gold" | "blue" | "green" | "red";
      target?: Target;
      side?: "auto" | "above" | "below" | "left" | "right";
      pos?: { x: number; y: number };
      width?: number;
      sfx?: string | null;
    })
  | (Span & { kind: "ring"; target: Target })
  | (Span & { kind: "key"; label: string; pos?: { x: number; y: number }; sfx?: string; shake?: boolean })
  | { kind: "chips"; items: { text: string; at: Cue }[]; to: Cue; pos: { x: number; y: number }; sep?: string; tone?: "gold" | "blue" }
  | (Span & { kind: "title"; text: string; sub?: string; y?: number; sfx?: string | null })
  | (Span & { kind: "spam"; text: string; count: number; every?: number })
  | (Span & { kind: "sticker"; text: string; pos: { x: number; y: number }; tone?: "gold" | "blue" | "green"; tilt?: number; sfx?: string | null })
  | (Span & { kind: "spot"; target?: Target; radius?: number })
  | { kind: "sfx"; at: Cue; src: string; volume?: number }
  | (Span & { kind: "ways"; ways: string[]; active: Cue[]; dock: Cue });
