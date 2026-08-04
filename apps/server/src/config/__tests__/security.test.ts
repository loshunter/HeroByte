import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getAllowedOrigins, isOriginAllowed, isPrivateLanOrigin } from "../security.js";

const ORIGINAL_ALLOWED = process.env.HEROBYTE_ALLOWED_ORIGINS;
const ORIGINAL_LAN = process.env.HEROBYTE_DEV_ALLOW_LAN;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  delete process.env.HEROBYTE_ALLOWED_ORIGINS;
  delete process.env.HEROBYTE_DEV_ALLOW_LAN;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  restore("HEROBYTE_ALLOWED_ORIGINS", ORIGINAL_ALLOWED);
  restore("HEROBYTE_DEV_ALLOW_LAN", ORIGINAL_LAN);
  restore("NODE_ENV", ORIGINAL_NODE_ENV);
});

describe("security config", () => {
  it("returns default origins when env not set", () => {
    const origins = getAllowedOrigins();
    expect(origins).toContain("http://localhost:5174");
    expect(origins).toContain("https://herobyte.pages.dev");
  });

  it("parses comma separated env list", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com, https://foo.dev";
    expect(getAllowedOrigins()).toEqual(["https://example.com", "https://foo.dev"]);
  });

  it("allows wildcard to disable origin checks", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com, *";
    expect(getAllowedOrigins()).toEqual(["*"]);
    expect(isOriginAllowed("https://anywhere.test")).toBe(true);
  });

  it("treats empty origin as allowed", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed(null)).toBe(true);
  });

  it("blocks disallowed origins", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "https://example.com";
    expect(isOriginAllowed("https://blocked.dev")).toBe(false);
    expect(isOriginAllowed("https://example.com")).toBe(true);
  });
});

describe("private LAN origins (phone-on-the-same-wifi dev access)", () => {
  it("recognises private and loopback addresses", () => {
    for (const origin of [
      "http://192.168.50.225:5174",
      "http://10.5.0.2:5174",
      "http://172.16.4.9:5174",
      "http://172.31.255.1:5174",
      "http://169.254.10.1:5174",
      "http://127.0.0.1:9999",
      "http://localhost:5174",
      "http://my-laptop.local:5174",
    ]) {
      expect(isPrivateLanOrigin(origin), origin).toBe(true);
    }
  });

  it("rejects public addresses and anything that is not a plain http(s) host", () => {
    for (const origin of [
      "http://8.8.8.8:5174",
      "https://herobyte.pages.dev",
      "http://172.32.0.1:5174", // just outside 172.16/12
      "http://172.15.0.1:5174", // just below it
      "http://999.1.1.1:5174",
      "file:///etc/passwd",
      "not-a-url",
      "",
    ]) {
      expect(isPrivateLanOrigin(origin), origin).toBe(false);
    }
  });

  it("stays blocked unless dev LAN access is explicitly enabled", () => {
    expect(isOriginAllowed("http://192.168.50.225:5174")).toBe(false);
  });

  it("is allowed once pnpm dev sets the flag", () => {
    process.env.HEROBYTE_DEV_ALLOW_LAN = "true";
    expect(isOriginAllowed("http://192.168.50.225:5174")).toBe(true);
    expect(isOriginAllowed("http://10.5.0.2:5174")).toBe(true);
  });

  it("never opens a public origin, even with the flag on", () => {
    process.env.HEROBYTE_DEV_ALLOW_LAN = "true";
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);
    expect(isOriginAllowed("http://8.8.8.8:5174")).toBe(false);
  });

  it("is inert in production even if the flag leaks into the environment", () => {
    process.env.HEROBYTE_DEV_ALLOW_LAN = "true";
    process.env.NODE_ENV = "production";
    expect(isOriginAllowed("http://192.168.50.225:5174")).toBe(false);
  });

  it("still honours an explicit allowlist that names the LAN origin", () => {
    process.env.HEROBYTE_ALLOWED_ORIGINS = "http://192.168.50.225:5174";
    expect(isOriginAllowed("http://192.168.50.225:5174")).toBe(true);
  });
});
