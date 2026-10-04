// ============================================================================
// MICROPHONE FAILURE WORDS
// ============================================================================
// What a person is told when the microphone will not start. It names the FAILURE and
// what to do about it, never the raw browser error (that stays in the console).
// Safari gets its own settings route INSTEAD of the address-bar wording (it has no site icon
// there), so `readMicEnvironment`'s guess decides which instruction is shown: keep that check
// strict. Lines are kept to about 100 characters: each is shown under the mic button of a Party
// card about 130 px wide (five or six lines), and a longer one runs below the panel's fold.

export interface MicEnvironment {
  /** `navigator.mediaDevices` exists. It does not on a plain http:// page (a LAN address). */
  hasMediaDevices: boolean;
  isSafari: boolean;
}

const BLOCKED = ["NotAllowedError", "PermissionDeniedError", "SecurityError"];
const NO_DEVICE = ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"];
const IN_USE = ["NotReadableError", "TrackStartError"];

export function readMicEnvironment(): MicEnvironment {
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return {
    hasMediaDevices: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices),
    // Desktop Safari only. Every other WebKit or Blink browser names itself too (Chrome's agent
    // also says "Safari"), and an iPad reports a Mac with touch points: none of those has
    // the "Safari > Settings" menu this line sends people to.
    isSafari:
      /safari/i.test(agent) &&
      !/chrome|chromium|crios|fxios|edg|android|iphone|ipad/i.test(agent) &&
      !(typeof navigator !== "undefined" && navigator.maxTouchPoints > 1),
  };
}

export function describeMicFailure(error: unknown, env: MicEnvironment): string {
  if (!env.hasMediaDevices) {
    return "Voice needs https:// or localhost. Browsers hide the mic on plain http:// pages.";
  }
  const name = error instanceof Error ? error.name : "";
  if (BLOCKED.includes(name)) {
    // Chrome reports an OS-level denial as the same error, so the computer's own privacy
    // settings are named too. Safari has no site icon in the address bar: it gets its own route.
    return env.isSafari
      ? "Mic blocked. Allow it in Safari > Settings > Websites > Microphone and Mac privacy settings."
      : "Mic blocked. Allow it for this site (address bar icon) and in system privacy settings, then try again.";
  }
  if (NO_DEVICE.includes(name)) {
    return "No microphone found. Plug one in, then try again.";
  }
  if (IN_USE.includes(name)) {
    return "The mic would not start. If another app is using it, close it there, then try again.";
  }
  return "The mic could not start. Check it is connected and allowed here, then try again.";
}
