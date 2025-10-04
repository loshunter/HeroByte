import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./theme/herobyte.css";
import "./theme/jrpg.css";

// Polyfills for simple-peer
import { Buffer } from "buffer";
import processPolyfill from "process";

declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: typeof processPolyfill;
  }
}

window.Buffer = Buffer;
window.process = processPolyfill;

createRoot(document.getElementById("root")!).render(<App />);
