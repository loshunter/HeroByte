// The default table's passwords come from the server settings on EVERY start.
//
// The app cannot change them (the server refuses set-room-password and set-dm-password for the
// default table, so the published credentials always work there). But the secret file used to
// win over the settings once it existed — and creating any private table writes that file — so a
// host who changed HEROBYTE_ROOM_SECRET / HEROBYTE_DM_PASSWORD after a leak and restarted found
// the OLD passwords still working, silently. Private tables' saved passwords are theirs alone and
// must be left exactly as saved.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { getRoomSecret } from "../../../config/auth.js";
import { AuthService } from "../service.js";
import { loadSecretRecords } from "../secretPersistence.js";

const TMP_DIR = path.join(process.cwd(), ".tmp");
const SECRET_PATH = path.join(TMP_DIR, "default-passwords-from-settings.json");

// Real production-cost scrypt throughout (several boots per test, three
// derivations each), so CPU contention on a loaded gate run slows these ~12x —
// past vitest's 5s default. Same budget and reasoning as authService.test.ts.
vi.setConfig({ testTimeout: 30_000 });

describe("the default table's passwords follow the server settings on every start", () => {
  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  beforeEach(() => {
    // Start clean too, not just end clean: a test that timed out keeps running
    // past its afterEach and re-writes the file, and the next run's first test
    // then finds table-priv01 "already taken".
    if (existsSync(SECRET_PATH)) rmSync(SECRET_PATH);
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "OldRoomSecret1");
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "OldDmPassword1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(SECRET_PATH)) rmSync(SECRET_PATH);
  });

  /** Boot, mint a private table (which writes the secret file), and stop. */
  async function bootWithAPrivateTable() {
    const first = new AuthService({ storagePath: SECRET_PATH });
    await first.createRoom("table-priv01", "PrivateRoomPw!", "PrivateDmPw!1");
    expect(existsSync(SECRET_PATH)).toBe(true);
  }

  it("takes a changed table password from the settings, and refuses the old one", async () => {
    await bootWithAPrivateTable();
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "NewRoomSecret2");

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await expect(restarted.verify("NewRoomSecret2")).resolves.toBe(true);
    await expect(restarted.verify("OldRoomSecret1")).resolves.toBe(false);
    expect(restarted.getSummary().source).toBe("env");
  });

  it("takes a changed DM password from the settings, and refuses the old one", async () => {
    await bootWithAPrivateTable();
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "NewDmPassword2");

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await expect(restarted.verifyDMPassword("NewDmPassword2")).resolves.toBe(true);
    await expect(restarted.verifyDMPassword("OldDmPassword1")).resolves.toBe(false);
  });

  it("falls back to the documented defaults when the settings are removed", async () => {
    await bootWithAPrivateTable();
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "");
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "");

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await expect(restarted.verify("Fun1")).resolves.toBe(true);
    await expect(restarted.verify("OldRoomSecret1")).resolves.toBe(false);
    await expect(restarted.verifyDMPassword("FunDM")).resolves.toBe(true);
    expect(restarted.getSummary().source).toBe("fallback");
  });

  it("leaves every private table's saved passwords exactly as saved", async () => {
    await bootWithAPrivateTable();
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "NewRoomSecret2");
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "NewDmPassword2");

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await expect(restarted.verify("PrivateRoomPw!", "table-priv01")).resolves.toBe(true);
    await expect(restarted.verifyDMPassword("PrivateDmPw!1", "table-priv01")).resolves.toBe(true);
    // ...and the server-wide passwords still never open a private table.
    await expect(restarted.verify("NewRoomSecret2", "table-priv01")).resolves.toBe(false);
    await expect(restarted.verifyDMPassword("NewDmPassword2", "table-priv01")).resolves.toBe(false);
  });

  it("agrees with what http/routes.ts reads for its hint: the setting (or default) IS what is accepted", async () => {
    // routes.ts prints getRoomSecret() (the setting, never the saved file) when the source is
    // "fallback", and a different hint when it is "env". Whichever it picks must be the truth.
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "");
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "");
    const first = new AuthService({ storagePath: SECRET_PATH });
    await first.createRoom("table-priv01", "PrivateRoomPw!");
    expect(first.getSummary().source).toBe("fallback");

    // The file now says "fallback". A setting added later must still win, and be reported as such.
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "NewRoomSecret2");
    const withSetting = new AuthService({ storagePath: SECRET_PATH });
    expect(withSetting.getSummary().source).toBe("env");
    await expect(withSetting.verify(getRoomSecret())).resolves.toBe(true);

    vi.stubEnv("HEROBYTE_ROOM_SECRET", "");
    const withoutSetting = new AuthService({ storagePath: SECRET_PATH });
    expect(withoutSetting.getSummary().source).toBe("fallback");
    await expect(withoutSetting.verify(getRoomSecret())).resolves.toBe(true);
  });

  it("keeps the new default passwords through the next private table's save", async () => {
    await bootWithAPrivateTable();
    vi.stubEnv("HEROBYTE_ROOM_SECRET", "NewRoomSecret2");

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await restarted.createRoom("table-priv02", "SecondRoomPw!!");

    const again = new AuthService({ storagePath: SECRET_PATH });
    await expect(again.verify("NewRoomSecret2")).resolves.toBe(true);
    await expect(again.verify("SecondRoomPw!!", "table-priv02")).resolves.toBe(true);
    await expect(again.verify("PrivateRoomPw!", "table-priv01")).resolves.toBe(true);
  });

  // The file's top-level record is the default table's, and it is now always re-derived
  // from the settings — dead weight. An operator who deletes it by hand (or a file written
  // with it missing) must not lose every private table's password: the old loader dropped
  // `rooms` with it, so each private code became claimable again.
  it("keeps private tables' passwords when the file's default-table record is gone", async () => {
    await bootWithAPrivateTable();
    const saved = JSON.parse(readFileSync(SECRET_PATH, "utf-8")) as Record<string, unknown>;
    writeFileSync(SECRET_PATH, JSON.stringify({ rooms: saved.rooms }, null, 2));

    const restarted = new AuthService({ storagePath: SECRET_PATH });
    await expect(restarted.verify("PrivateRoomPw!", "table-priv01")).resolves.toBe(true);
    expect(restarted.isRoomInitialized("table-priv01")).toBe(true);
    await expect(restarted.verify("OldRoomSecret1")).resolves.toBe(true);
  });

  it("records where the DM password came from: the setting, or the default", () => {
    expect(loadSecretRecords(SECRET_PATH).secret.dmSource).toBe("env");
    vi.stubEnv("HEROBYTE_DM_PASSWORD", "");
    expect(loadSecretRecords(SECRET_PATH).secret.dmSource).toBe("fallback");
  });
});
