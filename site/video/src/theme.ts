import { loadFont as loadPixel } from "@remotion/google-fonts/PressStart2P";
import { loadFont as loadSans } from "@remotion/google-fonts/IBMPlexSans";

// The website's palette (site/assets/site.css), so the videos and the site look like one thing.
export const C = {
  bg: "#0b0d12",
  bg2: "#0e1120",
  panel: "#12152a",
  line: "#1d2140",
  line2: "#2a2f55",
  line3: "#4a4f75",
  ink: "#f0e2c3",
  ink3: "#d6c9a8",
  muted: "#a89878",
  gold: "#f3c64e",
  goldInk: "#14100a",
  blue: "#447df7",
  blue2: "#7fa4ff",
  shadow: "#0b0246",
  green: "#66cc66",
  red: "#ff6b6b",
};

export const PIXEL = loadPixel().fontFamily;
export const SANS = loadSans("normal", { weights: ["400", "600", "700"], subsets: ["latin"] }).fontFamily;

export const W = 1920;
export const H = 1080;
export const FPS = 30;
