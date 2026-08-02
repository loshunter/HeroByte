import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { AuthService } from "../service.js";

// verify/verifyDMPassword/createRoom are async (scrypt runs off the event
// loop — S1), hence the awaits; update/updateDMPassword stay sync on purpose.

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

  it("verifies default fallback password", async () => {
    const service = new AuthService({ storagePath: SECRET_PATH });
    await expect(service.verify("Fun1")).resolves.toBe(true);
    await expect(service.verify("wrong")).resolves.toBe(false);
  });

  it("persists updated password", async () => {
    const service = new AuthService({ storagePath: SECRET_PATH });
    service.update("NewSecret!123");

    await expect(service.verify("NewSecret!123")).resolves.toBe(true);
    await expect(service.verify("Fun1")).resolves.toBe(false);

    // Reload from disk to ensure persistence
    const reloaded = new AuthService({ storagePath: SECRET_PATH });
    await expect(reloaded.verify("NewSecret!123")).resolves.toBe(true);
    expect(reloaded.getSummary().source).toBe("user");
  });

  it("preserves the env secret source when a per-room update persists the file", async () => {
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "EnvSecret!123");
    const service = new AuthService({ storagePath: SECRET_PATH });
    expect(service.getSummary().source).toBe("env");

    // Setting a per-room secret persists every record, including the
    // untouched default — its source must survive the round trip.
    service.update("RoomOnly!456", "room-x1");

    const reloaded = new AuthService({ storagePath: SECRET_PATH });
    expect(reloaded.getSummary().source).toBe("env");
    await expect(reloaded.verify("EnvSecret!123")).resolves.toBe(true);
    await expect(reloaded.verify("RoomOnly!456", "room-x1")).resolves.toBe(true);
  });

  describe("DM Password Management", () => {
    it("initializes with default DM password from environment", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // With our changes, DM password is always initialized (either from env or fallback "FunDM")
      expect(service.hasDMPassword()).toBe(true);
      await expect(service.verifyDMPassword("FunDM")).resolves.toBe(true); // Default fallback
      await expect(service.verifyDMPassword("wrong")).resolves.toBe(false);
    });

    it("sets and verifies DM password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      // Set DM password
      const summary = service.updateDMPassword("DMSecret123");
      expect(summary.source).toBe("user");
      expect(summary.updatedAt).toBeGreaterThan(0);

      // Verify it works
      expect(service.hasDMPassword()).toBe(true);
      await expect(service.verifyDMPassword("DMSecret123")).resolves.toBe(true);
      await expect(service.verifyDMPassword("wrong")).resolves.toBe(false);
    });

    it("persists DM password separately from room password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      // Set both passwords
      service.update("RoomPassword456");
      service.updateDMPassword("DMPassword789");

      // Verify both work
      await expect(service.verify("RoomPassword456")).resolves.toBe(true);
      await expect(service.verifyDMPassword("DMPassword789")).resolves.toBe(true);

      // Verify they're independent
      await expect(service.verify("DMPassword789")).resolves.toBe(false);
      await expect(service.verifyDMPassword("RoomPassword456")).resolves.toBe(false);

      // Reload from disk
      const reloaded = new AuthService({ storagePath: SECRET_PATH });
      await expect(reloaded.verify("RoomPassword456")).resolves.toBe(true);
      await expect(reloaded.verifyDMPassword("DMPassword789")).resolves.toBe(true);
      expect(reloaded.hasDMPassword()).toBe(true);
    });

    it("keeps the DM password when the ROOM password is changed afterwards", async () => {
      // Order matters, and the existing coverage set the room password FIRST,
      // so it never exercised this: updating the default room's password used
      // to REPLACE its whole record, silently dropping dmHash/dmSalt. That is
      // a privilege escalation, not just data loss — hasDMPassword() then
      // reports false, and set-dm-password's bootstrap path auto-promotes
      // whoever calls it, so rotating the table password opened the DM seat to
      // any player at the table.
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("DMPasswordFirst");

      service.update("RoomPasswordSecond");

      expect(service.hasDMPassword()).toBe(true);
      await expect(service.verifyDMPassword("DMPasswordFirst")).resolves.toBe(true);
      await expect(service.verify("RoomPasswordSecond")).resolves.toBe(true);

      // ...and it survives a restart, since the wipe was persisted too.
      const reloaded = new AuthService({ storagePath: SECRET_PATH });
      expect(reloaded.hasDMPassword()).toBe(true);
      await expect(reloaded.verifyDMPassword("DMPasswordFirst")).resolves.toBe(true);
    });

    it("keeps the DM password when the room password is reset to the default", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("DMPasswordFirst");

      service.update("Fun1"); // the reset-to-default path

      expect(service.getSummary().source).toBe("fallback");
      expect(service.hasDMPassword()).toBe(true);
      await expect(service.verifyDMPassword("DMPasswordFirst")).resolves.toBe(true);
    });

    it("updates existing DM password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      service.updateDMPassword("FirstDMPassword");
      await expect(service.verifyDMPassword("FirstDMPassword")).resolves.toBe(true);

      // Update to new password
      service.updateDMPassword("SecondDMPassword");
      await expect(service.verifyDMPassword("SecondDMPassword")).resolves.toBe(true);
      await expect(service.verifyDMPassword("FirstDMPassword")).resolves.toBe(false);
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

    it("trims whitespace from DM password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });

      service.updateDMPassword("  password123  ");
      await expect(service.verifyDMPassword("password123")).resolves.toBe(true);
      await expect(service.verifyDMPassword("  password123  ")).resolves.toBe(true);
    });

    it("rejects invalid input types for DM password verification", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("ValidPass123");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.verifyDMPassword("" as any)).resolves.toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.verifyDMPassword(null as any)).resolves.toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.verifyDMPassword(undefined as any)).resolves.toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.verifyDMPassword(123 as any)).resolves.toBe(false);
    });

    it("uses timing-safe comparison for DM password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      service.updateDMPassword("SecurePass123");

      // These should all fail without leaking timing info
      const attempts = [
        "SecurePass12", // One char short
        "SecurePass1234", // One char long
        "securepass123", // Different case
        "XecurePass123", // First char wrong
      ];

      for (const attempt of attempts) {
        await expect(service.verifyDMPassword(attempt)).resolves.toBe(false);
      }
    });
  });

  describe("Private rooms (created with their own password)", () => {
    it("the default password NEVER opens a custom room", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // Default room still uses the server password.
      await expect(service.verify("Fun1")).resolves.toBe(true);
      // A never-created custom room is NOT joinable — not even with the default.
      await expect(service.verify("Fun1", "table-secret")).resolves.toBe(false);
      await expect(service.verify("anything", "table-secret")).resolves.toBe(false);
    });

    it("createRoom sets a room-only password; only it opens the room", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      await service.createRoom("table-abc", "hunter2secret");

      await expect(service.verify("hunter2secret", "table-abc")).resolves.toBe(true);
      await expect(service.verify("Fun1", "table-abc")).resolves.toBe(false); // default locked out
      await expect(service.verify("hunter2secret")).resolves.toBe(false); // doesn't open the default room

      // Persists across restart.
      const reloaded = new AuthService({ storagePath: SECRET_PATH });
      await expect(reloaded.verify("hunter2secret", "table-abc")).resolves.toBe(true);
      await expect(reloaded.verify("Fun1", "table-abc")).resolves.toBe(false);
      expect(reloaded.isRoomInitialized("table-abc")).toBe(true);
    });

    it("createRoom sets a separate DM password when provided", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      await service.createRoom("table-dm", "playerpass1", "dmMasterKey9");

      await expect(service.verify("playerpass1", "table-dm")).resolves.toBe(true);
      await expect(service.verifyDMPassword("dmMasterKey9", "table-dm")).resolves.toBe(true);
      await expect(service.verifyDMPassword("playerpass1", "table-dm")).resolves.toBe(false);
    });

    it("a room created without a DM password does NOT accept the server default, and its creator can bootstrap one", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      // Minted with only a room password (the lobby's DM field is optional).
      await service.createRoom("table-open", "playerpass1");

      // The server-wide default DM password must not elevate here, and the room
      // reports no DM password — so an invited player can't seize DM, and the
      // set-dm-password bootstrap (gated on hasDMPassword === false) stays open.
      expect(service.hasDMPassword("table-open")).toBe(false);
      await expect(service.verifyDMPassword("FunDM", "table-open")).resolves.toBe(false);

      // The creator bootstraps the room's first DM password; only it works after.
      service.updateDMPassword("theRealDMpass", "table-open");
      expect(service.hasDMPassword("table-open")).toBe(true);
      await expect(service.verifyDMPassword("theRealDMpass", "table-open")).resolves.toBe(true);
      await expect(service.verifyDMPassword("FunDM", "table-open")).resolves.toBe(false);
    });

    it("rejects creating a room whose code is already taken", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      await service.createRoom("table-dup", "firstpass1");
      await expect(service.createRoom("table-dup", "secondpass2")).rejects.toThrow(
        /already taken/i,
      );
      // The original password still works — the second create had no effect.
      await expect(service.verify("firstpass1", "table-dup")).resolves.toBe(true);
      await expect(service.verify("secondpass2", "table-dup")).resolves.toBe(false);
    });

    it("caps the number of custom rooms to bound the pre-auth create flood", async () => {
      vi.stubEnv("HEROBYTE_MAX_CUSTOM_ROOMS", "2");
      const service = new AuthService({ storagePath: SECRET_PATH });

      await service.createRoom("table-1", "goodpass1");
      await service.createRoom("table-2", "goodpass2");
      // At the cap: a new code is refused cheaply (before hashing), but existing
      // rooms still work and re-creating a taken code still reports "already taken".
      await expect(service.createRoom("table-3", "goodpass3")).rejects.toThrow(/table limit/i);
      await expect(service.verify("goodpass1", "table-1")).resolves.toBe(true);
      await expect(service.createRoom("table-1", "otherpass1")).rejects.toThrow(/already taken/i);
    });

    it("rejects a too-short room or DM password", async () => {
      const service = new AuthService({ storagePath: SECRET_PATH });
      await expect(service.createRoom("table-x", "short")).rejects.toThrow(/6 and 128/);
      await expect(service.createRoom("table-y", "goodpass1", "weak")).rejects.toThrow(/8 and 128/);
      // Nothing was created.
      expect(service.isRoomInitialized("table-x")).toBe(false);
      expect(service.isRoomInitialized("table-y")).toBe(false);
    });

    it("two concurrent creates for the same code cannot both win", async () => {
      // The hash now yields to the threadpool, so two creates can interleave.
      // Without the post-await re-check the second would silently overwrite
      // the first creator's password.
      const service = new AuthService({ storagePath: SECRET_PATH });
      const results = await Promise.allSettled([
        service.createRoom("table-race", "firstpass1"),
        service.createRoom("table-race", "secondpass2"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      // Exactly one password opens the room.
      const first = await service.verify("firstpass1", "table-race");
      const second = await service.verify("secondpass2", "table-race");
      expect([first, second].filter(Boolean)).toHaveLength(1);
    });
  });
});
