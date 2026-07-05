import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssetUploadError,
  MAX_UPLOAD_BYTES,
  clampImageMime,
  httpBaseFromWsUrl,
  uploadAssetFile,
  uploadAssetId,
  uploadHashFromAssetId,
  uploadedAssetUrl,
} from "../assetUpload";

const HASH = "a".repeat(64);
const WS = "ws://localhost:8787";

function pngFile(bytes = 16, name = "torch.png", type = "image/png"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function successBody(overrides: Record<string, unknown> = {}) {
  return {
    hash: HASH,
    url: `/assets/${HASH}`,
    mime: "image/png",
    size: 16,
    deduplicated: false,
    ...overrides,
  };
}

async function expectUploadError(
  promise: Promise<unknown>,
  code: AssetUploadError["code"],
): Promise<AssetUploadError> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AssetUploadError);
  expect((error as AssetUploadError).code).toBe(code);
  return error as AssetUploadError;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpBaseFromWsUrl", () => {
  it("maps ws to http and keeps host and port", () => {
    expect(httpBaseFromWsUrl("ws://localhost:8787")).toBe("http://localhost:8787");
    expect(httpBaseFromWsUrl("ws://192.168.50.226:8787")).toBe("http://192.168.50.226:8787");
  });

  it("maps wss to https", () => {
    expect(httpBaseFromWsUrl("wss://herobyte-server.onrender.com")).toBe(
      "https://herobyte-server.onrender.com",
    );
  });
});

describe("clampImageMime", () => {
  it("keeps accepted image types, stripping parameters", () => {
    expect(clampImageMime("image/png")).toBe("image/png");
    expect(clampImageMime("image/webp; charset=binary")).toBe("image/webp");
    expect(clampImageMime("IMAGE/JPEG")).toBe("image/jpeg");
  });

  it("defaults surprising or missing types to image/png", () => {
    expect(clampImageMime(null)).toBe("image/png");
    expect(clampImageMime("text/html")).toBe("image/png");
    expect(clampImageMime("image/svg+xml")).toBe("image/png");
  });
});

describe("upload asset ids", () => {
  it("round-trips a hash through the asset id", () => {
    expect(uploadHashFromAssetId(uploadAssetId(HASH))).toBe(HASH);
  });

  it("rejects ids that are not well-formed upload references", () => {
    expect(uploadHashFromAssetId("terrain:stone-floor")).toBeNull();
    expect(uploadHashFromAssetId(`upload:${"z".repeat(64)}`)).toBeNull();
    expect(uploadHashFromAssetId("upload:abc123")).toBeNull();
    expect(uploadHashFromAssetId(`upload:${"A".repeat(64)}`)).toBeNull();
  });

  it("builds a servable URL from a hash", () => {
    expect(uploadedAssetUrl(HASH, WS)).toBe(`http://localhost:8787/assets/${HASH}`);
  });
});

describe("uploadAssetFile", () => {
  it("rejects without credentials and never touches the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expectUploadError(uploadAssetFile(pngFile(), null, WS), "no-credentials");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty files before uploading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expectUploadError(uploadAssetFile(pngFile(0), { secret: "s" }, WS), "empty");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized files before uploading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = pngFile(MAX_UPLOAD_BYTES + 1);
    await expectUploadError(uploadAssetFile(big, { secret: "s" }, WS), "too-large");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects files that declare a non-image type before uploading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const text = pngFile(16, "notes.txt", "text/plain");
    await expectUploadError(uploadAssetFile(text, { secret: "s" }, WS), "unsupported-type");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs raw bytes with room credentials and parses the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, successBody()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAssetFile(pngFile(), { secret: "s3cret", roomId: "room-9" }, WS);

    expect(result).toEqual(successBody());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8787/assets");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/octet-stream",
      "x-herobyte-secret": "s3cret",
      "x-herobyte-room": "room-9",
    });
    expect(init.body).toBeInstanceOf(ArrayBuffer);
    expect((init.body as ArrayBuffer).byteLength).toBe(16);
  });

  it("omits the room header when no roomId is known", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, successBody()));
    vi.stubGlobal("fetch", fetchMock);
    await uploadAssetFile(pngFile(), { secret: "s" }, WS);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("x-herobyte-room");
  });

  it("accepts a deduplicated 200 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, successBody({ deduplicated: true })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await uploadAssetFile(pngFile(), { secret: "s" }, WS);
    expect(result.deduplicated).toBe(true);
  });

  it("uploads files whose type the browser could not sniff", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, successBody()));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadAssetFile(pngFile(16, "mystery", ""), { secret: "s" }, WS)).resolves.toEqual(
      successBody(),
    );
  });

  it.each([
    [401, "unauthorized"],
    [413, "too-large"],
    [415, "unsupported-type"],
    [507, "quota-exceeded"],
  ] as const)("maps HTTP %i to the %s error code", async (status, code) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, { error: "nope" }));
    vi.stubGlobal("fetch", fetchMock);
    await expectUploadError(uploadAssetFile(pngFile(), { secret: "s" }, WS), code);
  });

  it("surfaces the server error message on unknown statuses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, { error: "Upload failed" }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await expectUploadError(
      uploadAssetFile(pngFile(), { secret: "s" }, WS),
      "failed",
    );
    expect(error.message).toBe("Upload failed");
  });

  it("wraps network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    await expectUploadError(uploadAssetFile(pngFile(), { secret: "s" }, WS), "failed");
  });

  it("rejects success responses with malformed bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { hash: "not-a-hash" }));
    vi.stubGlobal("fetch", fetchMock);
    await expectUploadError(uploadAssetFile(pngFile(), { secret: "s" }, WS), "failed");
  });
});
