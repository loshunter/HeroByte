// ============================================================================
// SERVER WARMUP MANAGER
// ============================================================================
// Ensures the Render-hosted server is awake before WebSocket connection attempts
// by issuing a long-polling HTTP request to the /healthz endpoint.

const WARMUP_TIMEOUT_MS = 60000; // 60 seconds matches Render cold-start guidance

function deriveHttpBaseUrl(wsUrl: string): string | null {
  try {
    const parsed = new URL(wsUrl);
    const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
    return `${protocol}//${parsed.host}`;
  } catch (error) {
    console.warn("[Warmup] Invalid WebSocket URL, skipping warmup:", error);
    return null;
  }
}

/**
 * Handles HTTP warmup pings to wake Render's sleeping dynos before WebSocket connect.
 * Keeps a single in-flight warmup request to avoid duplicate wake-up calls.
 */
export class ServerWarmupManager {
  private warmupPromise: Promise<void> | null = null;
  private readonly httpBaseUrl: string | null;
  private readonly timeoutMs: number;

  constructor(wsUrl: string, timeoutMs = WARMUP_TIMEOUT_MS) {
    this.httpBaseUrl = deriveHttpBaseUrl(wsUrl);
    this.timeoutMs = timeoutMs;
  }

  /**
   * Ensure that a warmup request has been fired.
   * Subsequent calls reuse the same promise to prevent duplicate fetches.
   */
  ensureWarmup(): Promise<void> {
    if (!this.httpBaseUrl) {
      return Promise.resolve();
    }

    const fetchFn = (globalThis as typeof globalThis & { fetch?: typeof fetch }).fetch;
    if (typeof fetchFn !== "function") {
      return Promise.resolve();
    }

    if (!this.warmupPromise) {
      this.warmupPromise = this.performWarmup(fetchFn);
    }

    return this.warmupPromise;
  }

  private buildWarmupUrl(): string {
    return `${this.httpBaseUrl}/healthz`;
  }

  private async performWarmup(fetchFn: typeof fetch): Promise<void> {
    const warmupUrl = this.buildWarmupUrl();
    console.log("[Warmup] Pinging", warmupUrl, "to wake server");

    const AbortControllerCtor = (globalThis as typeof globalThis & {
      AbortController?: typeof AbortController;
    }).AbortController;

    const controller = typeof AbortControllerCtor === "function" ? new AbortControllerCtor() : null;
    const timeoutId =
      controller !== null && typeof setTimeout === "function"
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null;

    try {
      await fetchFn(warmupUrl, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        keepalive: true,
        signal: controller?.signal,
      });
      console.log("[Warmup] Server responded to warmup request");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(
          `[Warmup] Warmup request timed out after ${this.timeoutMs}ms; server may still be starting`,
        );
      } else {
        console.warn("[Warmup] Warmup request failed:", error);
      }
    } finally {
      if (timeoutId !== null && typeof clearTimeout === "function") {
        clearTimeout(timeoutId);
      }
    }
  }
}
