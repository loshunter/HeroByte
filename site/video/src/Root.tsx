import React from "react";
import { Composition } from "remotion";
import { ChannelBanner, Thumbnail } from "./brand";
import { Lesson, lessonMetadata } from "./Lesson";
import { LESSONS } from "./lessons";
import { FPS, H, W } from "./theme";

export const Root: React.FC = () => (
  <>
    {Object.entries(LESSONS).map(([id]) => (
      <Composition
        key={id}
        id={id}
        component={Lesson}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={FPS * 10}
        defaultProps={{ lesson: id }}
        calculateMetadata={lessonMetadata}
      />
    ))}
    <Composition id="ChannelBanner" component={ChannelBanner} width={2560} height={1440} fps={FPS} durationInFrames={1} />
    <Composition
      id="ThumbDmQuickStart"
      component={Thumbnail}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{
        kicker: "DM QUICK START",
        title: ["SET UP", "YOUR TABLE"],
        footage: "footage/dm-quick-start-set-up-your-table-before-game-night/ch3-dm.mp4",
        at: 34,
      }}
    />
    <Composition
      id="ThumbPlayerQuickStart"
      component={Thumbnail}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{
        kicker: "PLAYER QUICK START",
        title: ["YOUR FIRST", "SESSION"],
        footage: "footage/player-quick-start-your-first-session-as-a-player/ch4-player.mp4",
        at: 21,
        tone: "blue",
      }}
    />
  </>
);
