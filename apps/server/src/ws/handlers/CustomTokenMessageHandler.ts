/**
 * Custom token message handler — a table's own Library tokens.
 *
 * Two messages, both DM-only (the dispatcher gates them): add one, remove
 * one. The rest of the shape — name, description, tags, size — is validated
 * upstream and normalised by the service.
 *
 * @module ws/handlers/CustomTokenMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CustomTokenInput, CustomTokenService } from "../../domains/customToken/service.js";
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";

export interface CustomTokenMessageResult {
  broadcast: boolean;
  save: boolean;
}

export class CustomTokenMessageHandler {
  constructor(private service: CustomTokenService) {}

  handleAdd(state: RoomState, input: CustomTokenInput, addedBy: string): CustomTokenMessageResult {
    // A table whose shelf outgrows the snapshot limit produces a session file
    // that fails its own load validation — the same headroom rule as props
    // and bulk NPCs, refused rather than trimmed.
    if (state.customTokens.length >= SNAPSHOT_LIMITS.customTokens) {
      console.warn(
        `Refusing to add a custom token: the table is at the ${SNAPSHOT_LIMITS.customTokens}-token limit`,
      );
      return { broadcast: false, save: false };
    }
    const added = this.service.add(state, input, addedBy) !== null;
    return { broadcast: added, save: added };
  }

  handleRemove(state: RoomState, id: string): CustomTokenMessageResult {
    const removed = this.service.remove(state, id);
    return { broadcast: removed, save: removed };
  }
}
