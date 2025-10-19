# Player Snapshot Schema Documentation

## Overview

This document describes the player snapshot schema used in HeroByte for saving and loading player state. The schema supports two different contexts: server-side room persistence and client-side player export.

## Server-Side Player Interface

The server persists the complete `Player` interface as part of the room state in `herobyte-state.json`.

**Location:** `packages/shared/src/index.ts:121-131`

```typescript
interface Player {
  uid: string;                    // Unique player identifier (required)
  name: string;                   // Display name (required)
  portrait?: string;              // Base64 encoded image or URL
  micLevel?: number;              // Current microphone level (0-1) for visual feedback
  hp?: number;                    // Current hit points
  maxHp?: number;                 // Maximum hit points
  lastHeartbeat?: number;         // Timestamp of last heartbeat (for timeout detection)
  isDM?: boolean;                 // Whether the player currently has DM tools enabled
  statusEffects?: string[];       // Active status effect identifiers/labels
}
```

### Field Details

#### Required Fields

- **`uid`** (string): Unique identifier for the player. Generated on connection.
- **`name`** (string): Display name shown in the UI. Defaults to "Player N" where N is player number.

#### Optional Fields

- **`portrait`** (string | undefined): Player portrait image. Can be:
  - Base64-encoded image data (data URI)
  - HTTP/HTTPS URL to an image
  - Undefined if no portrait set

- **`micLevel`** (number | undefined): Current microphone activity level (0.0 to 1.0)
  - Used for real-time voice activity visualization
  - **NOT persisted** to disk (in-memory only)
  - Reset to undefined on server restart

- **`hp`** (number | undefined): Current hit points
  - Defaults to 100 on player creation
  - Can be modified by DM or player

- **`maxHp`** (number | undefined): Maximum hit points
  - Defaults to 100 on player creation
  - Can be modified by DM or player

- **`lastHeartbeat`** (number | undefined): Timestamp (milliseconds) of last client heartbeat
  - Used for connection timeout detection
  - **NOT persisted** to disk (in-memory only)
  - Reset to `Date.now()` on player creation/reconnection

- **`isDM`** (boolean | undefined): Whether player has DM privileges enabled
  - Defaults to false on player creation
  - Can be toggled via `toggle-dm` message
  - Grants elevated permissions (delete any token, modify room settings, etc.)

- **`statusEffects`** (string[] | undefined): Array of active status effect labels
  - Examples: "Poisoned", "Blessed", "Stunned"
  - Defaults to empty array `[]` on player creation
  - Limited to 16 effects max on client import

### Default Values on Creation

When a new player connects, the server creates a Player object with these defaults:

```typescript
{
  uid: "<generated-uid>",
  name: "Player <number>",
  hp: 100,
  maxHp: 100,
  lastHeartbeat: Date.now(),
  isDM: false,
  statusEffects: []
}
```

### Persistence Behavior

**Saved to `herobyte-state.json`:**
- uid, name, portrait, hp, maxHp, isDM, statusEffects

**NOT saved (reset on server restart):**
- lastHeartbeat (reset to current time on reconnect)
- micLevel (reset to undefined)

### Load Sanitization

When loading from disk, the server sanitizes the data:

```typescript
isDM: player.isDM ?? false,
statusEffects: Array.isArray(player.statusEffects) ? [...player.statusEffects] : []
```

---

## Client-Side PlayerState Interface

The client uses a different schema for exporting/importing individual player state. This includes additional token data.

**Location:** `packages/shared/src/index.ts:136-146`

```typescript
interface PlayerState {
  name: string;                          // Player display name
  hp: number;                            // Current hit points
  maxHp: number;                         // Maximum hit points
  portrait?: string | null;              // Portrait image (Base64 or URL)
  tokenImage?: string | null;            // Legacy: mirrors token.imageUrl
  color?: string;                        // Legacy: mirrors token.color
  token?: PlayerStateTokenSnapshot;      // Token transform data
  statusEffects?: string[];              // Active status effects
  drawings?: Drawing[];                  // Player-owned drawings
}

interface PlayerStateTokenSnapshot {
  id?: string;                           // Token ID
  color?: string;                        // Token color (HSL string)
  imageUrl?: string | null;              // Token image URL or Base64
  position?: { x: number; y: number };   // Grid position
  size?: TokenSize;                      // Token size ("small" | "medium" | "large" | "huge")
  rotation?: number;                     // Rotation in degrees
  scale?: { x: number; y: number };      // Scale factors
}
```

### Field Details

#### Required Fields

- **`name`** (string): Player display name. Cannot be empty.
- **`hp`** (number): Current hit points. Must be finite number.
- **`maxHp`** (number): Maximum hit points. Must be finite number.

#### Optional Fields

- **`portrait`** (string | null | undefined): Player portrait image
  - Same format as server Player.portrait
  - Can be explicitly null

- **`tokenImage`** (string | null | undefined): **Legacy field**
  - Mirrors `token.imageUrl` for backwards compatibility
  - Prefer using `token.imageUrl` instead

- **`color`** (string | undefined): **Legacy field**
  - Mirrors `token.color` for backwards compatibility
  - Prefer using `token.color` instead

- **`token`** (PlayerStateTokenSnapshot | undefined): Complete token state
  - Contains all visual and transform properties
  - See PlayerStateTokenSnapshot below

- **`statusEffects`** (string[] | undefined): Active status effects
  - Max 16 items enforced on import
  - Only string values allowed

- **`drawings`** (Drawing[] | undefined): Player-owned drawing objects
  - Full Drawing interface (complex, see shared types)
  - Typically empty array if player hasn't drawn

### PlayerStateTokenSnapshot Fields

All fields in `PlayerStateTokenSnapshot` are optional:

- **`id`** (string): Token database ID
- **`color`** (string): HSL color string (e.g., "hsl(210, 70%, 50%)")
- **`imageUrl`** (string | null): Token image (URL or Base64 data URI)
- **`position`** ({ x: number, y: number }): Grid coordinates
  - Must be finite numbers
- **`size`** (TokenSize): Token size enum value
  - "small", "medium", "large", or "huge"
- **`rotation`** (number): Rotation angle in degrees (0-360)
  - Must be finite number
- **`scale`** ({ x: number, y: number }): Scale multipliers
  - Both x and y must be finite numbers

### Client Import Validation

When importing a PlayerState file, the client validates:

```typescript
// HP values must be finite
if (!Number.isFinite(playerState.hp) || !Number.isFinite(playerState.maxHp)) {
  throw new Error("Invalid HP values");
}

// Name required
if (!playerState.name || typeof playerState.name !== "string") {
  throw new Error("Player name is required");
}

// Status effects limited to 16 items
statusEffects = (playerState.statusEffects || [])
  .filter((e): e is string => typeof e === "string")
  .slice(0, 16);

// Token position/rotation/scale must be finite
if (token.position && !Number.isFinite(token.position.x)) {
  throw new Error("Invalid token position");
}
```

---

## Save/Load Flow

### Server Persistence Flow

```
1. Player joins → PlayerService.createPlayer()
   - Creates Player with defaults

2. Player makes changes → PlayerService.updatePlayer()
   - Updates in-memory Player object

3. State change triggers → RoomService.saveState()
   - Serializes entire RoomState to herobyte-state.json
   - Includes all Player objects in players array

4. Server restarts → RoomService.loadState()
   - Reads herobyte-state.json
   - Parses Player objects with sanitization
   - Resets lastHeartbeat and micLevel
```

### Client Export/Import Flow

```
EXPORT:
1. User clicks "Export State" → savePlayerState(player, token, drawings)
   - Builds PlayerState object from current state
   - Includes token transform data if token exists
   - Downloads as JSON file: {name}-state-{timestamp}.json

IMPORT:
1. User uploads state file → loadPlayerState(file)
   - Parses JSON
   - Validates all fields with strict type checking
   - Returns PlayerState object

2. Application applies state → sendMessage({ t: "set-player-hp", ... })
   - Sends individual update messages for each field
   - Server validates and broadcasts changes
```

### Session Load Flow

When loading a saved session (DM action):

```
1. DM uploads session file → load-session message

2. Server processes → RoomService.loadSnapshot(snapshot)
   - Merges incoming players with currently connected players
   - Matches by uid
   - Preserves connection state: lastHeartbeat, micLevel
   - Updates all other fields from snapshot

3. Server broadcasts updated state
   - All clients receive new player data
   - UI updates to reflect loaded state
```

---

## File Locations

### Type Definitions
- `packages/shared/src/index.ts` - Player, PlayerState interfaces

### Server Implementation
- `apps/server/src/domains/player/service.ts` - PlayerService (create, update, delete)
- `apps/server/src/domains/room/service.ts` - loadState(), saveState(), loadSnapshot()
- `apps/server/src/ws/messageRouter.ts` - Message handlers (set-player-hp, rename-player, etc.)

### Client Implementation
- `apps/client/src/utils/playerPersistence.ts` - savePlayerState(), loadPlayerState()

### Persistence File
- `apps/server/herobyte-state.json` - Actual saved state (server-side)

---

## Schema Versioning

**Current Status:** No versioning field exists.

**Future Consideration:** Add a `version` field to enable schema migrations:

```typescript
interface PlayerState {
  version: number;  // Schema version (e.g., 1, 2, 3)
  name: string;
  // ... rest of fields
}
```

This would allow safe schema evolution without breaking old save files.

---

## Examples

### Minimal Valid Player (Server)

```json
{
  "uid": "abc123",
  "name": "Gandalf"
}
```

### Full Player Example (Server)

```json
{
  "uid": "abc123",
  "name": "Gandalf the Grey",
  "portrait": "data:image/png;base64,iVBORw0KGgo...",
  "hp": 45,
  "maxHp": 100,
  "isDM": false,
  "statusEffects": ["Blessed", "Hasted"]
}
```

### PlayerState Export Example (Client)

```json
{
  "name": "Gandalf the Grey",
  "hp": 45,
  "maxHp": 100,
  "portrait": "https://example.com/gandalf.png",
  "statusEffects": ["Blessed", "Hasted"],
  "token": {
    "id": "token-123",
    "color": "hsl(280, 60%, 50%)",
    "imageUrl": "https://example.com/gandalf-token.png",
    "position": { "x": 5, "y": 7 },
    "size": "medium",
    "rotation": 45,
    "scale": { "x": 1.2, "y": 1.2 }
  },
  "drawings": []
}
```

---

## Notes

1. **Connection State Not Persisted**: `lastHeartbeat` and `micLevel` are ephemeral and reset on server restart.

2. **Token Data Separation**: Token transforms are stored separately in `PlayerState` but not in server `Player`. The server manages tokens independently in the `tokens` array.

3. **Legacy Fields**: `tokenImage` and top-level `color` in PlayerState are legacy fields maintained for backwards compatibility.

4. **Status Effects**: No validation on effect names server-side. Client limits to 16 effects on import.

5. **Portrait Storage**: Large Base64 portraits can make save files very large. Consider URL storage for production.

6. **No UID in PlayerState**: Client export doesn't include uid since it's session-specific. Players are re-assigned UIDs on reconnection.
