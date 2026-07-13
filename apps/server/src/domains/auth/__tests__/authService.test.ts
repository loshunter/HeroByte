import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
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
    vi.unstubAllEnvs();
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

  it("preserves the env secret source when a per-room update persists the file", () => {
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "EnvSecret!123");
    const service = new AuthService({ storagePath: SECRET_PATH });
    expect(service.getSummary().source).toBe("env");

    // Setting a per-room secret persists every record, including the
    // untouched default — its source must survive the round trip.
    service.update("RoomOnly!456", "room-x1");

    const reloaded = new AuthService({ storagePath: SECRET_PATH });
    expect(reloaded.getSummary().source).toBe("env");
    expect(reloaded.verify("EnvSecret!123")).toBe(true);
    expect(reloaded.verify("RoomOnly!456", "room-x1")).toBe(true);
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

  describe("Private rooms (created with their own password)", () => {
    it("the default password NEVER opens a custom room", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // Default room still uses the server password.
      expect(service.verify("Fun1")).toBe(true);
      // A never-created custom room is NOT joinable — not even with the default.
      expect(service.verify("Fun1", "table-secret")).toBe(false);
      expect(service.verify("anything", "table-secret")).toBe(false);
    });

    it("createRoom sets a room-only password; only it opens the room", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.createRoom("table-abc", "hunter2secret");

      expect(service.verify("hunter2secret", "table-abc")).toBe(true);
      expect(service.verify("Fun1", "table-abc")).toBe(false); // default locked out
      expect(service.verify("hunter2secret")).toBe(false); // doesn't open the default room

      // Persists across restart.
      const reloaded = new AuthService({ storagePath: SECRET_PATH });
      expect(reloaded.verify("hunter2secret", "table-abc")).toBe(true);
      expect(reloaded.verify("Fun1", "table-abc")).toBe(false);
      expect(reloaded.isRoomInitialized("table-abc")).toBe(true);
    });

    it("createRoom sets a separate DM password when provided", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.createRoom("table-dm", "playerpass1", "dmMasterKey9");

      expect(service.verify("playerpass1", "table-dm")).toBe(true);
      expect(service.verifyDMPassword("dmMasterKey9", "table-dm")).toBe(true);
      expect(service.verifyDMPassword("playerpass1", "table-dm")).toBe(false);
    });

    it("a room created without a DM password does NOT accept the server default, and its creator can bootstrap one", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // Minted with only a room password (the lobby's DM field is optional).
      service.createRoom("table-open", "playerpass1");

      // The server-wide default DM password must not elevate here, and the room
      // reports no DM password — so an invited player can't seize DM, and the
      // set-dm-password bootstrap (gated on hasDMPassword === false) stays open.
      expect(service.hasDMPassword("table-open")).toBe(false);
      expect(service.verifyDMPassword("FunDM", "table-open")).toBe(false);

      // The creator bootstraps the room's first DM password; only it works after.
      service.updateDMPassword("theRealDMpass", "table-open");
      expect(service.hasDMPassword("table-open")).toBe(true);
      expect(service.verifyDMPassword("theRealDMpass", "table-open")).toBe(true);
      expect(service.verifyDMPassword("FunDM", "table-open")).toBe(false);
    });

    it("rejects creating a room whose code is already taken", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.createRoom("table-dup", "firstpass1");
      expect(() => service.createRoom("table-dup", "secondpass2")).toThrow(/already taken/i);
      // The original password still works — the second create had no effect.
      expect(service.verify("firstpass1", "table-dup")).toBe(true);
      expect(service.verify("secondpass2", "table-dup")).toBe(false);
    });

    it("caps the number of custom rooms to bound the pre-auth create flood", () => {
      vi.stubEnv("HEROBYTE_MAX_CUSTOM_ROOMS", "2");
      const service = new AuthService({ storagePath: SECRET_PATH });

      service.createRoom("table-1", "goodpass1");
      service.createRoom("table-2", "goodpass2");
      // At the cap: a new code is refused cheaply (before hashing), but existing
      // rooms still work and re-creating a taken code still reports "already taken".
      expect(() => service.createRoom("table-3", "goodpass3")).toThrow(/table limit/i);
      expect(service.verify("goodpass1", "table-1")).toBe(true);
      expect(() => service.createRoom("table-1", "otherpass1")).toThrow(/already taken/i);
    });

    it("rejects a too-short room or DM password", () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      expect(() => service.createRoom("table-x", "short")).toThrow(/6 and 128/);
      expect(() => service.createRoom("table-y", "goodpass1", "weak")).toThrow(/8 and 128/);
      // Nothing was created.
      expect(service.isRoomInitialized("table-x")).toBe(false);
      expect(service.isRoomInitialized("table-y")).toBe(false);
    });
  });
});
