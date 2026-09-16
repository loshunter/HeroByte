import { exportBytes } from "../../domains/room/sessionExport.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomService } from "../../domains/room/service.js";

/**
 * One freehand drawing heavy enough to put a room's export past the mint
 * ceiling BY ITSELF (~0.9 MB on the wire at 40,000 points): a table's
 * drawings ride the session file verbatim, so this makes a room heavy for a
 * reason no document COUNT can see. Every byte-ceiling test uses it, so the
 * count cap's tests — which never call it — stay green when the byte check is
 * sabotaged, and each site is pinned on its own.
 */
export function fatDrawing(points = 40_000) {
  return {
    id: "fat-drawing",
    type: "freehand",
    points: Array.from({ length: points }, (_, i) => ({ x: i, y: i })),
    color: "#ffffff",
    width: 2,
    opacity: 1,
  };
}

/**
 * Pad a room's export to within 2 KB under `target`, through a growing
 * freehand drawing set with `setState` and mirrored into the scene graph by
 * the staging-zone setter (`setState` alone does not rebuild it, and a
 * drawing rides the export twice — itself and its scene object — so a bare
 * push weighs half of what the table writes). Bounded: the loop under-fills
 * every pass (a conservative per-point cost), converges in ~10–20 passes and
 * gives up loudly at 64 rather than hanging CI. Returns the export's bytes.
 */
export function padExportTo(
  room: RoomService,
  maps: MapStudioService,
  roomId: string,
  uid: string,
  target: number,
): number {
  const weigh = () => exportBytes(room.getState(), maps.list(roomId), uid);
  const points: { x: number; y: number }[] = [];
  let i = 0;
  for (let pass = 0; pass < 64 && weigh() < target - 2048; pass++) {
    const missing = target - 2048 - weigh();
    for (let n = 0; n < Math.max(1, Math.floor(missing / 120)); n++, i++) {
      points.push({ x: i, y: i });
    }
    const drawings = room.getState().drawings.filter((entry) => entry.id !== "fat-drawing");
    drawings.push({ ...fatDrawing(0), points } as never);
    room.setState({ drawings });
    room.setPlayerStagingZone(room.getState().playerStagingZone);
  }
  const bytes = weigh();
  if (bytes < target - 2048 || bytes > target) {
    throw new Error(`padExportTo: landed at ${bytes}, wanted (${target - 2048}, ${target}]`);
  }
  return bytes;
}

/**
 * Pad a room's export to within 64 bytes under `target` — coarse to 12 KB
 * under with `padExportTo`, then a second "tuner" drawing whose point count a
 * binary search settles. For the cases that must bracket a cost of a few KB
 * (a kick's graph and capture envelope), 2 KB of slack is not precision.
 * Callable again with a LOWER target: the tuner is rebuilt from scratch, so
 * anything above the coarse floor can be reached. Returns the export's bytes.
 */
export function padExportToExactly(
  room: RoomService,
  maps: MapStudioService,
  roomId: string,
  uid: string,
  target: number,
): number {
  const weigh = () => exportBytes(room.getState(), maps.list(roomId), uid);
  const setTuner = (points: number) => {
    const drawings = room.getState().drawings.filter((entry) => entry.id !== "tuner-drawing");
    if (points > 0) {
      drawings.push({
        ...fatDrawing(0),
        id: "tuner-drawing",
        points: Array.from({ length: points }, (_, i) => ({ x: i, y: i })),
      } as never);
    }
    room.setState({ drawings });
    room.setPlayerStagingZone(room.getState().playerStagingZone);
  };
  setTuner(0);
  if (weigh() < target - 12_288) padExportTo(room, maps, roomId, uid, target - 10_240);
  let low = 0;
  let high = 2_048;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    setTuner(mid);
    if (weigh() <= target) low = mid;
    else high = mid;
  }
  setTuner(low);
  const bytes = weigh();
  if (bytes < target - 64 || bytes > target) {
    throw new Error(`padExportToExactly: landed at ${bytes}, wanted (${target - 64}, ${target}]`);
  }
  return bytes;
}
