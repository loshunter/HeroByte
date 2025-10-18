import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { AuthService } from "../service.js";

const TMP_DIR = path.join(process.cwd(), ".tmp");
const SECRET_PATH = path.join(TMP_DIR, "auth-service-test-secret.json");

describe("AuthService", () => {
  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(SECRET_PATH)) {
      rmSync(SECRET_PATH);
    }
  });

  it("verifies default fallback password", () => {
    const service = new AuthService({ storagePath: SECRET_PATH });
    expect(service.verify("Fun1")).toBe(true);
    expect(service.verify("wrong")).toBe(false);
  });

  it("persists updated password", () => {
    const service = new AuthService({ storagePath: SECRET_PATH });
    service.update("NewSecret!123");

    expect(service.verify("NewSecret!123")).toBe(true);
    expect(service.verify("Fun1")).toBe(false);

    // Reload from disk to ensure persistence
    const reloaded = new AuthService({ storagePath: SECRET_PATH });
    expect(reloaded.verify("NewSecret!123")).toBe(true);
    expect(reloaded.getSummary().source).toBe("user");
  });
});
