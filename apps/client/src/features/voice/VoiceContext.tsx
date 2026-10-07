// ============================================================================
// VOICE CONTEXT
// ============================================================================
// The table's one voice call, handed to every control that shows it (the
// desktop header, the phone's top stack and Party screen) without threading it
// through the layout props. Absent outside an authenticated table (and in tests
// that render a layout on its own): the controls then render nothing.

import { createContext, useContext } from "react";
import type { VoiceApi } from "../../hooks/voice/useVoice";

export type VoiceContextValue = VoiceApi & { selfUid: string };

export const VoiceContext = createContext<VoiceContextValue | null>(null);

export const useVoiceContext = (): VoiceContextValue | null => useContext(VoiceContext);
