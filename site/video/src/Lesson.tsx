import React from "react";
import { AbsoluteFill, type CalculateMetadataFunction, Sequence, staticFile } from "remotion";
import { Intro, Outro } from "./bookends";
import type { LessonData, Rec } from "./data";
import { Chapter, Wipe, chapterSeconds } from "./engine";
import { LESSONS } from "./lessons";
import { FPS } from "./theme";

export type LessonProps = { lesson: string; data?: LessonData };

const INTRO = 4.2;
const OUTRO = 7;

function plan(props: LessonProps) {
  const script = LESSONS[props.lesson];
  const data = props.data!;
  let at = Math.round(INTRO * FPS);
  const chapters = script.chapters.map((ch, i) => {
    const frames = Math.round(chapterSeconds(data, i + 1, ch) * FPS);
    const entry = { from: at, frames };
    at += frames;
    return entry;
  });
  return { script, data, chapters, outroAt: at, total: at + OUTRO * FPS };
}

export const Lesson: React.FC<LessonProps> = (props) => {
  const { script, data, chapters, outroAt } = plan(props);
  const minutes = Math.max(1, Math.round((outroAt / FPS) / 60));
  return (
    <AbsoluteFill style={{ background: "#0b0d12" }}>
      <Sequence durationInFrames={Math.round(INTRO * FPS)}>
        <Intro title={script.title} subtitle={script.subtitle} chips={[`${script.chapters.length} STEPS`, `ABOUT ${minutes} MIN`]} />
      </Sequence>
      {chapters.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.frames}>
          <Chapter n={i + 1} total={chapters.length} data={data} script={script.chapters[i]} slug={script.slug} />
        </Sequence>
      ))}
      <Sequence from={outroAt} durationInFrames={OUTRO * FPS}>
        <Outro headline={script.outro.headline} steps={script.chapters.map((c) => c.title)} next={script.outro.next} />
      </Sequence>
      {[...chapters.map((c) => c.from), outroAt].map((at, i) => (
        <Sequence key={`w${i}`} from={at - 9} durationInFrames={26}>
          <Wipe />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const lessonMetadata: CalculateMetadataFunction<LessonProps> = async ({ props }) => {
  const slug = LESSONS[props.lesson].slug;
  const [recordings, timing] = await Promise.all([
    fetch(staticFile(`footage/${slug}/recordings.json`)).then((r) => r.json() as Promise<Record<string, Rec>>),
    fetch(staticFile(`audio/${slug}/timing.json`)).then((r) => r.json()),
  ]);
  const data: LessonData = { recordings, chapters: timing.chapters };
  const withData = { ...props, data };
  return { durationInFrames: plan(withData).total, props: withData };
};
