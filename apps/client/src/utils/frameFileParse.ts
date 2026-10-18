// A character file's frame, read through the files' door (C5a). Its own module,
// loaded only when a file is loaded: coerceTokenFrame brings the wire's
// validation and the frame catalog, which the app's entry chunk cannot carry.
export { coerceTokenFrame } from "@herobyte/shared";
