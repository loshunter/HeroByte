# Multi-Room Store & Redis Adapter Plan

## Goals

1. Spin up one `RoomService` per logical room without duplicating business logic.
2. Keep room state mutations routed through an abstraction so we can drop in Redis or any shared store when scaling past a single process.
3. Provide a fan-out path for control/high-frequency messages that respects room boundaries.

## Current Baseline

- `RoomStore` interface plus `InMemoryRoomStore` now wrap the canonical `RoomState`. The WebSocket router asks a single `RoomService` instance for state.
- A `roomId` string is accepted by `RoomService`, but we always pass `"default-room"`.
- `RoomRegistry` now owns RoomService instantiation per `roomId` and picks the backing store (in-memory by default, Redis when `ROOM_STORE=redis`).
- `RedisRoomStore` keeps a synchronous cache hydrated from Redis hashes so room state can be fanned out across processes without blocking the authoritative pipeline.

## Next Steps

1. **Room Registry**
   - Build a `RoomRegistry` that hands out `RoomService` instances keyed by `roomId`.
   - Wire router construction to look up `{ roomId, roomService }` from the registry using metadata from the authentication layer.
2. **Redis Adapter**
   - Implement `RedisRoomStore` that implements the `RoomStore` interface.
   - Use Redis hashes for state payloads (`room:{roomId}:state`) and pub/sub channels for fan-out (`room:{roomId}:events`).
   - Keep serialization identical to the current persistence payload so migrations are straight-forward.
3. **Fan-out Contracts**
   - Add contract tests proving that publishing a delta/broadcast for `room-A` never reaches `room-B` clients.
   - Mirror the existing `MessageRouter` unit tests with multiple room instances to ensure idempotent command IDs and acknowledgements stay scoped.
4. **Feature Flag**
   - Gate the Redis adapter behind an environment flag (`ROOM_STORE=redis`).
   - Default to `InMemoryRoomStore` for local dev/tests; integration tests can stand up a disposable Redis container.

## Risks & Mitigations

- **Cross-room bleed:** enforce roomId on every entry point (authentication payloads, command attachments) and log when mismatches occur.
- **Redis latency:** batch state writes (the current debounced `saveState`) and rely on the high-frequency channel for ephemeral traffic.
- **Operational overhead:** keep `RoomStore` narrow (get/set/delete/list) so mocking remains trivial for unit tests.

This plan keeps the code changes incremental—first land the registry, then enable Redis behind a guard, and finally flip the feature flag once the fan-out tests pass in CI.
