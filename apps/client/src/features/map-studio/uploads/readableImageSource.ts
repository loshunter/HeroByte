import { uploadHashFromUrl } from "./assetUpload";

/**
 * Where to load `url` from so the canvas can read it. An upload on our server is
 * fetched past the HTTP cache into a blob: the table draws `/assets/<hash>` with no
 * Origin header, so the browser caches the reply WITHOUT CORS headers for a year,
 * and a crossOrigin load of the same address then fails (the backup bug, 7a22fa5c).
 * Every other address loads as given.
 */
export async function readableImageSource(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!uploadHashFromUrl(url)) return url;
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`could not load ${url}: ${response.status}`);
  return URL.createObjectURL(await response.blob());
}
