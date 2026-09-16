import { useEffect, useState } from "react";

const STORAGE_KEY = "herobyte:crt";

/** Local display preference; never part of shared room state. */
export function useCrtPreference() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Storage can be unavailable or full; the toggle still works this session.
    }
  }, [enabled]);

  return [enabled, setEnabled] as const;
}
