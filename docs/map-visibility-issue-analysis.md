# Map Visibility Issue Analysis

## Problem Description

When testing with two browser windows:
- **DM window (with cached session)**: Can see map, tokens, and staging zone
- **Fresh client (incognito window)**: Can see tokens and staging zone, BUT NOT the map

This creates a dangerous UX issue where the DM thinks all players can see the map when they actually cannot.

## Root Cause

The issue is **NOT** a state synchronization problem. The server correctly broadcasts the full room state including the map to all authenticated clients.

The actual problem is **client-side image loading failure**:

1. **Discord CDN URLs have restrictions**:
   - The map URL in the state file is: `https://media.discordapp.net/attachments/.../StraightRoadPublicJPG.jpg?ex=68f7be17&...`
   - These URLs include expiration tokens (`?ex=...`) and are subject to CORS policies
   - They may also have referrer restrictions

2. **Browser cache differences**:
   - DM's browser has the image **cached** from when it was first loaded
   - Fresh clients (incognito/new sessions) have **no cache**
   - When they try to fetch from Discord CDN, the request may fail due to:
     - Expired query parameters
     - CORS restrictions
     - Network policies

3. **Silent failure**:
   - When `useImage` hook fails to load the image, `MapImageLayer.tsx:43` returns `null`
   - The map becomes invisible with no visible error to the DM
   - This creates the illusion that only the DM can see the map

## Evidence

Looking at `/home/loshunter/HeroByte/apps/server/herobyte-state.json`:

```json
{
  "mapBackground": "https://media.discordapp.net/...",
  "sceneObjects": [
    {
      "id": "map",
      "type": "map",
      "data": {
        "imageUrl": "https://media.discordapp.net/..."
      }
    }
  ]
}
```

Both fields are correctly persisted and broadcast to all clients via:
- `apps/server/src/domains/room/model.ts:114-131` (toSnapshot function)
- `apps/server/src/ws/connectionHandler.ts:295` (broadcast after authentication)

## Solution Implemented

Added error logging to `apps/client/src/features/map/components/MapImageLayer.tsx`:

```typescript
// Log image loading status for debugging
useEffect(() => {
  if (src && status === "failed") {
    console.error("[MapImageLayer] Failed to load map image:", src);
    console.error(
      "[MapImageLayer] This may be due to CORS restrictions, expired CDN tokens, or network issues.",
    );
  } else if (src && status === "loaded") {
    console.log("[MapImageLayer] Map image loaded successfully");
  }
}, [src, status]);
```

This will help diagnose image loading failures in the browser console.

## Recommended Long-term Solutions

1. **Upload maps to your own server** instead of using Discord CDN links
2. **Implement a proxy endpoint** that fetches and caches images server-side
3. **Add a visual warning** in the DM UI when the map fails to load for some clients
4. **Support base64-encoded images** for smaller maps (no external dependencies)
5. **Add a "Test as Player" view** where DMs can see exactly what players see

## Testing Instructions

1. Open the app in two windows (one normal, one incognito)
2. Open browser console in both windows (F12)
3. Look for `[MapImageLayer]` log messages
4. If you see "Failed to load map image", the issue is confirmed
5. Solution: Re-upload the map using a stable URL or base64 encoding

## Files Modified

- `apps/client/src/features/map/components/MapImageLayer.tsx` - Added error logging

## Related Code Locations

- Image rendering: `apps/client/src/features/map/components/MapImageLayer.tsx:43`
- Map source priority: `apps/client/src/ui/MapBoard.tsx:814`
- State persistence: `apps/server/src/domains/room/service.ts:116-135`
- State broadcast: `apps/server/src/ws/connectionHandler.ts:295`
