# DM-Driven Player Provisioning Research

## Goals

- Let DMs pre-create “identities” (token, portrait, stats, spawn point, metadata) before players join.
- Provide invite links that auto-bind a connecting player to a prepared identity.
- Support fallback universal invite + identity claim flow when one-to-one links are not feasible.
- Maintain SOLID: separate identity registry, invite issuance, and session activation.
- Drive work via TDD: define contracts and failing tests before implementation.

## Key References & Comparable Systems

- **Foundry VTT**: “Player Configuration” lets GMs pre-create player slots and assign actors; invite links map to slots and enforce single-use tokens.
- **Roll20**: GM can “reassign character journal” entries, and invite links embed campaign/session IDs with revocation and expiration controls.
- **Tabletop Simulator mods**: use “seat claiming” toggles that briefly unlock all seats for players to claim; identical to proposed identity-claim window.
- **Auth best practices** (OWASP ASVS, RFC 8959): recommend short-lived, random invite tokens, rate limiting, and explicit revocation.

## Proposed Architecture (SRP & SoC)

| Responsibility | Module | Notes |
|----------------|--------|-------|
| Identity data model & persistence | `IdentityRegistry` | CRUD for DM-created identities; persists name, portrait URL, token asset, grid position, HP stats, optional notes. |
| Invite creation & lifecycle | `InviteService` | Generates single-use tokens (UUIDv4 + HMAC); applies expiry windows; exposes revoke/refresh APIs. |
| Session activation | `IdentityBinder` | On player join, validates invite token, binds session UID to identity, applies spawn data; separate from identity storage. |
| Claim window orchestration | `ClaimController` | Handles temporary “claimable” mode; emits events to clients so they can choose identity cards; ensures atomic claim. |
| Audit & logging | `ProvisioningAudit` | Records invite issuance, claim success/fail, revocations; optional but useful for debugging abuse. |

## Data Contracts

### Identity Template (server persisted)

```ts
interface IdentityTemplate {
  id: string;
  createdBy: string;          // DM uid
  name: string;
  portraitUrl: string | null;
  tokenAssetId: string | null;
  spawn: { x: number; y: number; facing?: number };
  hp: { current: number; max: number };
  defaultSquare: number;      // grid size / footprint
  notes?: string;
  claimedBy?: string;         // player uid once bound
  locked: boolean;            // prevents automatic reassignment
  version: number;            // for migrations
}
```

### Invite Token Record

```ts
interface InviteToken {
  token: string;              // random string (min 128 bits entropy)
  identityId: string | null;  // null for universal link
  createdAt: ISODateString;
  expiresAt: ISODateString;
  usageLimit: number;         // 1 for single-use, N for universal
  usageCount: number;
  issuedBy: string;           // DM uid
  revokedAt?: ISODateString;
}
```

### Claim Payload (client → server)

```ts
type ClaimMessage =
  | { t: "claim-invite"; token: string }
  | { t: "claim-identity"; identityId: string };
```

### TDD Entry Points

Write failing tests first for:

- `InviteService.createSingleUse(identityId)` ensures randomness, expiry, and SRP compliance.
- `IdentityBinder.bindToSession` verifies atomic claim and spawn placement update.
- `ClaimController.openClaimWindow` ensures only DMs can toggle claimable mode and claims respect concurrency.
- WebSocket message validation for `claim-invite` / `claim-identity`.

## Security Considerations

- **Randomness**: Use crypto-grade random (Node `crypto.randomBytes`) to build invite tokens. Avoid predictable sequences.
- **Expiry**: Default lifetime (e.g., 1 hour) with DM overrides. Expired tokens rejected server-side.
- **Single-use**: For identity-specific invites, enforce usage limit = 1. After claim, mark token consumed and revoke.
- **Revocation**: DM can revoke invites; store `revokedAt` and check on claim.
- **Rate limiting**: For failed claim attempts, throttle by IP/session to deter brute force.
- **Transport security**: Ensure invites transmitted via HTTPS/WSS; avoid logging tokens verbatim in client console.
- **Auditing**: Capture success/failure for DM diagnostics and to support potential abuse reports.

## UX Recommendations

- DM “Player Provisioning” panel lists identities, their status (unclaimed/claimed) with actions (edit, regenerate link, revoke).
- One-click “Copy invite link” that copies unique URL including secure token parameter.
- Provide QR code option for in-person tables.
- Universal link toggled via “Open Claim Window” button; auto-closes after configurable timeout.
- In claim window, players see identity cards with portrait/token preview; selecting card prompts confirmation.
- Display spawn preview (mini map snapshot) so DM verifies placement.
- If claim fails (expired link), show meaningful feedback and guidance to contact DM.

## Persistence Strategy

- Store identities and invites in existing room snapshot to keep DM state portable (Phase 18 synergy).
- When DM saves snapshot, include identity registry and pending invitations (revocable on load).
- On load, ensure `claimedBy` fields reconcile with active players; unmatched records revert to unclaimed.

## Dependency Notes

- Depends on Phase 18 snapshot work (schema support).
- Requires player authentication or unique session IDs; confirm current implementation sets stable `uid`.
- Coordinate with future authentication phases (Phase 9) to ensure invites respect room password/DM auth.

## Testing Strategy

1. **Unit**
   - Invite generation, expiry enforcement, revocation, claim validation.
   - Identity CRUD operations (with snapshot persistence).
2. **Integration**
   - Simulate DM issuing invite, player claiming via WebSocket, state updates.
   - Universal claim window with conflicting claims (first wins).
3. **E2E / Manual**
   - DM prepares identities, sends link, player joins into configured map location.
   - Regenerate link after revocation.
   - Claim window toggled off stops further claims.

All tests written before implementation (TDD) to guard SRP boundaries.

