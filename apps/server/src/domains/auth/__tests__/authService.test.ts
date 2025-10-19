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

  describe("DM Password Management", () => {
    it("initializes with default DM password from environment", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // With our changes, DM password is always initialized (either from env or fallback "FunDM")
      expect(service.hasDMPassword()).toBe(true);
      expect(service.verifyDMPassword("FunDM")).toBe(true); // Default fallback
      expect(service.verifyDMPassword("wrong")).toBe(false);
    });

    it("sets and verifies DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      // Set DM password
      const summary = service.updateDMPassword("DMSecret123");
      expect(summary.source).toBe("user");
      expect(summary.updatedAt).toBeGreaterThan(0);

      // Verify it works
      expect(service.hasDMPassword()).toBe(true);
      expect(service.verifyDMPassword("DMSecret123")).toBe(true);
      expect(service.verifyDMPassword("wrong")).toBe(false);
    });

    it("persists DM password separately from room password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      // Set both passwords
      service.update("RoomPassword456");
      service.updateDMPassword("DMPassword789");

      // Verify both work
      expect(service.verify("RoomPassword456")).toBe(true);
      expect(service.verifyDMPassword("DMPassword789")).toBe(true);

      // Verify they're independent
      expect(service.verify("DMPassword789")).toBe(false);
      expect(service.verifyDMPassword("RoomPassword456")).toBe(false);

      // Reload from disk
      const reloaded = new AuthService({ storagePath: SECRET_PATH });
      expect(reloaded.verify("RoomPassword456")).toBe(true);
      expect(reloaded.verifyDMPassword("DMPassword789")).toBe(true);
      expect(reloaded.hasDMPassword()).toBe(true);
    });

    it("updates existing DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      service.updateDMPassword("FirstDMPassword");
      expect(service.verifyDMPassword("FirstDMPassword")).toBe(true);

      // Update to new password
      service.updateDMPassword("SecondDMPassword");
      expect(service.verifyDMPassword("SecondDMPassword")).toBe(true);
      expect(service.verifyDMPassword("FirstDMPassword")).toBe(false);
    });

    it("enforces minimum 8 character length for DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      expect(() => service.updateDMPassword("short")).toThrow(
        "DM password must be between 8 and 128 characters.",
      );
      expect(() => service.updateDMPassword("12345678")).not.toThrow();
    });

    it("enforces maximum 128 character length for DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      const tooLong = "a".repeat(129);
      expect(() => service.updateDMPassword(tooLong)).toThrow(
        "DM password must be between 8 and 128 characters.",
      );

      const maxLength = "a".repeat(128);
      expect(() => service.updateDMPassword(maxLength)).not.toThrow();
    });

    it("trims whitespace from DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      service.updateDMPassword("  password123  ");
      expect(service.verifyDMPassword("password123")).toBe(true);
      expect(service.verifyDMPassword("  password123  ")).toBe(true);
    });

    it("rejects invalid input types for DM password verification", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("ValidPass123");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(service.verifyDMPassword("" as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(service.verifyDMPassword(null as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(service.verifyDMPassword(undefined as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(service.verifyDMPassword(123 as any)).toBe(false);
    });

    it("uses timing-safe comparison for DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("SecurePass123");

      // These should all fail without leaking timing info
      const attempts = [
        "SecurePass12", // One char short
        "SecurePass1234", // One char long
        "securepass123", // Different case
        "XecurePass123", // First char wrong
      ];

      attempts.forEach((attempt) => {
        expect(service.verifyDMPassword(attempt)).toBe(false);
      });
    });
  });
});
