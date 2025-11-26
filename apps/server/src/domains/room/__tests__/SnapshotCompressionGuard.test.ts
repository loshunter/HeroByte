import { describe, it, expect } from "vitest";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { RoomService, SNAPSHOT_SIZE_LIMIT_BYTES } from "../service.js";

describe("Snapshot compression guard", () => {
  it("keeps gzip and brotli payloads below configured guard", () => {
    const service = new RoomService();
    service.setState({
      mapBackground: "#".repeat(25_000),
      drawings: [
        {
          id: "drawing-1",
          type: "freehand",
          points: Array.from({ length: 50 }, (_, idx) => ({ x: idx, y: idx * 2 })),
          color: "#fff",
          width: 2,
          opacity: 1,
        },
      ],
    });

    const snapshot = service.createSnapshot();
    const payload = Buffer.from(JSON.stringify(snapshot), "utf8");

    const gzipBytes = gzipSync(payload).length;
    const brotliBytes = brotliCompressSync(payload).length;

    expect(gzipBytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    expect(brotliBytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
  });
});
