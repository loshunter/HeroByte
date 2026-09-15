// ============================================================================
// CUSTOM TOKENS CONTEXT
// ============================================================================
// The table's own Library tokens, and the two things a DM can do with them,
// handed to every TokenLibrary under the NPCs tab — the tab's own picker and
// each NPC card's — without threading three props through NPCEditor, which
// sits a handful of lines under the 350-line guard. The default is an empty,
// read-only shelf, so a TokenLibrary rendered anywhere else still works.

import { createContext, useContext } from "react";
import type { CustomToken, TokenSize } from "@herobyte/shared";

/** What the add form hands up: the wire shape of add-custom-token. */
export interface CustomTokenDraft {
  name: string;
  imageUrl: string;
  description?: string;
  tags: string[];
  size: TokenSize;
}

export interface CustomTokensApi {
  tokens: readonly CustomToken[];
  /** Absent means the shelf is read-only here (no DM plumbing behind it). */
  addToken?: (draft: CustomTokenDraft) => void;
  removeToken?: (id: string) => void;
}

const CustomTokensContext = createContext<CustomTokensApi>({ tokens: [] });

export const CustomTokensProvider = CustomTokensContext.Provider;

export function useCustomTokensApi(): CustomTokensApi {
  return useContext(CustomTokensContext);
}
