import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import './theme/herobyte.css';
import './theme/jrpg.css';

// Polyfills for simple-peer
import { Buffer } from 'buffer';
import process from 'process';
(window as any).Buffer = Buffer;
(window as any).process = process;

createRoot(document.getElementById("root")!).render(<App />);
