import { useEffect, useState } from "react";

/**
 * Whether Alt is currently held, tracked from real key events so the state
 * updates with a still mouse — pointer-event sampling alone lags a press and
 * Alt+Tab away would leave it stuck. The setter lets pointer handlers keep
 * the state in sync when the canvas gains events before any key repeat.
 */
export function useAltKeyTracking(): [boolean, (next: boolean) => void] {
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    const handleAltKey = (event: KeyboardEvent) => {
      if (event.key === "Alt") setAltHeld(event.type === "keydown");
    };
    const handleBlur = () => setAltHeld(false);
    window.addEventListener("keydown", handleAltKey);
    window.addEventListener("keyup", handleAltKey);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleAltKey);
      window.removeEventListener("keyup", handleAltKey);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return [altHeld, setAltHeld];
}
